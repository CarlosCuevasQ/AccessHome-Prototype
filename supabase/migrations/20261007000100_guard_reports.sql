begin;

-- Residential reports require a residence and have an editable issue workflow.
-- Shift closures instead preserve an immutable, condominium-wide snapshot.
create table accesshome.guard_shift_reports (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  guard_user_id uuid not null,
  guard_name varchar(150) not null,
  condominium_name text not null,
  time_zone text not null,
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  generated_at timestamptz not null check (generated_at >= period_end),
  metrics jsonb not null check (jsonb_typeof(metrics)='object'),
  source_ids jsonb not null check (jsonb_typeof(source_ids)='object'),
  metric_version integer not null default 1 check (metric_version=1),
  notes varchar(2000) not null default '',
  incidents varchar(2000) not null default '',
  status text not null default 'finalizado' check (status='finalizado'),
  request_id uuid not null unique,
  command_input jsonb not null,
  foreign key(guard_user_id,condominium_id) references accesshome.profiles(user_id,condominium_id),
  unique(condominium_id,guard_user_id,period_start,period_end)
);
create index guard_reports_period_idx on accesshome.guard_shift_reports(condominium_id,period_start desc,id);
alter table accesshome.guard_shift_reports enable row level security;
revoke all on accesshome.guard_shift_reports from public,anon,authenticated,service_role;
-- RPC-only reads: row-level policies do not hide internal audit/idempotency columns.
-- Keep RLS as defense in depth, but grant no table or column SELECT to clients.
create policy guard_reports_read on accesshome.guard_shift_reports for select to authenticated using (
  accesshome_private.is_admin(condominium_id) or exists (
    select 1 from accesshome_private.current_actor() a where a.role='guard'
      and a.condominium_id=guard_shift_reports.condominium_id and a.user_id=guard_shift_reports.guard_user_id
  )
);

create function accesshome_private.guard_report_dto(r accesshome.guard_shift_reports) returns jsonb
language sql stable security invoker set search_path='' as $$
  select to_jsonb(r)-'source_ids'-'request_id'-'command_input';
$$;

