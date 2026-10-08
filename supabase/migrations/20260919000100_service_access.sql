begin;

-- Services have a guard decision, not a resident invitation or public token.
create table accesshome.service_visits (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  residence_id uuid not null,
  residence_name text not null,
  category text not null check (category in ('paqueteria','comida','transporte','mantenimiento','otro')),
  company varchar(80) not null default '',
  provider_name varchar(100) not null default '',
  plates varchar(15) not null default '' check (plates='' or plates ~ '^[A-Z0-9][A-Z0-9 -]*$'),
  notes varchar(240) not null default '',
  status text not null default 'registrado' check (status in ('registrado','rechazado','en_sitio','finalizado','cancelado')),
  registered_by uuid not null,
  registered_at timestamptz not null,
  expires_at timestamptz not null check (expires_at>registered_at),
  check (category not in ('mantenimiento','otro') or length(trim(provider_name))>0),
  foreign key (residence_id,condominium_id) references accesshome.residences(id,condominium_id),
  foreign key (registered_by,condominium_id) references accesshome.profiles(user_id,condominium_id),
  unique(id,condominium_id)
);

-- Append-only through RPC. Arrival/decision events are explicitly NOT movements.
-- Actor/time snapshots and unique commands also support future shift reporting.
create table accesshome.service_events (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null,
  condominium_id uuid not null,
  operation text not null check (operation in ('register','allow','reject','cancel','exit')),
  actor_id uuid not null,
  actor_name varchar(150) not null,
  occurred_at timestamptz not null,
  method text check (method='MANUAL'),
  reason varchar(240) not null default '',
  request_id uuid not null unique,
  command_input jsonb not null,
  check ((operation in ('allow','exit') and method is not null) or (operation not in ('allow','exit') and method is null)),
  check (operation='reject' or reason=''),
  unique(service_id,operation),
  foreign key (service_id,condominium_id) references accesshome.service_visits(id,condominium_id),
  foreign key (actor_id,condominium_id) references accesshome.profiles(user_id,condominium_id)
);
create index service_visits_queue_idx on accesshome.service_visits(condominium_id,status,registered_at,id);
create index service_events_audit_idx on accesshome.service_events(condominium_id,occurred_at,id);
-- Exactly one decision, independent of which guard wins a race.
create unique index service_single_decision_idx on accesshome.service_events(service_id) where operation in ('allow','reject','cancel');

alter table accesshome.service_visits enable row level security;
alter table accesshome.service_events enable row level security;
revoke all on accesshome.service_visits,accesshome.service_events from public,anon,authenticated,service_role;
grant select on accesshome.service_visits,accesshome.service_events to authenticated;
create policy service_visits_admin_read on accesshome.service_visits for select to authenticated using (accesshome_private.is_admin(condominium_id));
create policy service_events_admin_read on accesshome.service_events for select to authenticated using (accesshome_private.is_admin(condominium_id));

create function accesshome_private.service_dto(v accesshome.service_visits) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',v.id,'residenceName',v.residence_name,'category',v.category,'company',v.company,
    'providerName',v.provider_name,'plates',v.plates,'notes',v.notes,'status',v.status,
    'registeredAt',v.registered_at,'expiresAt',v.expires_at,'expired',v.expires_at<=statement_timestamp(),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'operation',e.operation,'actorName',e.actor_name,
      'occurredAt',e.occurred_at,'method',e.method,'reason',e.reason) order by e.occurred_at,e.id)
      from accesshome.service_events e where e.service_id=v.id),'[]'::jsonb));
$$;

create function accesshome_private.service_context() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a accesshome.profiles;
begin
  a:=accesshome_private.require_guard();
  return jsonb_build_object('residences',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.number)
    from accesshome.residences r where r.condominium_id=a.condominium_id and r.active),'[]'::jsonb));
end $$;

