-- ═══════════════════════════════════════════════════════════════════════
-- Certificate integrity audit — read-only, safe to run any time.
--
-- Checks the three properties that have to hold for a certificate to mean
-- anything: every verified entry has one, no two share one, and neither
-- fact depends on application code remembering to do the right thing.
--
-- Paste into the Supabase SQL Editor and Run.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Every verified entry carries a certificate.
--    missing_certificates must be 0.
select
  count(*)                                          as verified_entries,
  count(*) filter (where certificate_number is null) as missing_certificates
from verified_hours;

-- 2. No number is used twice.
--    total_certificates and distinct_numbers must be equal, duplicates 0.
select
  count(certificate_number)          as total_certificates,
  count(distinct certificate_number) as distinct_numbers,
  count(certificate_number) - count(distinct certificate_number) as duplicates
from verified_hours;

-- 3. The database enforces it, not convention.
--    Expect is_nullable = NO and a column_default calling the generator.
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'verified_hours'
  and column_name  = 'certificate_number';

-- 4. The UNIQUE constraint physically exists.
--    Expect one row, with UNIQUE in the definition.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename  = 'verified_hours'
  and indexdef ilike '%certificate_number%';

-- 5. The record is still append-only, so a number can't be edited or
--    reassigned after issue. Expect the update/delete guard to be present
--    and enabled ('O' = enabled in origin mode; 'D' would mean disabled).
select tgname as trigger_name,
       case tgenabled when 'D' then 'DISABLED' else 'enabled' end as status
from pg_trigger
where tgrelid = 'public.verified_hours'::regclass
  and not tgisinternal;

-- 6. Any certificate that can't be rendered — a record whose counterparties
--    have gone missing. Expect 0 rows.
select v.certificate_number,
       v.student_id, v.org_id, v.opportunity_id
from verified_hours v
left join students               s on s.id = v.student_id
left join organizations          o on o.id = v.org_id
left join volunteer_opportunities p on p.id = v.opportunity_id
where s.id is null or o.id is null or p.id is null;

-- 7. Every issued number, newest first — spot-check the format.
select certificate_number, date, hours, verified_at
from verified_hours
order by verified_at desc
limit 25;
