import { readFile, readdir } from 'node:fs/promises'

// Auth is simulated only inside disposable local databases, never a Supabase project.
export async function installSharedSchema(db) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
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
  if (files.length !== 8) throw new Error('Esta revisión requiere exactamente las ocho migraciones pendientes.')
  for (const file of files) {
    try { await db.exec(await readFile('supabase/migrations/' + file, 'utf8')) }
    catch (error) { throw new Error(file + ': ' + error.message, { cause: error }) }
  }
}
