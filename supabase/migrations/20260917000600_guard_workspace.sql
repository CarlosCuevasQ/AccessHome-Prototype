begin;

-- Incremental only: the eight deployed migrations and all domain data are retained.
-- Do not extend require_actor: existing admin/resident operations must still reject guards.
create function accesshome_private.require_guard() returns accesshome.profiles
language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles;
begin
  select p.* into actor from accesshome.profiles p
    join accesshome_private.current_actor() a on a.user_id=p.user_id
    where p.role='guard' and p.active and p.residence_id is null for share of p;
  if actor.user_id is null then
    raise exception 'Solo un guardia activo puede consultar la caseta' using errcode='42501';
  end if;
  return actor;
end $$;

create or replace function accesshome.session_profile() returns jsonb
language sql security invoker set search_path = '' as $$
  select accesshome_private.profile_dto(p) from accesshome.profiles p
    join accesshome_private.current_actor() a on a.user_id=p.user_id
    where p.role in ('admin','resident','guard');
$$;

-- No invitation tokens, phone numbers, host/account/residence IDs or private notes.
create function accesshome_private.guard_access_dto(record accesshome.access_records) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('id',record.id,'visitorName',record.visitor_name,
    'residenceName',record.residence_name,'type',record.direction,'method',record.method,
    'occurredAt',record.occurred_at,'vehicle',
    case when record.vehicle_plates is null then null else jsonb_build_object('plates',record.vehicle_plates) end);
$$;

create function accesshome_private.guard_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles; condo accesshome.condominiums;
  instant timestamptz:=statement_timestamp(); day_start timestamptz; day_end timestamptz;
begin
  actor:=accesshome_private.require_guard();
  select * into condo from accesshome.condominiums where id=actor.condominium_id;
  day_start:=(instant at time zone condo.time_zone)::date::timestamp at time zone condo.time_zone;
  day_end:=((instant at time zone condo.time_zone)::date+1)::timestamp at time zone condo.time_zone;
  return jsonb_build_object('guardName',actor.display_name,'condominiumName',condo.name,
    'timeZone',condo.time_zone,'serverTime',instant,
    'todayAccessCount',(select count(*) from accesshome.access_records r
      where r.condominium_id=actor.condominium_id and r.occurred_at>=day_start and r.occurred_at<day_end),
    'recentEntries',coalesce((select jsonb_agg(accesshome_private.guard_access_dto(r) order by r.occurred_at desc,r.id desc)
      from (select * from accesshome.access_records where condominium_id=actor.condominium_id
        and direction='entrada' order by occurred_at desc,id desc limit 5) r),'[]'::jsonb),
    'recentExits',coalesce((select jsonb_agg(accesshome_private.guard_access_dto(r) order by r.occurred_at desc,r.id desc)
      from (select * from accesshome.access_records where condominium_id=actor.condominium_id
        and direction='salida' order by occurred_at desc,id desc limit 5) r),'[]'::jsonb),
    -- Entry with no recorded exit, even if its invitation was later cancelled/expired.
    'pendingExitCount',(select count(*) from accesshome.access_records r
      where r.condominium_id=actor.condominium_id and r.direction='entrada'
        and not exists(select 1 from accesshome.access_records e
          where e.invitation_id=r.invitation_id and e.condominium_id=actor.condominium_id and e.direction='salida')),
    'pendingExits',coalesce((select jsonb_agg(accesshome_private.guard_access_dto(r) order by r.occurred_at,r.id)
      from (select * from accesshome.access_records entry
        where entry.condominium_id=actor.condominium_id and entry.direction='entrada'
          and not exists(select 1 from accesshome.access_records e
            where e.invitation_id=entry.invitation_id and e.condominium_id=actor.condominium_id and e.direction='salida')
        order by entry.occurred_at,entry.id limit 10) r),'[]'::jsonb));
end $$;

create function accesshome.guard_dashboard() returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.guard_dashboard();
$$;

