-- ═══════════════════════════════════════════════════════════════════════
-- Migration 001 — certificate numbers for verified service hours
--
-- Run this once in the Supabase SQL Editor on a database that already has
-- the base schema. Safe to re-run: every step is idempotent.
--
-- New installs don't need this — supabase/schema.sql already includes
-- everything below.
--
-- Guarantees this establishes, all enforced by the database rather than by
-- application code:
--   · every verified entry HAS a certificate number  (NOT NULL + DEFAULT)
--   · no two entries can SHARE one                   (UNIQUE)
--   · a number can never be changed or reused        (append-only trigger)
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

-- The uniqueness guard goes in BEFORE anything is written, not after.
-- Postgres permits multiple NULLs in a unique index, so this is safe to
-- create while the column is still empty — and it means the backfill below
-- cannot possibly commit a duplicate rather than merely being unlikely to.
create unique index if not exists verified_hours_certificate_number_key
  on verified_hours (certificate_number);

-- Backfill anything verified before this migration.
--
-- Done one row at a time on purpose: inside a single UPDATE statement every
-- call to generate_certificate_number() would see the same pre-statement
-- snapshot, so its "is this taken?" check couldn't see numbers assigned
-- earlier in that very statement. Row-by-row, each call sees the previous
-- one's result, and the unique index catches anything that slips through.
--
-- verified_hours is append-only and its trigger raises on any UPDATE, so
-- the guard is suspended for exactly this operation and restored straight
-- after. This is the only sanctioned write to an existing verified record.
do $$
declare
  target record;
  attempts int;
begin
  if not exists (select 1 from verified_hours where certificate_number is null) then
    return;
  end if;

  execute 'alter table verified_hours disable trigger verified_hours_no_update';

  for target in select id from verified_hours where certificate_number is null loop
    attempts := 0;
    loop
      begin
        update verified_hours
           set certificate_number = generate_certificate_number()
         where id = target.id;
        exit;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts >= 5 then
          raise exception 'Could not allocate a unique certificate number for %', target.id;
        end if;
      end;
    end loop;
  end loop;

  execute 'alter table verified_hours enable trigger verified_hours_no_update';
exception
  when others then
    -- Never leave the immutability guard switched off, whatever happened.
    execute 'alter table verified_hours enable trigger verified_hours_no_update';
    raise;
end $$;

-- Only now that every existing row has a number can the column be closed
-- off: from here on, an insert without one is impossible.
alter table verified_hours
  alter column certificate_number set default generate_certificate_number();

alter table verified_hours
  alter column certificate_number set not null;
