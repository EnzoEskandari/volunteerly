-- ═══════════════════════════════════════════════════════════════════════
-- Volunteerly — Supabase / PostgreSQL schema
-- Run inside the Supabase SQL editor, or via `supabase db push`.
-- Tables map 1:1 to the domain types in src/lib/types.ts
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ───────────────────────────── enums ─────────────────────────────────────
create type user_role as enum ('student', 'organization', 'admin');
create type org_approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type registration_status as enum ('registered', 'attended', 'no-show', 'cancelled');
create type opportunity_status as enum ('open', 'full', 'completed', 'cancelled');
create type notification_audience as enum ('student', 'organization');
create type report_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type virtual_pref as enum ('virtual', 'in-person', 'both');

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
  total_verified_hours numeric not null default 0,
  volunteer_streak_weeks int not null default 0
);

create table organizations (
  id uuid primary key references profiles (id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  website text,
  ein text,
  category text[] not null default '{}',
  location text,
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
  max_volunteers int not null,
  current_volunteers int not null default 0,
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

-- ───────────────────────────── verified hours ────────────────────────────
create table verified_hours (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students (id) on delete cascade,
  opportunity_id uuid not null references volunteer_opportunities (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  hours numeric not null check (hours > 0),
  activity_description text not null,
  supervisor text not null,
  date date not null,
  verified_at timestamptz not null default now()
);

create index on verified_hours (student_id);

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

-- ═══════════════════════════ row level security ══════════════════════════
alter table profiles enable row level security;
alter table students enable row level security;
alter table organizations enable row level security;
alter table volunteer_opportunities enable row level security;
alter table volunteer_registrations enable row level security;
alter table attendance_records enable row level security;
alter table verified_hours enable row level security;
alter table goals enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;

-- Helper: current user's role
create or replace function current_role_is(r user_role) returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = r);
$$ language sql stable security definer;

-- profiles: readable by owner + admins, editable by owner only
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or current_role_is('admin'));
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

-- students: student edits own row; orgs & admins can view (for roster views)
create policy "students_select" on students for select using (true);
create policy "students_update_own" on students for update using (id = auth.uid());

-- organizations: public read of approved orgs; org edits own row; admin all
create policy "orgs_select_approved_or_owner" on organizations for select
  using (approval_status = 'approved' or id = auth.uid() or current_role_is('admin'));
create policy "orgs_update_own" on organizations for update using (id = auth.uid());
create policy "orgs_admin_update" on organizations for update using (current_role_is('admin'));

-- opportunities: public read; org manages its own; admin all
create policy "opps_select_all" on volunteer_opportunities for select using (true);
create policy "opps_insert_own_org" on volunteer_opportunities for insert
  with check (org_id = auth.uid());
create policy "opps_update_own_org" on volunteer_opportunities for update
  using (org_id = auth.uid() or current_role_is('admin'));
create policy "opps_delete_own_org" on volunteer_opportunities for delete
  using (org_id = auth.uid());

-- registrations: student manages own; org sees registrants for its events
create policy "reg_select_own_or_org" on volunteer_registrations for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from volunteer_opportunities o
      where o.id = opportunity_id and o.org_id = auth.uid()
    )
  );
create policy "reg_insert_own" on volunteer_registrations for insert
  with check (student_id = auth.uid());

-- verified_hours: student reads own (read-only!); org inserts for its events
create policy "hours_select_own_or_org" on verified_hours for select
  using (student_id = auth.uid() or org_id = auth.uid());
create policy "hours_insert_org_only" on verified_hours for insert
  with check (org_id = auth.uid());
-- NOTE: intentionally no update/delete policy for students — hours are
-- immutable once verified, per spec ("Students cannot edit them").

-- notifications: only the owner reads/updates their own
create policy "notif_select_own" on notifications for select using (user_id = auth.uid());
create policy "notif_update_own" on notifications for update using (user_id = auth.uid());

-- goals: student only
create policy "goals_all_own" on goals for all using (student_id = auth.uid());

-- reports: reporter + admin
create policy "reports_select" on reports for select
  using (reporter_id = auth.uid() or current_role_is('admin'));
create policy "reports_insert" on reports for insert with check (reporter_id = auth.uid());
create policy "reports_admin_update" on reports for update using (current_role_is('admin'));

-- ═══════════════════════════ seed: achievements catalog ══════════════════
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
