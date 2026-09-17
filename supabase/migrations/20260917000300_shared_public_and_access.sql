begin;
-- Fixed-size buckets prevent unbounded anonymous storage. Requests commit their
-- rate-limit charge even for invalid tokens. No token/IP is stored in this table.
create table accesshome_private.public_request_buckets (
  bucket integer primary key check(bucket between 0 and 255),
  window_start timestamptz not null, requests integer not null
);
alter table accesshome_private.public_request_buckets enable row level security;
revoke all on accesshome_private.public_request_buckets from public,anon,authenticated,service_role;
create function accesshome_private.public_request_allowed(token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare count_now integer; bucket_id integer; instant timestamptz:=clock_timestamp();
begin
  bucket_id:=get_byte(decode(md5(left(coalesce(token,''),256)),'hex'),0);
  insert into accesshome_private.public_request_buckets as b(bucket,window_start,requests) values(bucket_id,instant,1)
    on conflict(bucket) do update set
      window_start=case when b.window_start<instant-interval '1 minute' then instant else b.window_start end,
      requests=case when b.window_start<instant-interval '1 minute' then 1 else least(b.requests+1,241) end
    returning requests into count_now;
  return count_now<=240;
end $$;

create function accesshome_private.public_invitation(token text, vehicle jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i accesshome.invitations; r accesshome.residences; iid uuid; state text; can_add boolean;
begin
  if not accesshome_private.public_request_allowed(token) then return jsonb_build_object('error','Demasiadas consultas. Espera un minuto.'); end if;
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select invitation_id into iid from accesshome_private.invitation_tokens where token_value=token;
  if iid is null then return null; end if;
  -- Same house -> invitation lock order as creation, cancellation and validation.
  select h.* into r from accesshome.residences h join accesshome.invitations v on v.residence_id=h.id where v.id=iid for share of h;
  select * into i from accesshome.invitations where id=iid for update;
  state:=case when i.status='activa' and i.expires_at<=clock_timestamp() then 'expirada' else i.status::text end;
  can_add:=i.vehicle_plates is null and i.used_uses=0 and state='activa' and r.active;
  if vehicle is not null and vehicle<>'null'::jsonb then
    if not can_add then return jsonb_build_object('error','Solo puedes añadir un vehículo una vez, antes de entrar y con una invitación activa.'); end if;
    begin
      perform accesshome_private.fields(vehicle,array['plates','brand','model','color']);
      if coalesce(trim(vehicle->>'plates'),'')='' then raise exception 'Placas obligatorias'; end if;
      update accesshome.invitations set vehicle_plates=upper(trim(vehicle->>'plates')),vehicle_brand=coalesce(trim(vehicle->>'brand'),''),
        vehicle_model=coalesce(trim(vehicle->>'model'),''),vehicle_color=coalesce(trim(vehicle->>'color'),'') where id=i.id returning * into i;
    exception when others then return jsonb_build_object('error','Revisa los datos y las placas del vehículo.');
    end;
    can_add:=false;
  end if;
  return jsonb_build_object('token',token,'visitorName',i.visitor_name,'residenceName',i.residence_name,'inviterName',i.inviter_name,
    'startsAt',i.starts_at,'expiresAt',i.expires_at,'vehicle',accesshome_private.visit_vehicle(i.vehicle_plates,i.vehicle_brand,i.vehicle_model,i.vehicle_color),
    'status',state,'usedUses',i.used_uses,'maxUses',i.max_uses,'canAddVehicle',can_add);
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.public_invitation(token text, vehicle jsonb default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.public_invitation($1,$2);
$$;
revoke all on function accesshome_private.public_invitation(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.public_invitation(text,jsonb) to anon,authenticated;

create function accesshome_private.access_dto(r accesshome.access_records) returns jsonb
language sql immutable set search_path = '' as $$
 select accesshome_private.camel(to_jsonb(r)-'condominium_id'-'validated_by'-'request_id'-'source'-'direction'-'vehicle_plates'-'vehicle_brand'-'vehicle_model'-'vehicle_color')
   ||jsonb_build_object('type',r.direction,'vehicle',accesshome_private.visit_vehicle(r.vehicle_plates,r.vehicle_brand,r.vehicle_model,r.vehicle_color));
$$;
create function accesshome.history_context() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles;
begin
 a:=accesshome_private.require_actor();
 return jsonb_build_object('administrative',a.role='admin','residences',
  coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by number) from accesshome.residences),'[]'));
end $$;
create function accesshome.list_access(filters jsonb default '{}') returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; zone text; start_time timestamptz; end_time timestamptz;
begin
 a:=accesshome_private.require_actor();
 if nullif(filters->>'residenceId','') is not null and not exists(select 1 from accesshome.residences where id=(filters->>'residenceId')::uuid) then raise exception 'Residencia no disponible' using errcode='42501'; end if;
 select time_zone into zone from accesshome.condominiums where id=a.condominium_id;
 start_time:=nullif(filters->>'from','')::date::timestamp at time zone zone;
 end_time:=(nullif(filters->>'to','')::date+1)::timestamp at time zone zone;
 if start_time>=end_time or coalesce(filters->>'type','') not in ('','entrada','salida') then raise exception 'Filtros no válidos'; end if;
 return coalesce((select jsonb_agg(accesshome_private.access_dto(r) order by r.occurred_at desc) from accesshome.access_records r
   where (nullif(filters->>'residenceId','') is null or r.residence_id=(filters->>'residenceId')::uuid)
   and (nullif(filters->>'type','') is null or r.direction::text=filters->>'type')
   and (start_time is null or r.occurred_at>=start_time) and (end_time is null or r.occurred_at<end_time)
   and strpos(accesshome_private.search_key(concat_ws(' ',r.visitor_name,r.residence_name,r.inviter_name,r.vehicle_plates)),accesshome_private.search_key(filters->>'search'))>0),'[]');
end $$;

create function accesshome_private.active_access_invitations() returns jsonb language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles;
begin
 a:=accesshome_private.require_actor('admin');
 return coalesce((select jsonb_agg(jsonb_build_object('token',t.token_value,'visitorName',i.visitor_name,'residenceName',i.residence_name,
  'startsAt',i.starts_at,'expiresAt',i.expires_at,'usedUses',i.used_uses) order by i.created_at desc)
  from accesshome.invitations i join accesshome_private.invitation_tokens t on t.invitation_id=i.id
  where i.condominium_id=a.condominium_id and accesshome_private.effective_status(i)='activa'),'[]');
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.active_access_invitations() returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.active_access_invitations();
$$;
revoke all on function accesshome_private.active_access_invitations() from public,anon,authenticated,service_role;
grant execute on function accesshome_private.active_access_invitations() to authenticated;

create function accesshome_private.validate_access(token text, request_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; i accesshome.invitations; r accesshome.residences; movement accesshome.access_records;
 iid uuid; instant timestamptz; reason text; message text;
begin
 a:=accesshome_private.require_actor('admin');
 if request_id is null then raise exception 'Falta el identificador de operación'; end if;
 if token is null or token !~ '^[a-f0-9]{64}$' then
  return jsonb_build_object('authorized',false,'reason','not_found','message','Invitación no encontrada.');
 end if;
 select v.id into iid from accesshome.invitations v join accesshome_private.invitation_tokens t on t.invitation_id=v.id
   where t.token_value=token and v.condominium_id=a.condominium_id;
 if iid is null then return jsonb_build_object('authorized',false,'reason','not_found','message','Invitación no encontrada.'); end if;
 select h.* into r from accesshome.residences h join accesshome.invitations v on v.residence_id=h.id where v.id=iid for share of h;
 select * into i from accesshome.invitations where id=iid for update;
 select * into movement from accesshome.access_records ar where ar.request_id=validate_access.request_id;
 if movement.id is not null then
  if movement.invitation_id<>iid or movement.validated_by<>a.user_id then raise exception 'Identificador de operación no disponible' using errcode='42501'; end if;
  return jsonb_build_object('authorized',true,'record',accesshome_private.access_dto(movement),'usedUses',case when movement.direction='entrada' then 1 else 2 end,
   'maxUses',2,'status',case when movement.direction='entrada' then 'activa' else 'completada' end);
 end if;
 instant:=clock_timestamp();
 if i.status='cancelada' then reason:='cancelled'; message:='Invitación cancelada.';
 elsif i.status='completada' or i.used_uses>=2 then reason:='completed'; message:='Esta invitación ya completó sus usos.';
 elsif i.status='expirada' or i.expires_at<=instant then reason:='expired'; message:='La invitación expiró.';
 elsif i.starts_at>instant then reason:='outside_period'; message:='La vigencia aún no comienza.';
 elsif not r.active then reason:='inactive_residence'; message:='La residencia está inactiva.'; end if;
 if reason is not null then return jsonb_build_object('authorized',false,'reason',reason,'message',message); end if;
 insert into accesshome.access_records(invitation_id,condominium_id,residence_id,inviter_user_id,validated_by,request_id,
  visitor_name,residence_name,inviter_name,vehicle_plates,vehicle_brand,vehicle_model,vehicle_color,direction,occurred_at)
 values(i.id,i.condominium_id,i.residence_id,i.inviter_user_id,a.user_id,validate_access.request_id,
  i.visitor_name,i.residence_name,i.inviter_name,i.vehicle_plates,i.vehicle_brand,i.vehicle_model,i.vehicle_color,
  case when i.used_uses=0 then 'entrada'::accesshome.access_direction else 'salida'::accesshome.access_direction end,instant) returning * into movement;
 update accesshome.invitations set used_uses=used_uses+1,status=case when used_uses=1 then 'completada'::accesshome.invitation_status else status end where id=i.id returning * into i;
 return jsonb_build_object('authorized',true,'record',accesshome_private.access_dto(movement),'usedUses',i.used_uses,'maxUses',i.max_uses,'status',i.status);
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.validate_access(token text, request_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.validate_access($1,$2);
$$;
revoke all on function accesshome_private.validate_access(text,uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.validate_access(text,uuid) to authenticated;

revoke all on function accesshome_private.public_request_allowed(text),accesshome_private.access_dto(accesshome.access_records) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.access_dto(accesshome.access_records) to authenticated;
revoke all on function accesshome.public_invitation(text,jsonb),accesshome.history_context(),accesshome.list_access(jsonb),
 accesshome.active_access_invitations(),accesshome.validate_access(text,uuid) from public,anon,authenticated,service_role;
-- USAGE resolves the single private entry point; it does not expose this schema in Data API.
grant usage on schema accesshome,accesshome_private to anon;
grant execute on function accesshome.public_invitation(text,jsonb) to anon,authenticated;
grant execute on function accesshome.history_context(),accesshome.list_access(jsonb),accesshome.active_access_invitations(),accesshome.validate_access(text,uuid) to authenticated;
commit;
