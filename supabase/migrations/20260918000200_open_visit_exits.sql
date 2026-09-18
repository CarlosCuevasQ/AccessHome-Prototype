begin;

-- One extra public boolean, derived from the ledger in the same snapshot as
-- the invitation. No token rotation, expiry extension, or historical changes.
create or replace function accesshome_private.public_invitation(token text, vehicle jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare projection jsonb;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if not accesshome_private.public_request_allowed(token) then return jsonb_build_object('error','Demasiadas consultas. Espera un minuto.'); end if;
  if vehicle is not null and vehicle<>'null'::jsonb then
    return jsonb_build_object('error','La consulta pública es de solo lectura. El residente debe definir el vehículo al crear la invitación.');
  end if;
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select jsonb_build_object('token',token,'visitorName',v.visitor_name,'residenceName',v.residence_name,
    'condominiumName',c.name,'startsAt',v.starts_at,'expiresAt',v.expires_at,
    'status',case when v.status='activa' and v.expires_at<=clock_timestamp() then 'expirada' else v.status::text end,
    'hasOpenEntry',
    (select count(*)=1 from accesshome.access_records e where e.invitation_id=v.id and e.direction='entrada')
    and not exists(select 1 from accesshome.access_records x where x.invitation_id=v.id and x.direction='salida'))
    into projection
    from accesshome.invitations v
    join accesshome_private.invitation_tokens t on t.invitation_id=v.id
    join accesshome.condominiums c on c.id=v.condominium_id
    where t.token_value=token;
  return projection;
end $$;

-- The entry record ID is the selection handle, never the public token.
-- Pagination covers all open visits, including entries older than seven days.
create function accesshome_private.guard_open_visits(page integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles; zone text; records jsonb;
begin
  actor:=accesshome_private.require_guard();
  if page is null or page<0 or page>10000 then raise exception 'Página no válida' using errcode='22023'; end if;
  select time_zone into zone from accesshome.condominiums where id=actor.condominium_id;
  select coalesce(jsonb_agg(accesshome_private.guard_access_dto(r) order by r.occurred_at,r.id),'[]'::jsonb)
    into records from (
      select e.* from accesshome.access_records e
      where e.condominium_id=actor.condominium_id and e.direction='entrada'
        and not exists(select 1 from accesshome.access_records x where x.invitation_id=e.invitation_id and x.direction='salida')
      order by e.occurred_at,e.id limit 51 offset page*50
    ) r;
  return jsonb_build_object('timeZone',zone,'hasMore',jsonb_array_length(records)>50,'records',records-50);
end $$;

create function accesshome_private.guard_register_exit(entry_id uuid, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles; entry accesshome.access_records; prior accesshome.access_records;
  i accesshome.invitations; access_token text;
begin
  actor:=accesshome_private.require_guard();
  if entry_id is null or request_id is null then raise exception 'Identificador de operación no válido' using errcode='22023'; end if;
  select * into entry from accesshome.access_records e
    where e.id=entry_id and e.direction='entrada' and e.condominium_id=actor.condominium_id;
  if entry.id is null then
    return jsonb_build_object('authorized',false,'reason','not_found','message','Entrada no encontrada. Actualiza las visitas pendientes.');
  end if;
  -- Same lock order as validate_access and cancellation. Hold both locks while
  -- checking the explicit exit intent and invoking the existing atomic engine.
  perform id from accesshome.residences where id=entry.residence_id for share;
  select * into i from accesshome.invitations where id=entry.invitation_id for update;
  select * into prior from accesshome.access_records r where r.request_id=guard_register_exit.request_id;
  if prior.id is not null then
    if prior.invitation_id<>i.id or prior.validated_by<>actor.user_id or prior.method<>'MANUAL' or prior.direction<>'salida' then
      raise exception 'Identificador de operación no disponible' using errcode='42501';
    end if;
    -- A replay may recover only the same exit, never a previous entry.
  elsif i.used_uses<>1 or i.status='completada'
    or (select count(*) from accesshome.access_records e where e.invitation_id=i.id and e.direction='entrada')<>1
    or exists(select 1 from accesshome.access_records x where x.invitation_id=i.id and x.direction='salida') then
    return jsonb_build_object('authorized',false,'reason','invalid_sequence','message','Esta visita ya no tiene una entrada abierta. Actualiza la lista.');
  end if;
  select token_value into access_token from accesshome_private.invitation_tokens where invitation_id=i.id;
  return accesshome_private.validate_access(access_token,request_id,'MANUAL');
end $$;

create function accesshome.guard_open_visits(page integer default 0) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.guard_open_visits($1);
$$;
create function accesshome.guard_register_exit(entry_id uuid, request_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.guard_register_exit($1,$2);
$$;

revoke all on function accesshome_private.guard_open_visits(integer),accesshome_private.guard_register_exit(uuid,uuid),
  accesshome.guard_open_visits(integer),accesshome.guard_register_exit(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.guard_open_visits(integer),accesshome_private.guard_register_exit(uuid,uuid),
  accesshome.guard_open_visits(integer),accesshome.guard_register_exit(uuid,uuid) to authenticated;
revoke all on function accesshome_private.public_invitation(text,jsonb),accesshome.public_invitation(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.public_invitation(text,jsonb),accesshome.public_invitation(text,jsonb) to anon,authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,
    'publicInvitationVersion',3,'guardScanningVersion',1,'openVisitExitsVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;

commit;
