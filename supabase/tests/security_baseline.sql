-- Auditoría del catálogo después de aplicar 001–003. No crea usuarios ni datos.
-- Ejecutar como el propietario de las migraciones en un proyecto de prueba.
begin;
set transaction read only;

do $$
declare
  item record;
  permission text;
begin
  if (select count(*) from pg_tables where schemaname = 'accesshome') <> 10 then
    raise exception 'Se esperaban diez tablas de AccessHome';
  end if;
  if to_regclass('accesshome_private.invitation_tokens') is null then
    raise exception 'Falta la tabla privada de tokens';
  end if;
  for item in select c.oid, n.nspname, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('accesshome', 'accesshome_private') and c.relkind = 'r'
  loop
    if not item.relrowsecurity then raise exception 'RLS desactivado en %', item.relname; end if;
    foreach permission in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('anon', item.oid, permission) then
        raise exception 'anon tiene % en %', permission, item.relname;
      end if;
      if (permission <> 'SELECT' or item.nspname = 'accesshome_private')
        and has_table_privilege('authenticated', item.oid, permission) then
        raise exception 'authenticated tiene % inesperado en %', permission, item.relname;
      end if;
    end loop;
    if item.nspname = 'accesshome' and not has_table_privilege('authenticated', item.oid, 'SELECT') then
      raise exception 'Falta SELECT autenticado en %', item.relname;
    end if;
  end loop;
  if (select count(*) from pg_policies where schemaname = 'accesshome' and cmd = 'SELECT') <> 10 then
    raise exception 'Faltan políticas de lectura';
  end if;
  if exists (select 1 from pg_policies where schemaname in ('accesshome', 'accesshome_private') and cmd <> 'SELECT') then
    raise exception 'La base preparatoria no debe habilitar escrituras';
  end if;
  for item in select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'accesshome_private'
  loop
    if has_function_privilege('anon', item.oid, 'EXECUTE') then
      raise exception 'Función interna ejecutable por anon: %', item.proname;
    end if;
    if not item.prosecdef or not coalesce('search_path=""' = any(item.proconfig), false) then
      raise exception 'Revisar contexto de función interna: %', item.proname;
    end if;
  end loop;
end;
$$;

rollback;
