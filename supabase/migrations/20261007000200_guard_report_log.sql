begin;

-- Preserve the original counter calculation. Add only private references, captured
-- in the same MVCC snapshot, for lifecycle context and cancellation events.
alter function accesshome_private.shift_snapshot(uuid,timestamptz,timestamptz) rename to shift_snapshot_v1;
create function accesshome_private.shift_snapshot(condo uuid, starts timestamptz, ends timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
  with base as materialized (select accesshome_private.shift_snapshot_v1(condo,starts,ends) as data),
  refs as (
    select data, data->'source_ids' as ids,
      coalesce((select jsonb_agg(id order by id) from accesshome.service_events
        where condominium_id=condo and operation='cancel' and occurred_at>=starts and occurred_at<ends),'[]') as cancelled
    from base
  ), context as (
    select data, ids, cancelled,
      coalesce((select jsonb_agg(x.id order by x.id) from accesshome.access_records x
        where x.condominium_id=condo and x.invitation_id in (
          select e.invitation_id from accesshome.access_records e where e.condominium_id=condo
            and e.id in (select value::uuid from jsonb_array_elements_text(ids->'visitorEntries'||(ids->'visitorExits')||(ids->'openVisits')))
        )),'[]') as visitors,
      coalesce((select jsonb_agg(x.id order by x.id) from accesshome.service_events x
        where x.condominium_id=condo and x.service_id in (
          select e.service_id from accesshome.service_events e where e.condominium_id=condo
            and e.id in (select value::uuid from jsonb_array_elements_text(ids->'serviceArrivals'||(ids->'serviceEntries')||(ids->'serviceExits')||(ids->'serviceRejections')||(ids->'openServices')||cancelled))
        )),'[]') as services
    from refs
  ) select jsonb_build_object('metrics',data->'metrics','source_ids',ids||jsonb_build_object(
    'detailVersion',1,'serviceCancellations',cancelled,'visitorContext',visitors,'serviceContext',services)) from context;
$$;
revoke all on function accesshome_private.shift_snapshot(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;

-- No direct SELECT grants: source_ids, request_id and command_input remain private.
-- All rows are selected by the report's saved references, never a client-supplied
-- condominium or source ID list. Historical reports receive a limited projection.
create function accesshome_private.guard_report_log(report_id uuid, kind text default 'all', page integer default 0, newest_first boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a accesshome.profiles; r accesshome.guard_shift_reports; ids jsonb; result jsonb;
begin
  if exists(select 1 from accesshome_private.current_actor() where role='guard') then a:=accesshome_private.require_guard();
  else a:=accesshome_private.require_actor('admin'); end if;
  select * into r from accesshome.guard_shift_reports where id=report_id and condominium_id=a.condominium_id
    and (a.role='admin' or guard_user_id=a.user_id);
  if r.id is null then raise exception 'Reporte no disponible' using errcode='42501'; end if;
  if kind is null or kind not in ('all','visitor','service') or page is null or page<0 or page>10000 or newest_first is null then
    raise exception 'Filtros de bitácora no válidos' using errcode='22023'; end if;
  ids:=r.source_ids;
  with visitor_ids as (
    select distinct value::uuid as id from jsonb_array_elements_text(ids->'visitorEntries'||(ids->'visitorExits')||(ids->'openVisits'))
  ), service_ids as (
    select distinct value::uuid as id from jsonb_array_elements_text(ids->'serviceArrivals'||(ids->'serviceEntries')||(ids->'serviceExits')||(ids->'serviceRejections')||(ids->'openServices')||coalesce(ids->'serviceCancellations','[]'))
  ), visitor_context as (
    select x.* from accesshome.access_records x where x.condominium_id=a.condominium_id and x.id in (
      select value::uuid from jsonb_array_elements_text(coalesce(ids->'visitorContext',ids->'visitorEntries'||(ids->'visitorExits')||(ids->'openVisits')))
    )
  ), service_context as (
    select x.* from accesshome.service_events x where x.condominium_id=a.condominium_id and x.id in (
      select value::uuid from jsonb_array_elements_text(coalesce(ids->'serviceContext',ids->'serviceArrivals'||(ids->'serviceEntries')||(ids->'serviceExits')||(ids->'serviceRejections')||(ids->'openServices')))
    )
  ), visitor_rows as (
    select e.id, e.occurred_at, 'visitor' as kind,
      jsonb_build_object('occurredAt',e.occurred_at,'type','visitor',
        'inPeriod',(ids->'visitorEntries'||(ids->'visitorExits')) ? e.id::text,
        'movement',case e.direction when 'entrada' then 'Entrada' else 'Salida' end,
        'name',e.visitor_name,'company','','category','','residence',e.residence_name,
        'vehicle',concat_ws(' ',nullif(e.vehicle_brand,''),nullif(e.vehicle_model,''),nullif(e.vehicle_color,'')),
        'plates',coalesce(e.vehicle_plates,''),'method',e.method,'result','Autorizado',
        'arrivalAt',null,'entryAt',en.occurred_at,'exitAt',ex.occurred_at,
        'pendingExit',coalesce((ids->'openVisits') ? en.id::text,false),
        'guard',coalesce(e.validator_name,''),'notes','') as dto
    from visitor_ids ref join accesshome.access_records e on e.id=ref.id and e.condominium_id=a.condominium_id
    left join visitor_context en on en.invitation_id=e.invitation_id and en.direction='entrada'
    left join visitor_context ex on ex.invitation_id=e.invitation_id and ex.direction='salida'
    where ((ids->'openVisits') ? e.id::text) or (e.occurred_at>=r.period_start and e.occurred_at<r.period_end)
  ), service_rows as (
    select e.id,e.occurred_at,'service' as kind,
      jsonb_build_object('occurredAt',e.occurred_at,'type','service',
        'inPeriod',(ids->'serviceArrivals'||(ids->'serviceEntries')||(ids->'serviceExits')||(ids->'serviceRejections')||coalesce(ids->'serviceCancellations','[]')) ? e.id::text,
        'movement',case e.operation when 'register' then 'Llegada' when 'allow' then 'Entrada' when 'exit' then 'Salida' when 'reject' then 'Rechazo' else 'Cancelación' end,
        'name',s.provider_name,'company',s.company,'category',s.category,'residence',s.residence_name,
        'vehicle','','plates',s.plates,'method',coalesce(e.method,''),
        'result',case e.operation when 'register' then 'Registrado' when 'allow' then 'En sitio' when 'exit' then 'Finalizado' when 'reject' then 'Rechazado' else 'Cancelado' end,
        'arrivalAt',s.registered_at,'entryAt',en.occurred_at,'exitAt',ex.occurred_at,
        'pendingExit',coalesce((ids->'openServices') ? en.id::text,false),
        'guard',e.actor_name,'notes',concat_ws(E'\n',nullif(s.notes,''),case when e.operation='reject' then nullif(e.reason,'') end)) as dto
    from service_ids ref join accesshome.service_events e on e.id=ref.id and e.condominium_id=a.condominium_id
    join accesshome.service_visits s on s.id=e.service_id and s.condominium_id=a.condominium_id
    left join service_context en on en.service_id=e.service_id and en.operation='allow'
    left join service_context ex on ex.service_id=e.service_id and ex.operation='exit'
    where ((ids->'openServices') ? e.id::text) or (e.occurred_at>=r.period_start and e.occurred_at<r.period_end)
  ), rows as (select * from visitor_rows union all select * from service_rows),
  filtered as (select * from rows where guard_report_log.kind='all' or rows.kind=guard_report_log.kind),
  ordered as (select *,row_number() over(order by
    case when not newest_first then occurred_at end asc,case when newest_first then occurred_at end desc,
    filtered.kind,filtered.id) as ordinal from filtered),
  paged as (select * from ordered order by ordinal limit 50 offset page*50)
  select jsonb_build_object('records',coalesce((select jsonb_agg(dto order by ordinal) from paged),'[]'),
    'total',(select count(*) from filtered),'hasMore',(select count(*) from filtered)>(page+1)*50,
    'timeZone',r.time_zone,'legacy',not(ids ? 'detailVersion')) into result;
  return result;
end $$;

create function accesshome.guard_report_log(report_id uuid, kind text default 'all', page integer default 0, newest_first boolean default false) returns jsonb
language sql volatile security invoker set search_path='' as $$ select accesshome_private.guard_report_log($1,$2,$3,$4); $$;
revoke all on function accesshome.guard_report_log(uuid,text,integer,boolean),accesshome_private.guard_report_log(uuid,text,integer,boolean)
  from public,anon,authenticated,service_role;
grant execute on function accesshome.guard_report_log(uuid,text,integer,boolean),accesshome_private.guard_report_log(uuid,text,integer,boolean) to authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',3,
   'guardScanningVersion',1,'openVisitExitsVersion',1,'serviceAccessVersion',1,'guardReportsVersion',1,'guardReportLogVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;
commit;