-- SQL owns wall-clock -> UTC conversion. The browser never applies an offset.
create function accesshome_private.shift_instant(value text, zone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
declare local_value timestamp; instant timestamptz;
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'Fecha del turno no válida' using errcode='22023'; end if;
  local_value:=value::timestamp;
  instant:=local_value at time zone zone;
  if to_char(instant at time zone zone,'YYYY-MM-DD"T"HH24:MI')<>value then
    raise exception 'Hora inexistente en la zona del condominio' using errcode='22023'; end if;
  return instant;
end $$;

-- One SQL statement/MVCC snapshot for ALL counters and their audit references.
-- Pending exits are current at generation, irrespective of the selected period.
create function accesshome_private.shift_snapshot(condo uuid, starts timestamptz, ends timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
  with sources as (
    select jsonb_build_object(
      'visitorEntries',coalesce((select jsonb_agg(id order by id) from accesshome.access_records where condominium_id=condo and direction='entrada' and occurred_at>=starts and occurred_at<ends),'[]'),
      'visitorExits',coalesce((select jsonb_agg(id order by id) from accesshome.access_records where condominium_id=condo and direction='salida' and occurred_at>=starts and occurred_at<ends),'[]'),
      'serviceArrivals',coalesce((select jsonb_agg(id order by id) from accesshome.service_events where condominium_id=condo and operation='register' and occurred_at>=starts and occurred_at<ends),'[]'),
      'serviceEntries',coalesce((select jsonb_agg(id order by id) from accesshome.service_events where condominium_id=condo and operation='allow' and occurred_at>=starts and occurred_at<ends),'[]'),
      'serviceExits',coalesce((select jsonb_agg(id order by id) from accesshome.service_events where condominium_id=condo and operation='exit' and occurred_at>=starts and occurred_at<ends),'[]'),
      'serviceRejections',coalesce((select jsonb_agg(id order by id) from accesshome.service_events where condominium_id=condo and operation='reject' and occurred_at>=starts and occurred_at<ends),'[]'),
      'openVisits',coalesce((select jsonb_agg(e.id order by e.id) from accesshome.access_records e where e.condominium_id=condo and e.direction='entrada' and not exists(select 1 from accesshome.access_records x where x.invitation_id=e.invitation_id and x.direction='salida')),'[]'),
      'openServices',coalesce((select jsonb_agg(e.id order by e.id) from accesshome.service_events e where e.condominium_id=condo and e.operation='allow' and not exists(select 1 from accesshome.service_events x where x.service_id=e.service_id and x.operation='exit')),'[]')
    ) as ids
  ) select jsonb_build_object('source_ids',ids,'metrics',
    (select jsonb_object_agg(key,jsonb_array_length(value)) from jsonb_each(ids)) || jsonb_build_object('visitorRejections',null)) from sources;
$$;

create function accesshome_private.guard_reports(operation text, input jsonb default '{}', request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a accesshome.profiles; c accesshome.condominiums; r accesshome.guard_shift_reports;
  starts timestamptz; ends timestamptz; instant timestamptz; snap jsonb; k text; allowed text[];
  page integer; from_day date; to_day date; guard_id uuid; records jsonb;
begin
  if exists(select 1 from accesshome_private.current_actor() where role='guard') then a:=accesshome_private.require_guard();
  else a:=accesshome_private.require_actor('admin'); end if;
  if operation is null or operation not in ('context','preview','generate','list','detail')
    or input is null or jsonb_typeof(input)<>'object' then raise exception 'Operación no válida' using errcode='22023'; end if;
  if operation in ('preview','generate') and a.role<>'guard' then raise exception 'Solo guardias pueden cerrar turno' using errcode='42501'; end if;
  allowed:=case operation when 'context' then array[]::text[] when 'preview' then array['start','end']
    when 'generate' then array['start','end','notes','incidents'] when 'detail' then array['id'] else array['from','to','guard','page'] end;
  for k in select jsonb_object_keys(input) loop
    if not k=any(allowed) or (k<>'page' and jsonb_typeof(input->k)<>'string') then
      raise exception 'Campos de reporte no válidos' using errcode='22023'; end if;
  end loop;
  select * into c from accesshome.condominiums where id=a.condominium_id for share;
  if operation='context' then
    return jsonb_build_object('timeZone',c.time_zone,'condominiumName',c.name,'guardName',a.display_name,
      'start',to_char((clock_timestamp()-interval '8 hours') at time zone c.time_zone,'YYYY-MM-DD"T"HH24:MI'),
      'end',to_char(clock_timestamp() at time zone c.time_zone,'YYYY-MM-DD"T"HH24:MI'),
      'guards',case when a.role='admin' then coalesce((select jsonb_agg(jsonb_build_object('id',g.guard_user_id,'name',g.guard_name)) from
        (select distinct on (guard_user_id) guard_user_id,guard_name from accesshome.guard_shift_reports where condominium_id=a.condominium_id order by guard_user_id,generated_at desc) g),'[]') else '[]'::jsonb end);
  end if;
  if operation='detail' then
    select * into r from accesshome.guard_shift_reports where id=(input->>'id')::uuid and condominium_id=a.condominium_id
      and (a.role='admin' or guard_user_id=a.user_id);
    if r.id is null then raise exception 'Reporte no disponible' using errcode='42501'; end if;
    return accesshome_private.guard_report_dto(r);
  end if;
  if operation='list' then
    page:=coalesce((input->>'page')::integer,0);
    from_day:=nullif(input->>'from','')::date; to_day:=nullif(input->>'to','')::date;
    guard_id:=nullif(input->>'guard','')::uuid;
    if page<0 or page>10000 or (from_day is not null and to_day<from_day) then raise exception 'Filtros no válidos' using errcode='22023'; end if;
    select coalesce(jsonb_agg(accesshome_private.guard_report_dto(v) order by v.period_start desc,v.id desc),'[]') into records from (
      select * from accesshome.guard_shift_reports where condominium_id=a.condominium_id
        and (a.role='admin' or guard_user_id=a.user_id) and (guard_id is null or guard_user_id=guard_id)
        and (from_day is null or (period_start at time zone time_zone)::date>=from_day)
        and (to_day is null or (period_start at time zone time_zone)::date<=to_day)
      order by period_start desc,id desc limit 51 offset page*50
    ) v;
    return jsonb_build_object('records',records-50,'hasMore',jsonb_array_length(records)>50);
  end if;
  -- Request lock precedes period lock consistently, including retries.
  if operation='generate' then
    if request_id is null then raise exception 'Falta identificador de operación' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('accesshome.shift.request:'||request_id::text,0));
    select * into r from accesshome.guard_shift_reports s where s.request_id=guard_reports.request_id;
    if r.id is not null then
      if r.guard_user_id<>a.user_id or r.condominium_id<>a.condominium_id or r.command_input<>input then
        raise exception 'Identificador de operación no disponible' using errcode='42501'; end if;
      return jsonb_build_object('report',accesshome_private.guard_report_dto(r),'replayed',true);
    end if;
  end if;
  starts:=accesshome_private.shift_instant(input->>'start',c.time_zone);
  ends:=accesshome_private.shift_instant(input->>'end',c.time_zone);
  if starts>=ends or ends-starts>interval '7 days' or ends>clock_timestamp() then
    raise exception 'El periodo debe haber terminado, durar como máximo 7 días y tener inicio anterior al fin' using errcode='22023'; end if;
  if operation='generate' then
    if length(coalesce(input->>'notes',''))>2000 or length(coalesce(input->>'incidents',''))>2000
      or coalesce(input->>'notes','') ~ '[<>]' or coalesce(input->>'incidents','') ~ '[<>]' then
      raise exception 'Usa texto simple de hasta 2000 caracteres por campo, sin etiquetas HTML' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('accesshome.shift.period:'||a.user_id::text||':'||extract(epoch from starts)::text||':'||extract(epoch from ends)::text,0));
    if exists(select 1 from accesshome.guard_shift_reports where condominium_id=a.condominium_id and guard_user_id=a.user_id and period_start=starts and period_end=ends) then
      raise exception 'Ya cerraste este periodo. Consulta el reporte existente'; end if;
  end if;
  instant:=clock_timestamp();
  snap:=accesshome_private.shift_snapshot(a.condominium_id,starts,ends);
  if operation='preview' then
    return jsonb_build_object('guard_name',a.display_name,'condominium_name',c.name,'time_zone',c.time_zone,
      'period_start',starts,'period_end',ends,'generated_at',instant,'metrics',snap->'metrics');
  end if;
  insert into accesshome.guard_shift_reports(condominium_id,guard_user_id,guard_name,condominium_name,time_zone,
    period_start,period_end,generated_at,metrics,source_ids,notes,incidents,request_id,command_input)
    values(a.condominium_id,a.user_id,a.display_name,c.name,c.time_zone,starts,ends,instant,snap->'metrics',snap->'source_ids',
      trim(coalesce(input->>'notes','')),trim(coalesce(input->>'incidents','')),request_id,input) returning * into r;
  return jsonb_build_object('report',accesshome_private.guard_report_dto(r),'replayed',false);
end $$;

create function accesshome.guard_reports(operation text, input jsonb default '{}', request_id uuid default null) returns jsonb
language sql volatile security invoker set search_path='' as $$ select accesshome_private.guard_reports($1,$2,$3); $$;
revoke all on function accesshome_private.guard_report_dto(accesshome.guard_shift_reports),accesshome_private.shift_instant(text,text),
  accesshome_private.shift_snapshot(uuid,timestamptz,timestamptz),accesshome_private.guard_reports(text,jsonb,uuid),accesshome.guard_reports(text,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function accesshome_private.guard_reports(text,jsonb,uuid),accesshome.guard_reports(text,jsonb,uuid) to authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',3,
   'guardScanningVersion',1,'openVisitExitsVersion',1,'serviceAccessVersion',1,'guardReportsVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;
commit;
