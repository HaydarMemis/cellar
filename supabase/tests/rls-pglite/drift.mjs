// Drift check: supabase/schema.sql is a hand-maintained "current state"
// snapshot of supabase/migrations. Build one DB from every migration and one
// from schema.sql alone, and fail if their catalogs differ (columns,
// constraints, indexes, policies, functions incl. bodies/security/ACLs,
// triggers). Also proves schema.sql applies cleanly to an empty database.
import { setup, migrationFiles } from './harness.mjs';

const schemaFile = new URL('../../schema.sql', import.meta.url).pathname;
const dump = `
  select 'COL ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') s
    from information_schema.columns where table_schema in ('public')
  union all select 'CON ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) || ' validated=' || convalidated
    from pg_constraint where connamespace = 'public'::regnamespace
  union all select 'IDX ' || schemaname || ' ' || indexname || ' ' || indexdef from pg_indexes where schemaname in ('public', 'storage')
  union all select 'POL ' || schemaname || '.' || tablename || ' ' || policyname || ' ' || cmd || ' roles=' || array_to_string(roles, ',')
                   || ' using=' || coalesce(qual, '') || ' check=' || coalesce(with_check, '')
    from pg_policies
  union all select 'RLS ' || c.oid::regclass || ' ' || c.relrowsecurity from pg_class c where c.relnamespace in ('public'::regnamespace, 'storage'::regnamespace) and c.relkind = 'r'
  union all select 'FN ' || p.oid::regprocedure || ' definer=' || p.prosecdef || ' acl=' || coalesce(p.proacl::text, 'default') || ' ' || pg_get_functiondef(p.oid)
    from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all select 'TRG ' || pg_get_triggerdef(t.oid) from pg_trigger t where not t.tgisinternal
  union all select 'BKT ' || id || ' ' || public || ' ' || file_size_limit || ' ' || array_to_string(allowed_mime_types, ',') from storage.buckets
  order by 1`;

const fromMigrations = await setup();
const fromSnapshot = await setup([schemaFile]);
const a = new Set((await fromMigrations.query(dump)).rows.map((r) => r.s));
const b = new Set((await fromSnapshot.query(dump)).rows.map((r) => r.s));
let drift = 0;
for (const x of a) if (!b.has(x)) { drift++; console.log('ONLY IN MIGRATIONS:', x.slice(0, 400)); }
for (const x of b) if (!a.has(x)) { drift++; console.log('ONLY IN schema.sql:', x.slice(0, 400)); }
console.log(`drift check: ${a.size} catalog entries from ${migrationFiles().length} migrations, ${b.size} from schema.sql, ${drift} differences`);
if (drift > 0) process.exit(1);
