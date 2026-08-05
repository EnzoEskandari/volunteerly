-- ═══════════════════════════════════════════════════════════════════════
-- Migration 001 — certificate numbers for verified service hours
--
-- Run this once in the Supabase SQL Editor on a database that already has
-- the base schema. Safe to re-run: every step is idempotent.
--
-- New installs don't need this — supabase/schema.sql already includes
-- everything below.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- See the commentary in schema.sql for why this is random rather than
-- sequential, and why the alphabet excludes I, L, O and U.
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

alter table verified_hours
  add column if not exists certificate_number text;

-- Backfill anything verified before this migration. verified_hours is
-- append-only and its trigger raises on any UPDATE, so the guard is
-- suspended for exactly this one statement and immediately restored —
-- this is the only sanctioned write to an existing verified record.
do $$
begin
  if exists (select 1 from verified_hours where certificate_number is null) then
    alter table verified_hours disable trigger verified_hours_no_update;

    update verified_hours
       set certificate_number = generate_certificate_number()
     where certificate_number is null;

    alter table verified_hours enable trigger verified_hours_no_update;
  end if;
end $$;

alter table verified_hours
  alter column certificate_number set default generate_certificate_number();

alter table verified_hours
  alter column certificate_number set not null;

create unique index if not exists verified_hours_certificate_number_key
  on verified_hours (certificate_number);
