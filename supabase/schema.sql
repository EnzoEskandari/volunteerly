-- ═══════════════════════════════════════════════════════════════════════
-- Volunteerly — Supabase / PostgreSQL schema
-- Run inside the Supabase SQL editor, or via `supabase db push`.
-- Tables map 1:1 to the domain types in src/lib/types.ts
--
-- SECURITY MODEL
-- --------------
-- Row-level security is the real access boundary, not the UI. Two rules
-- shape every policy below:
--
--   1. Anything a user could lie about to their own benefit is written by
--      the server (service role) after validation — never by the browser.
--      That covers joining an event, checking in, verifying hours, and
--      membership status. Client-side INSERT is simply not granted.
--   2. Reads are scoped to what the requester legitimately needs. Student
--      PII is visible to the student, to orgs hosting an event they
--      registered for, and to admins — not to the whole internet.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;   -- gen_random_bytes, for certificate numbers

-- ───────────────────────────── enums ─────────────────────────────────────
create type user_role as enum ('student', 'organization', 'admin');
create type org_approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type registration_status as enum ('registered', 'attended', 'no-show', 'cancelled');
create type opportunity_status as enum ('open', 'full', 'completed', 'cancelled');
create type notification_audience as enum ('student', 'organization');
create type report_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type virtual_pref as enum ('virtual', 'in-person', 'both');
create type membership_status as enum ('inactive', 'active', 'waived', 'past_due', 'cancelled');
create type waiver_status as enum ('pending', 'approved', 'denied');

-- ───────────────────────────── profiles ──────────────────────────────────
-- One row per auth.users entry. Role determines which detail table applies.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role user_role not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key references profiles (id) on delete cascade,
  full_name text not null,
  bio text,
  school text,
  grad_year int,
  location text,
  -- Geocoded from `location` so "near me" is a real distance, not a guess.
  lat double precision,
  lng double precision,
  age int,
  interests text[] not null default '{}',
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  available_days text[] not null default '{}',
  available_times text[] not null default '{}',
  travel_distance_miles int not null default 10,
  virtual_preference virtual_pref not null default 'both',
  transportation boolean not null default false,
  onboarding_complete boolean not null default false,
  -- ── server-owned columns (see protect_student_columns trigger) ────────
  total_verified_hours numeric not null default 0,
  volunteer_streak_weeks int not null default 0,
  membership_status membership_status not null default 'inactive',
  membership_expires_at date,
  stripe_customer_id text,
  stripe_subscription_id text
);

create index on students (stripe_customer_id);

create table organizations (
  id uuid primary key references profiles (id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  website text,
  ein text,
  category text[] not null default '{}',
  location text,
  -- server-owned: only admins move an org through approval
  approval_status org_approval_status not null default 'pending',
  rejection_reason text,
  contact_name text,
  contact_phone text
);

create table admins (
  id uuid primary key references profiles (id) on delete cascade,
  full_name text not null
);

-- ───────────────────────────── opportunities ─────────────────────────────
create table volunteer_opportunities (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  location text not null,
  is_virtual boolean not null default false,
  lat double precision,
  lng double precision,
  hours_available numeric not null,
  max_volunteers int not null check (max_volunteers > 0),
  -- server-owned: maintained by the join/cancel routes, never by a client
  current_volunteers int not null default 0 check (current_volunteers >= 0),
  min_age int,
  required_certifications text[] default '{}',
  requires_background_check boolean not null default false,
  status opportunity_status not null default 'open',
  created_at timestamptz not null default now()
);

create index on volunteer_opportunities (category);
create index on volunteer_opportunities (date);
create index on volunteer_opportunities (org_id);

-- ───────────────────────────── registrations & attendance ────────────────
create table volunteer_registrations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students (id) on delete cascade,
  opportunity_id uuid not null references volunteer_opportunities (id) on delete cascade,
  registered_at timestamptz not null default now(),
  status registration_status not null default 'registered',
  unique (student_id, opportunity_id)
);