create function accesshome_private.list_services(status_filter text default 'todos', page integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a accesshome.profiles; records jsonb; zone text;
begin
  if exists(select 1 from accesshome_private.current_actor() where role='guard') then a:=accesshome_private.require_guard();
  else a:=accesshome_private.require_actor('admin'); end if;
  if status_filter is null or status_filter not in ('todos','registrado','rechazado','en_sitio','finalizado','cancelado')
    or page is null or page<0 or page>10000 then raise exception 'Filtros de servicios no válidos' using errcode='22023'; end if;
  select time_zone into zone from accesshome.condominiums where id=a.condominium_id;
  select coalesce(jsonb_agg(accesshome_private.service_dto(v) order by v.registered_at desc,v.id desc),'[]'::jsonb)
    into records from (select * from accesshome.service_visits where condominium_id=a.condominium_id
      and (status_filter='todos' or status=status_filter) order by registered_at desc,id desc limit 51 offset page*50) v;
  return jsonb_build_object('records',records-50,'hasMore',jsonb_array_length(records)>50,'timeZone',zone,
    'registeredCount',(select count(*) from accesshome.service_visits where condominium_id=a.condominium_id and status='registrado'),
    'insideCount',(select count(*) from accesshome.service_visits where condominium_id=a.condominium_id and status='en_sitio'));
end $$;

create function accesshome_private.service_command(operation text, target uuid, input jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a accesshome.profiles; v accesshome.service_visits; prior accesshome.service_events; r accesshome.residences;
  instant timestamptz; next_status text; reason text; rid uuid; key text;
begin
  a:=accesshome_private.require_guard();
  if operation is null or operation not in ('register','allow','reject','cancel','exit') or request_id is null
    or input is null or jsonb_typeof(input)<>'object' then raise exception 'Operación de servicio no válida' using errcode='22023'; end if;
  if (operation='register' and target is not null) or (operation<>'register' and target is null) then
    raise exception 'Identificador de servicio no válido' using errcode='22023'; end if;
  -- Serialize even concurrent arrival retries before a service row exists.
  perform pg_advisory_xact_lock(hashtextextended('accesshome.service:'||request_id::text,0));
  select * into prior from accesshome.service_events e where e.request_id=service_command.request_id;
  if prior.id is not null then
    if prior.actor_id<>a.user_id or prior.condominium_id<>a.condominium_id or prior.operation<>operation
      or prior.command_input<>input or (operation<>'register' and prior.service_id<>target) then
      raise exception 'Identificador de operación no disponible' using errcode='42501'; end if;
    select * into v from accesshome.service_visits where id=prior.service_id;
    return jsonb_build_object('record',accesshome_private.service_dto(v),'replayed',true);
  end if;
  for key in select jsonb_object_keys(input) loop
    if (operation='register' and key not in ('residenceId','category','company','providerName','plates','notes'))
      or (operation='reject' and key<>'reason') or operation in ('allow','cancel','exit')
      or jsonb_typeof(input->key)<>'string' then raise exception 'Campos de servicio no válidos' using errcode='22023'; end if;
  end loop;
  if operation='register' then
    rid:=(input->>'residenceId')::uuid;
    select * into r from accesshome.residences where id=rid and condominium_id=a.condominium_id for share;
    if r.id is null or not r.active then raise exception 'Residencia activa no disponible' using errcode='42501'; end if;
    if coalesce(input->>'category','') not in ('paqueteria','comida','transporte','mantenimiento','otro') then
      raise exception 'Categoría no válida' using errcode='22023'; end if;
    instant:=clock_timestamp();
    insert into accesshome.service_visits(condominium_id,residence_id,residence_name,category,company,provider_name,plates,notes,
      registered_by,registered_at,expires_at)
    values(a.condominium_id,r.id,r.name,input->>'category',trim(coalesce(input->>'company','')),
      trim(coalesce(input->>'providerName','')),upper(trim(coalesce(input->>'plates',''))),trim(coalesce(input->>'notes','')),
      a.user_id,instant,instant+interval '30 minutes') returning * into v;
  else
    select residence_id into rid from accesshome.service_visits where id=target and condominium_id=a.condominium_id;
    if rid is null then raise exception 'Servicio no disponible' using errcode='42501'; end if;
    -- Preserve residence -> visit locking order and re-check after obtaining locks.
    select * into r from accesshome.residences where id=rid and condominium_id=a.condominium_id for share;
    select * into v from accesshome.service_visits where id=target and condominium_id=a.condominium_id for update;
    instant:=clock_timestamp();
    if operation='exit' then
      if v.status<>'en_sitio' or not exists(select 1 from accesshome.service_events e where e.service_id=v.id and e.operation='allow')
        or exists(select 1 from accesshome.service_events e where e.service_id=v.id and e.operation='exit') then
        raise exception 'No hay una entrada abierta para este servicio'; end if;
      next_status:='finalizado';
    else
      if v.status<>'registrado' or exists(select 1 from accesshome.service_events e where e.service_id=v.id and e.operation in ('allow','reject','cancel','exit')) then
        raise exception 'Este servicio ya recibió una decisión. Actualiza la lista'; end if;
      if operation='allow' and (not r.active or v.expires_at<=instant) then
        raise exception 'No se permite entrada: residencia inactiva o registro vencido'; end if;
      next_status:=case operation when 'allow' then 'en_sitio' when 'reject' then 'rechazado' else 'cancelado' end;
    end if;
    update accesshome.service_visits set status=next_status where id=v.id returning * into v;
  end if;
  reason:=case when operation='reject' then trim(coalesce(input->>'reason','')) else '' end;
  insert into accesshome.service_events(service_id,condominium_id,operation,actor_id,actor_name,occurred_at,method,reason,request_id,command_input)
    values(v.id,a.condominium_id,operation,a.user_id,a.display_name,instant,
      case when operation in ('allow','exit') then 'MANUAL' else null end,reason,request_id,input);
  return jsonb_build_object('record',accesshome_private.service_dto(v),'replayed',false);
end $$;

create function accesshome.service_context() returns jsonb
language sql volatile security invoker set search_path='' as $$ select accesshome_private.service_context(); $$;
create function accesshome.list_services(status_filter text default 'todos', page integer default 0) returns jsonb
language sql volatile security invoker set search_path='' as $$ select accesshome_private.list_services($1,$2); $$;
create function accesshome.service_command(operation text, target uuid, input jsonb, request_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select accesshome_private.service_command($1,$2,$3,$4); $$;

revoke all on function accesshome_private.service_dto(accesshome.service_visits),accesshome_private.service_context(),
  accesshome_private.list_services(text,integer),accesshome_private.service_command(text,uuid,jsonb,uuid),
  accesshome.service_context(),accesshome.list_services(text,integer),accesshome.service_command(text,uuid,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function accesshome_private.service_context(),accesshome_private.list_services(text,integer),
  accesshome_private.service_command(text,uuid,jsonb,uuid),accesshome.service_context(),accesshome.list_services(text,integer),
  accesshome.service_command(text,uuid,jsonb,uuid) to authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',3,
   'guardScanningVersion',1,'openVisitExitsVersion',1,'serviceAccessVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;
commit;
