-- Reports: retention on reporter deletion + duplicate-report throttling.
--
-- 1. `reports.reporter_id` was `on delete cascade` against profiles — so
--    if the person who reported abusive content later deletes their own
--    account (for any unrelated reason), the report itself vanished with
--    them. That destroys moderation evidence for content that may still
--    be live and still be a problem. Account-deletion audit guidance:
--    "do not blindly delete moderation records if retention is required
--    for abuse prevention." Switched to ON DELETE SET NULL — the report
--    survives, just no longer attributable to a specific (now-deleted)
--    account. The column has to become nullable for that to be possible.
--
-- 2. Nothing stopped a user from filing the same report against the same
--    target repeatedly. A partial unique index allows at most one OPEN
--    report per (reporter, target) — once it's reviewed/dismissed/
--    actioned, the same reporter can file a new one if the problem
--    recurs, but they can't spam-flood a single still-open report.

do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'reports'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'reporter_id';

  if fk_name is not null then
    execute format('alter table public.reports drop constraint %I', fk_name);
  end if;
end $$;

alter table public.reports alter column reporter_id drop not null;

alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;

create unique index if not exists reports_one_open_per_reporter_target
  on public.reports (reporter_id, target_type, target_id)
  where status = 'open' and reporter_id is not null;
