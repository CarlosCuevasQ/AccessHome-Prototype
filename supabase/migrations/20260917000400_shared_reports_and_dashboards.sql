begin;
create function accesshome.report_context() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences;
begin
 a:=accesshome_private.require_actor();
 select * into r from accesshome.residences where id=a.residence_id;
 return jsonb_build_object('administrative',a.role='admin','residenceName',r.name,
  'canCreate',coalesce(a.role='resident' and r.active and r.principal_user_id=a.user_id,false));
end $$;
create function accesshome.list_reports() returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
 perform accesshome_private.require_actor();
 return coalesce((select jsonb_agg(accesshome_private.camel(to_jsonb(r)) order by r.created_at desc) from accesshome.reports r),'[]');
end $$;
create function accesshome.report_details(target uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 perform accesshome_private.require_actor();
 select accesshome_private.camel(to_jsonb(r)) into result from accesshome.reports r where id=target;
 if result is null then raise exception 'Reporte no disponible' using errcode='42501'; end if;
 return result;
end $$;
create function accesshome_private.create_report(input jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences; new_id uuid;
begin
 a:=accesshome_private.require_actor('resident'); r:=accesshome_private.managed_residence(a.residence_id);
 perform accesshome_private.fields(input,array['title','category','description']);
 insert into accesshome.reports(condominium_id,residence_id,author_user_id,author_name,residence_name,title,category,description)
 values(a.condominium_id,r.id,a.user_id,a.display_name,r.name,trim(input->>'title'),(input->>'category')::accesshome.report_category,trim(input->>'description')) returning id into new_id;
 return new_id;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.create_report(input jsonb) returns uuid
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.create_report($1);
$$;
revoke all on function accesshome_private.create_report(jsonb) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.create_report(jsonb) to authenticated;
create function accesshome_private.advance_report(target uuid,next_status text) returns void language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; r accesshome.reports;
begin
 a:=accesshome_private.require_actor('admin');
 select * into r from accesshome.reports where id=target and condominium_id=a.condominium_id for update;
 if r.id is null then raise exception 'Reporte no disponible' using errcode='42501'; end if;
 if not coalesce((r.status='pendiente' and next_status='en_proceso') or (r.status='en_proceso' and next_status='completado'),false) then
  raise exception 'El reporte solo puede avanzar de pendiente a en proceso y después a completado';
 end if;
 update accesshome.reports set status=next_status::accesshome.report_status,updated_at=clock_timestamp() where id=r.id;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.advance_report(target uuid,next_status text) returns void
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.advance_report($1,$2);
$$;
revoke all on function accesshome_private.advance_report(uuid,text) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.advance_report(uuid,text) to authenticated;

create function accesshome_private.dashboard_counts(zone text) returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'vehicleCount',(select count(*) from accesshome.residence_vehicles),
 'activeInvitationCount',(select count(*) from accesshome.invitations i where accesshome_private.effective_status(i)='activa'),
 'pendingReportCount',(select count(*) from accesshome.reports where status='pendiente'),
 'recentAccess',coalesce((select jsonb_agg(accesshome_private.access_dto(r) order by r.occurred_at desc)
   from (select * from accesshome.access_records order by occurred_at desc limit 5) r),'[]'),
 'todayAccessCount',(select count(*) from accesshome.access_records where occurred_at>=((statement_timestamp() at time zone zone)::date)::timestamp at time zone zone
    and occurred_at<((statement_timestamp() at time zone zone)::date+1)::timestamp at time zone zone),
 'recentVisitCount',(select count(*) from accesshome.access_records where direction='entrada'
    and occurred_at>=((statement_timestamp() at time zone zone)::date-6)::timestamp at time zone zone
    and occurred_at<((statement_timestamp() at time zone zone)::date+1)::timestamp at time zone zone));
$$;
create function accesshome.admin_dashboard() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; c accesshome.condominiums;
begin
 a:=accesshome_private.require_actor('admin');
 select * into c from accesshome.condominiums where id=a.condominium_id;
 return accesshome_private.dashboard_counts(c.time_zone)||jsonb_build_object(
  'condominium',to_jsonb(c)-'time_zone'-'created_at','residenceCount',(select count(*) from accesshome.residences),
  'activeInhabitantCount',(select count(*) from accesshome.inhabitants where active));
end $$;
create function accesshome.resident_dashboard() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences; zone text;
begin
 a:=accesshome_private.require_actor('resident');
 select * into r from accesshome.residences where id=a.residence_id;
 select time_zone into zone from accesshome.condominiums where id=a.condominium_id;
 return accesshome_private.dashboard_counts(zone)||jsonb_build_object(
  'residence',accesshome_private.residence_dto(r),'canManage',r.active and r.principal_user_id=a.user_id,
  'isPrincipal',r.principal_user_id=a.user_id,'inhabitantCount',(select count(*) from accesshome.inhabitants));
end $$;
revoke all on function accesshome_private.dashboard_counts(text) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.dashboard_counts(text) to authenticated;
revoke all on function accesshome.report_context(),accesshome.list_reports(),accesshome.report_details(uuid),
 accesshome.create_report(jsonb),accesshome.advance_report(uuid,text),accesshome.admin_dashboard(),accesshome.resident_dashboard() from public,anon,authenticated,service_role;
grant execute on function accesshome.report_context(),accesshome.list_reports(),accesshome.report_details(uuid),
 accesshome.create_report(jsonb),accesshome.advance_report(uuid,text),accesshome.admin_dashboard(),accesshome.resident_dashboard() to authenticated;
-- These remove schema-specific defaults only; they cannot subtract global
-- default EXECUTE. Every future function still needs explicit REVOKE/GRANT
-- in its own transaction and a successful security_baseline audit.
alter default privileges in schema accesshome revoke execute on functions from public;
alter default privileges in schema accesshome_private revoke execute on functions from public;
commit;
