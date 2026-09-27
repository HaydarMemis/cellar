import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const dir = new URL('../../migrations', import.meta.url).pathname;
export const migrationFiles = () => fs.readdirSync(dir).sort().map((f) => `${dir}/${f}`);
/** Builds a fresh DB with the auth/storage stubs, then applies `sqlFiles` in order (default: every migration). */
export async function setup(sqlFiles = migrationFiles()) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    grant usage on schema auth, storage, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    -- Supabase's default privileges: every function created in public is
    -- EXPLICITLY executable by anon/authenticated/service_role, so a bare
    -- 'revoke ... from public' in a migration does not remove anon's grant.
    -- Must run BEFORE the migrations (default privileges only affect
    -- objects created afterwards).
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const f of sqlFiles) await db.exec(fs.readFileSync(f, 'utf8'));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
                 grant select, insert, update, delete on storage.objects to anon, authenticated;`);
  return db;
}
export async function as(db, role, uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try { const r = await db.query(sql, params); return { ok: true, rows: r.rows, affected: r.affectedRows }; }
  catch (e) { return { ok: false, code: e.code, msg: e.message }; }
  finally { await db.exec('reset role'); }
}
export async function admin(db, sql) { await db.exec('reset role'); return db.exec(sql); }
