-- Auditoría del catálogo después de las ocho migraciones base y la incremental de caseta. No crea datos.
-- Ejecutar como el propietario de las migraciones en un proyecto de prueba.
begin;
set transaction read only;

do $$
declare
  item record;
  permission text;
  authenticated_definers text[] := array[
    'accesshome_private.current_actor()',
    'accesshome_private.is_admin(uuid)',
    'accesshome_private.is_resident_of(uuid)',
    'accesshome_private.owns_agenda(uuid)',
    'accesshome_private.require_actor(text)',
    'accesshome_private.manage_community(text,uuid,jsonb)',
    'accesshome_private.assign_principal(uuid,uuid)',
    'accesshome_private.manage_household(text,uuid,uuid,jsonb)',
    'accesshome_private.manage_contact(text,uuid,jsonb,uuid)',
    'accesshome_private.invitation_details(uuid)',
    'accesshome_private.create_invitation(jsonb)',
    'accesshome_private.cancel_invitation(uuid)',
    'accesshome_private.public_invitation(text,jsonb)',
    'accesshome_private.active_access_invitations()',
    'accesshome_private.validate_access(text,uuid)',
    'accesshome_private.create_report(jsonb)',
    'accesshome_private.advance_report(uuid,text)',
    'accesshome_private.guard_dashboard()',
    'accesshome_private.guard_history(text,integer)'
  ];
begin
  foreach permission in array array['anon','authenticated','service_role'] loop
    if has_schema_privilege(permission,'accesshome','CREATE')
      or has_schema_privilege(permission,'accesshome_private','CREATE') then
      raise exception 'CREATE inesperado para %',permission;
    end if;
  end loop;
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
      raise exception 'Las escrituras deben pasar por RPCs autorizados';
  end if;
  for item in select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'accesshome_private'
  loop
    if has_function_privilege('anon', item.oid, 'EXECUTE')
      and item.oid <> 'accesshome_private.public_invitation(text,jsonb)'::regprocedure then
      raise exception 'Función interna ejecutable por anon: %', item.proname;
    end if;
    if not coalesce('search_path=""' = any(item.proconfig), false) then
      raise exception 'Revisar contexto de función interna: %', item.proname;
    end if;
  end loop;
  for item in select p.oid,p.proname,p.proconfig,p.proacl,p.proowner,p.prosecdef,n.nspname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('accesshome','accesshome_private')
  loop
    if item.nspname='accesshome' and item.prosecdef then
      raise exception 'SECURITY DEFINER en esquema expuesto: %',item.proname;
    end if;
    if not coalesce('search_path=""'=any(item.proconfig),false) then
      raise exception 'search_path inseguro: %',item.proname;
    end if;
    if has_function_privilege('service_role',item.oid,'EXECUTE') then
      raise exception 'EXECUTE no requerido para service_role: %',item.proname;
    end if;
    if item.prosecdef and has_function_privilege('authenticated',item.oid,'EXECUTE')
      is distinct from (item.oid = any(authenticated_definers::regprocedure[])) then
      raise exception 'Revisar EXECUTE autenticado de función privilegiada: %',item.proname;
    end if;
    if exists(select 1 from aclexplode(coalesce(item.proacl,acldefault('f',item.proowner))) where grantee=0 and privilege_type='EXECUTE') then
      raise exception 'Ejecución PUBLIC inesperada: %',item.proname;
    end if;
    if has_function_privilege('anon',item.oid,'EXECUTE') and item.oid not in (
      'accesshome.backend_health()'::regprocedure,
      'accesshome.public_invitation(text,jsonb)'::regprocedure,
      'accesshome_private.public_invitation(text,jsonb)'::regprocedure
    ) then
      raise exception 'RPC anónimo inesperado: %',item.proname;
    end if;
  end loop;
end;
$$;

rollback;
