import { readFile, readdir } from 'node:fs/promises'

// Auth is simulated only inside disposable local databases, never a Supabase project.
// `before`: apply only versions older than that one (upgrade tests over a populated base).
// `roles: false`: a second database in the same cluster, where the roles already exist.
export async function installSharedSchema(db, { baseOnly = false, before = null, roles = true } = {}) {
  if (roles) await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `)
  await db.exec(`
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
  `)
  const files = (await readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort()
  if (files.length !== 18) throw new Error('Se esperan dieciocho migraciones, incluida la gestión de guardias.')
  const selected = baseOnly ? files.slice(0, 8) : before ? files.filter(file => file < before) : files
  if (before && selected.length === files.length) throw new Error('Versión límite inexistente: ' + before)
  for (const file of selected) {
    try { await db.exec(await readFile('supabase/migrations/' + file, 'utf8')) }
    catch (error) { throw new Error(file + ': ' + error.message, { cause: error }) }
  }
}