create function accesshome_private.guard_history(movement text default '', page integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles; zone text; day_start timestamptz; day_end timestamptz; total bigint;
begin
  actor:=accesshome_private.require_guard();
  if movement is null or movement not in ('','entrada','salida') or page is null or page<0 or page>10000 then
    raise exception 'Filtros de caseta no válidos' using errcode='22023';
  end if;
  select time_zone into zone from accesshome.condominiums where id=actor.condominium_id;
  day_start:=((statement_timestamp() at time zone zone)::date-6)::timestamp at time zone zone;
  day_end:=((statement_timestamp() at time zone zone)::date+1)::timestamp at time zone zone;
  select count(*) into total from accesshome.access_records r where r.condominium_id=actor.condominium_id
    and r.occurred_at>=day_start and r.occurred_at<day_end and (movement='' or r.direction::text=movement);
  return jsonb_build_object('timeZone',zone,'from',day_start,'to',day_end,'hasMore',total>(page+1)*50,
    'records',coalesce((select jsonb_agg(accesshome_private.guard_access_dto(r) order by r.occurred_at desc,r.id desc)
      from (select * from accesshome.access_records where condominium_id=actor.condominium_id
        and occurred_at>=day_start and occurred_at<day_end and (movement='' or direction::text=movement)
        order by occurred_at desc,id desc limit 50 offset page*50) r),'[]'::jsonb));
end $$;

create function accesshome.guard_history(movement text default '', page integer default 0) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.guard_history($1,$2);
$$;

-- Owner-only provisioning. Auth users are created separately in the Dashboard.
-- Never convert existing residents/admins, move a guard, or silently reactivate it.
create function accesshome_private.provision_guard(auth_user_id uuid, condominium_id uuid, display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare existing accesshome.profiles;
begin
  if auth_user_id is null or condominium_id is null or coalesce(length(trim(display_name)),0) not between 1 and 150 then
    raise exception 'Indica usuario Auth, condominio y nombre válido' using errcode='22023';
  end if;
  perform id from auth.users where id=auth_user_id for update;
  if not found then raise exception 'Primero crea la cuenta en Supabase Auth'; end if;
  perform id from accesshome.condominiums c where c.id=provision_guard.condominium_id for share;
  if not found then raise exception 'Condominio inexistente'; end if;
  select * into existing from accesshome.profiles p where p.user_id=auth_user_id for update;
  if existing.user_id is not null then
    if existing.role<>'guard' or existing.condominium_id<>condominium_id or existing.residence_id is not null then
      raise exception 'La cuenta ya está vinculada; no se cambian roles ni condominios';
    end if;
    -- An identical provisioning call is harmless; state is managed separately.
    if existing.display_name<>trim(display_name) then raise exception 'El perfil ya existe con otro nombre'; end if;
    return;
  end if;
  insert into accesshome.profiles(user_id,condominium_id,display_name,role,active)
    values(auth_user_id,condominium_id,trim(display_name),'guard',true);
end $$;

create function accesshome_private.set_guard_active(auth_user_id uuid, condominium_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if enabled is null then raise exception 'Indica true o false' using errcode='22023'; end if;
  update accesshome.profiles p set active=enabled
    where p.user_id=auth_user_id and p.condominium_id=set_guard_active.condominium_id and p.role='guard';
  if not found then raise exception 'Guardia no encontrado en ese condominio'; end if;
end $$;

-- Preserve health schemaVersion compatibility; advertise this increment separately.
create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1);
$$;

revoke all on function accesshome_private.require_guard(),accesshome_private.guard_access_dto(accesshome.access_records),
  accesshome_private.guard_dashboard(),accesshome_private.guard_history(text,integer),
  accesshome_private.provision_guard(uuid,uuid,text),accesshome_private.set_guard_active(uuid,uuid,boolean)
  from public,anon,authenticated,service_role;
grant execute on function accesshome_private.guard_dashboard(),accesshome_private.guard_history(text,integer) to authenticated;
revoke all on function accesshome.guard_dashboard(),accesshome.guard_history(text,integer),accesshome.session_profile()
  from public,anon,authenticated,service_role;
grant execute on function accesshome.guard_dashboard(),accesshome.guard_history(text,integer),accesshome.session_profile() to authenticated;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;

-- Existing RLS remains restrictive: guard still sees only its own profile and condo
-- through tables. Operational data is returned solely by the scoped projections above.
commit;