-- One QR code per event, displayed/printed by the organization and scanned
-- by every attendee. There is deliberately no "used" flag: a single code
-- serves the whole roster, and per-student uniqueness is enforced by the
-- unique constraint on attendance_records.registration_id below.
create table qr_tokens (
  opportunity_id uuid primary key references volunteer_opportunities (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null
);

create table attendance_records (
  id uuid primary key default uuid_generate_v4(),
  registration_id uuid not null references volunteer_registrations (id) on delete cascade,
  opportunity_id uuid not null references volunteer_opportunities (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  qr_token_used text not null,
  scanned_at timestamptz not null default now(),
  unique (registration_id) -- a student can only check in once per registration
);

-- ───────────────────────────── certificate numbers ──────────────────────
-- Every verified entry is issued a serial number that a third party — a
-- scholarship committee, an admissions office — can look up at
-- /verify/<number> to confirm the record is genuine. That lookup is the
-- entire point: a certificate nobody can check is just a nice-looking PDF.
--
-- The number is therefore the credential. It's drawn from a CSPRNG rather
-- than a sequence so it can't be guessed or enumerated, and the alphabet
-- is Crockford base32 (no I, L, O or U) so a number read off paper or
-- dictated over the phone can't be mistyped into someone else's.
--
-- 32^12 ≈ 1.15e18 possibilities; the uniqueness re-check below makes a
-- collision a non-event rather than a failed verification.
create or replace function generate_certificate_number() returns text as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  -- exactly 32
  candidate text;
  chunk text;
  bytes bytea;
  i int;
  attempts int := 0;
begin
  loop
    bytes := gen_random_bytes(12);
    chunk := '';
    -- 256 is an exact multiple of 32, so this modulo introduces no bias.
    for i in 0..11 loop
      chunk := chunk || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;

    candidate := 'VLY-' || to_char(now(), 'YYYY')
              || '-' || substr(chunk, 1, 4)
              || '-' || substr(chunk, 5, 4)
              || '-' || substr(chunk, 9, 4);

    exit when not exists (
      select 1 from verified_hours where certificate_number = candidate
    );

    attempts := attempts + 1;
    if attempts >= 10 then
      raise exception 'Could not allocate a unique certificate number';
    end if;
  end loop;

  return candidate;
end;
$$ language plpgsql volatile security definer set search_path = public;

-- ───────────────────────────── verified hours ────────────────────────────
-- Append-only by design. Section 5.6 of the spec: a verified entry is
-- permanently locked and a student can never edit or delete it. Enforced
-- three ways — no update/delete policy, a hard trigger below, and the
-- absence of any client-side write path.
--
-- The certificate number inherits that immutability for free: because no
-- UPDATE is possible on this table at all, a number can never be reissued,
-- reassigned, or edited to point at different hours after the fact.
create table verified_hours (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students (id) on delete cascade,
  opportunity_id uuid not null references volunteer_opportunities (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  hours numeric not null check (hours > 0),
  activity_description text not null,
  supervisor text not null,
  date date not null,
  verified_at timestamptz not null default now(),
  certificate_number text not null unique default generate_certificate_number()
);

create index on verified_hours (student_id);
create index on verified_hours (certificate_number);

-- ───────────────────────────── membership / billing ──────────────────────
-- Need-based fee waivers (spec §6). Self-serve request, admin decision.
create table membership_waiver_requests (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students (id) on delete cascade,
  reason text not null,
  program text,                       -- e.g. "Free/reduced-price lunch"
  status waiver_status not null default 'pending',
  decided_by uuid references admins (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index on membership_waiver_requests (status);

-- Audit trail of real Stripe activity. Written only by the webhook.
create table membership_payments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students (id) on delete cascade,
  stripe_event_id text not null unique,   -- idempotency guard for retries
  stripe_invoice_id text,
  amount_cents int not null,
  currency text not null default 'usd',
  period_end date,
  created_at timestamptz not null default now()
);

create index on membership_payments (student_id);

-- ───────────────────────────── goals & achievements ──────────────────────
create table goals (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students (id) on delete cascade,
  type text not null,
  label text not null,
  target numeric not null,
  progress numeric not null default 0,
  deadline date,
  created_at timestamptz not null default now(),
  completed boolean not null default false
);

create table achievements (
  key text primary key,
  label text not null,
  description text not null,
  icon text not null,
  category text not null
);

create table student_achievements (
  student_id uuid not null references students (id) on delete cascade,
  achievement_key text not null references achievements (key) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (student_id, achievement_key)
);

-- ───────────────────────────── notifications ─────────────────────────────
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  audience notification_audience not null,
  type text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false,
  link text
);

create index on notifications (user_id, read);

-- ───────────────────────────── announcements ─────────────────────────────
create table announcements (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  body text not null,
  opportunity_id uuid references volunteer_opportunities (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── reports / moderation ──────────────────────
create table reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references profiles (id),
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ═══════════════════════════ helper functions ════════════════════════════
-- security definer so the lookup itself isn't blocked by profiles' own RLS.

create or replace function is_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql stable security definer set search_path = public;

-- True when the caller is an organization hosting an event this student
-- has registered for. Scopes roster/PII reads to a real relationship.
create or replace function shares_event_with_student(s_id uuid) returns boolean as $$
  select exists (
    select 1
    from volunteer_registrations r
    join volunteer_opportunities o on o.id = r.opportunity_id
    where r.student_id = s_id and o.org_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- ═══════════════════════════ column guards ═══════════════════════════════
-- RLS grants or denies whole rows; these triggers protect specific columns
-- that a user may otherwise legitimately update on their own row.
-- The service role bypasses RLS but still runs triggers, so each guard
-- explicitly exempts it — that is the only path allowed to move them.

create or replace function protect_student_columns() returns trigger as $$
begin
  if current_setting('role', true) = 'service_role'
     or auth.uid() is null then
    return new;
  end if;

  -- A student may edit their profile, never their money or their record.
  if new.total_verified_hours is distinct from old.total_verified_hours
     or new.membership_status is distinct from old.membership_status
     or new.membership_expires_at is distinct from old.membership_expires_at
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.volunteer_streak_weeks is distinct from old.volunteer_streak_weeks then
    raise exception
      'These fields are set by Volunteerly, not by the account holder.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger students_protect_server_columns
  before update on students
  for each row execute function protect_student_columns();

create or replace function protect_org_columns() returns trigger as $$
begin
  if current_setting('role', true) = 'service_role'
     or auth.uid() is null
     or is_admin() then
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Approval status is set by Volunteerly administrators.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger organizations_protect_approval
  before update on organizations
  for each row execute function protect_org_columns();

-- Opportunity headcount is derived from real registrations, so an
-- organization can edit its listing but not inflate its own numbers.
create or replace function protect_opportunity_columns() returns trigger as $$
begin
  if current_setting('role', true) = 'service_role' or auth.uid() is null then
    return new;
  end if;

  if new.current_volunteers is distinct from old.current_volunteers then
    raise exception 'Volunteer count is maintained by Volunteerly.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger opportunities_protect_count
  before update on volunteer_opportunities
  for each row execute function protect_opportunity_columns();

-- A student may cancel their own registration and nothing else. Without
-- this, the same policy that permits cancelling would also permit setting
-- status to 'attended' — self-reported attendance, which would bypass QR
-- check-in entirely and then satisfy the hour-verification route.
create or replace function protect_registration_columns() returns trigger as $$
begin
  if current_setting('role', true) = 'service_role' or auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'Attendance is recorded by checking in at the event.';
  end if;

  if new.opportunity_id is distinct from old.opportunity_id
     or new.student_id is distinct from old.student_id then
    raise exception 'A registration cannot be reassigned.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger registrations_cancel_only
  before update on volunteer_registrations
  for each row execute function protect_registration_columns();

-- Marking a notification read is the only edit its recipient may make;
-- rewriting the title or body of one is not.
create or replace function protect_notification_columns() returns trigger as $$
begin
  if current_setting('role', true) = 'service_role' or auth.uid() is null then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.link is distinct from old.link
     or new.type is distinct from old.type
     or new.user_id is distinct from old.user_id then
    raise exception 'Only the read status of a notification can be changed.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger notifications_read_only_flag
  before update on notifications
  for each row execute function protect_notification_columns();

-- Verified hours are immutable, full stop — no exemption, not even for
-- the service role. Corrections are made by issuing a new entry.
create or replace function verified_hours_are_immutable() returns trigger as $$
begin
  raise exception
    'Verified hours are a permanent record and cannot be changed or removed.';
end;
$$ language plpgsql;

create trigger verified_hours_no_update
  before update or delete on verified_hours
  for each row execute function verified_hours_are_immutable();

-- Keep the student's running total honest: it is recomputed from the
-- verified_hours table itself rather than incremented by the caller.
create or replace function sync_student_hours() returns trigger as $$
begin
  update students
     set total_verified_hours = (
       select coalesce(sum(hours), 0) from verified_hours where student_id = new.student_id
     )
   where id = new.student_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger verified_hours_sync_total
  after insert on verified_hours
  for each row execute function sync_student_hours();

-- ═══════════════════════════ row level security ══════════════════════════
alter table profiles                   enable row level security;
alter table students                   enable row level security;
alter table organizations              enable row level security;
alter table admins                     enable row level security;
alter table volunteer_opportunities    enable row level security;
alter table volunteer_registrations    enable row level security;
alter table attendance_records         enable row level security;
alter table verified_hours             enable row level security;
alter table goals                      enable row level security;
alter table achievements               enable row level security;
alter table student_achievements       enable row level security;
alter table notifications              enable row level security;
alter table announcements              enable row level security;
alter table reports                    enable row level security;
alter table qr_tokens                  enable row level security;
alter table membership_waiver_requests enable row level security;
alter table membership_payments        enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_insert_own" on profiles for insert
  with check (id = auth.uid());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ── students ─────────────────────────────────────────────────────────────
-- Scoped read: yourself, an org you actually volunteered with, or an admin.
-- (The old `using (true)` exposed every student's age, school and location
-- to anyone holding the public anon key.)
create policy "students_select_scoped" on students for select
  using (
    id = auth.uid()
    or is_admin()
    or shares_event_with_student(id)
  );
create policy "students_insert_own" on students for insert
  with check (id = auth.uid());
-- Profile edits only; the column guard trigger blocks membership + hours.
create policy "students_update_own" on students for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ── organizations ────────────────────────────────────────────────────────
create policy "orgs_select_approved_or_owner" on organizations for select
  using (approval_status = 'approved' or id = auth.uid() or is_admin());
create policy "orgs_insert_own" on organizations for insert
  with check (id = auth.uid());
create policy "orgs_update_own_or_admin" on organizations for update
  using (id = auth.uid() or is_admin());

-- ── admins ───────────────────────────────────────────────────────────────
-- Previously this table had no RLS at all, which let anyone holding the
-- public anon key insert themselves an admin row. Reads are admin-only and
-- there is no client-side insert path: admins are provisioned server-side.
create policy "admins_select_admin_only" on admins for select
  using (is_admin());

-- ── opportunities ────────────────────────────────────────────────────────
-- Public discovery feed, but only from approved organizations.
create policy "opps_select_public" on volunteer_opportunities for select
  using (
    exists (
      select 1 from organizations o
      where o.id = org_id and o.approval_status = 'approved'
    )
    or org_id = auth.uid()
    or is_admin()
  );
create policy "opps_insert_own_org" on volunteer_opportunities for insert
  with check (
    org_id = auth.uid()
    and exists (
      select 1 from organizations o
      where o.id = auth.uid() and o.approval_status = 'approved'
    )
  );
create policy "opps_update_own_org" on volunteer_opportunities for update
  using (org_id = auth.uid() or is_admin());
create policy "opps_delete_own_org" on volunteer_opportunities for delete
  using (org_id = auth.uid() or is_admin());

-- ── registrations ────────────────────────────────────────────────────────
-- No client INSERT. Joining runs through /api/opportunities/join, which
-- checks membership, capacity, age and certifications first. A student may
-- cancel their own registration.
create policy "reg_select_own_or_org" on volunteer_registrations for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from volunteer_opportunities o
      where o.id = opportunity_id and o.org_id = auth.uid()
    )
    or is_admin()
  );
create policy "reg_update_own_cancel" on volunteer_registrations for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ── attendance ───────────────────────────────────────────────────────────
-- No client INSERT: the browser posts the scanned token to
-- /api/checkin, which validates it server-side. Letting the client write
-- here would mean self-reported attendance.
create policy "attendance_select" on attendance_records for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from volunteer_opportunities o
      where o.id = opportunity_id and o.org_id = auth.uid()
    )
    or is_admin()
  );

-- ── qr_tokens ────────────────────────────────────────────────────────────
-- Read is restricted to the hosting organization (which displays the code)
-- and admins. Students never read this table — they submit a scanned token
-- to the server, which looks it up with the service role. The previous
-- `using (true)` let any student enumerate every code and check in to
-- events they never attended.
create policy "qr_select_own_org" on qr_tokens for select
  using (
    exists (
      select 1 from volunteer_opportunities o
      where o.id = opportunity_id and o.org_id = auth.uid()
    )
    or is_admin()
  );

-- ── verified hours ───────────────────────────────────────────────────────
-- Insert happens through /api/hours/verify (service role) after confirming
-- the caller owns the event. No update/delete policy exists, and the
-- immutability trigger above backs that up.
create policy "hours_select_own_or_org" on verified_hours for select
  using (student_id = auth.uid() or org_id = auth.uid() or is_admin());

-- ── goals ────────────────────────────────────────────────────────────────
create policy "goals_all_own" on goals for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ── achievements ─────────────────────────────────────────────────────────
-- Static catalog: readable by anyone, writable by no one but the server.
create policy "achievements_select_any" on achievements for select using (true);
create policy "student_achievements_select_own" on student_achievements for select
  using (student_id = auth.uid() or is_admin());

-- ── notifications ────────────────────────────────────────────────────────
-- Insert is server-only. Previously any signed-in user could write a
-- notification to any other user, which is a spam and phishing vector.
create policy "notif_select_own" on notifications for select
  using (user_id = auth.uid());
create policy "notif_update_own" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── announcements ────────────────────────────────────────────────────────
create policy "announcements_select_any" on announcements for select using (true);
create policy "announcements_insert_own_org" on announcements for insert
  with check (org_id = auth.uid());

-- ── reports ──────────────────────────────────────────────────────────────
create policy "reports_select" on reports for select
  using (reporter_id = auth.uid() or is_admin());
create policy "reports_insert" on reports for insert
  with check (reporter_id = auth.uid());
create policy "reports_admin_update" on reports for update using (is_admin());

-- ── membership ───────────────────────────────────────────────────────────
-- A student files their own waiver request and can watch its status;
-- only an admin decides it (enforced by the update policy).
create policy "waiver_select_own_or_admin" on membership_waiver_requests for select
  using (student_id = auth.uid() or is_admin());
create policy "waiver_insert_own" on membership_waiver_requests for insert
  with check (student_id = auth.uid() and status = 'pending');
create policy "waiver_admin_update" on membership_waiver_requests for update
  using (is_admin());

-- Payment history is readable by the student it belongs to. Rows are
-- written exclusively by the Stripe webhook via the service role.
create policy "payments_select_own_or_admin" on membership_payments for select
  using (student_id = auth.uid() or is_admin());

-- ═══════════════════════════ account provisioning ═══════════════════════
-- Creates the profile + role row the moment an auth user is created,
-- reading what registration collected from the sign-up metadata.
--
-- This runs as a trigger rather than as a client-side insert because when
-- email confirmation is switched on there is no session immediately after
-- sign-up, so the browser has no authenticated identity to insert with.
-- Doing it here means registration works identically either way.
--
-- Note the role is clamped: anyone can pass metadata, so 'admin' is not
-- reachable through public sign-up. Admins are provisioned deliberately.
create or replace function handle_new_user() returns trigger as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested text := coalesce(meta ->> 'role', 'student');
  resolved user_role;
begin
  resolved := case when requested = 'organization' then 'organization'::user_role
                   else 'student'::user_role end;

  insert into profiles (id, email, role)
  values (new.id, new.email, resolved)
  on conflict (id) do nothing;

  if resolved = 'student' then
    insert into students (id, full_name, age)
    values (
      new.id,
      coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1)),
      nullif(meta ->> 'age', '')::int
    )
    on conflict (id) do nothing;
  else
    insert into organizations (id, name, ein, website, contact_name, description, category)
    values (
      new.id,
      coalesce(nullif(trim(meta ->> 'name'), ''), 'Unnamed organization'),
      nullif(meta ->> 'ein', ''),
      nullif(meta ->> 'website', ''),
      nullif(meta ->> 'contact_name', ''),
      nullif(meta ->> 'description', ''),
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(meta -> 'category')),
        '{}'
      )
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═══════════════════════════ seed: achievements catalog ══════════════════
-- This is a static catalog of badges the product defines — not user data,
-- and not fabricated activity. It ships empty of any earned rows.
insert into achievements (key, label, description, icon, category) values
  ('first-event', 'First Volunteer Event', 'Completed your first verified volunteer event', 'Sparkles', 'milestone'),
  ('hours-10', '10 Hours', 'Reached 10 verified service hours', 'Clock', 'milestone'),
  ('hours-25', '25 Hours', 'Reached 25 verified service hours', 'Clock', 'milestone'),
  ('hours-50', '50 Hours', 'Reached 50 verified service hours', 'Clock', 'milestone'),
  ('hours-100', '100 Hours', 'Reached 100 verified service hours', 'Trophy', 'milestone'),
  ('community-leader', 'Community Leader', 'Volunteered with 5 or more organizations', 'Users', 'milestone'),
  ('environmental-champion', 'Environmental Champion', 'Logged 10+ hours in Environment causes', 'Leaf', 'cause'),
  ('animal-advocate', 'Animal Advocate', 'Logged 10+ hours in Animal causes', 'PawPrint', 'cause'),
  ('education-mentor', 'Education Mentor', 'Logged 10+ hours in Education causes', 'GraduationCap', 'cause'),
  ('four-week-streak', 'Four Week Streak', 'Volunteered four weeks in a row', 'Flame', 'streak')
on conflict do nothing;

-- ═══════════════════════════ table privileges ════════════════════════════
-- Row-level security policies only ever restrict *rows* — Postgres still
-- requires the underlying role to hold table-level privileges before RLS is
-- even consulted. Creating tables through the SQL editor (rather than
-- Supabase's Table Editor UI, which grants these automatically) skips that
-- step, and every query fails with "permission denied" until it's granted
-- explicitly here — regardless of RLS.
--
-- service_role is included deliberately: it bypasses RLS, but it is NOT
-- exempt from these base table grants. Every route under src/app/api uses
-- service_role for its writes, so leaving it out breaks every one of them
-- with a bare "permission denied for table X" — RLS remains the real gate
-- for anon/authenticated; this just lets each role touch the table at all.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
