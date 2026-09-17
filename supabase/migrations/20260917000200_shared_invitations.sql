begin;
-- Supports the post-lock overlap lookup; no clock-dependent partial predicate.
create index invitations_active_contact_period_idx
  on accesshome.invitations(residence_id,contact_id,starts_at,expires_at)
  where status='activa' and contact_id is not null;
create function accesshome_private.contact_dto(c accesshome.frequent_contacts) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select accesshome_private.camel(to_jsonb(c)-'condominium_id') || jsonb_build_object('vehicles',
    coalesce((select jsonb_agg(to_jsonb(v)-'condominium_id'-'contact_id'-'plate_key' order by v.plates) from accesshome.contact_vehicles v where v.contact_id=c.id),'[]'));
$$;
create function accesshome.contact_access() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences;
begin
  a:=accesshome_private.require_actor('resident');
  select * into r from accesshome.residences where id=a.residence_id;
  if r.principal_user_id is distinct from a.user_id then raise exception 'Agenda privada del principal' using errcode='42501'; end if;
  return jsonb_build_object('canManage',r.active);
end $$;
create function accesshome.list_contacts(search text default '') returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform accesshome.contact_access();
  return coalesce((select jsonb_agg(accesshome_private.contact_dto(c) order by c.name) from accesshome.frequent_contacts c
    where strpos(accesshome_private.search_key(concat_ws(' ',c.name,c.phone,c.email,(select string_agg(v.plates,' ') from accesshome.contact_vehicles v where v.contact_id=c.id))),
    accesshome_private.search_key(search))>0),'[]');
end $$;
create function accesshome.contact_details(target uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  perform accesshome.contact_access();
  select accesshome_private.contact_dto(c) into result from accesshome.frequent_contacts c where id=target;
  if result is null then raise exception 'Contacto no disponible' using errcode='42501'; end if;
  return result;
end $$;
create function accesshome_private.manage_contact(operation text, target uuid, input jsonb, contact_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences; c accesshome.frequent_contacts; new_id uuid;
begin
  a:=accesshome_private.require_actor('resident');
  r:=accesshome_private.managed_residence(a.residence_id);
  if operation<>'create' then
    select * into c from accesshome.frequent_contacts f where f.id=coalesce(contact_id,target) and f.owner_user_id=a.user_id and f.condominium_id=a.condominium_id for update;
    if c.id is null then raise exception 'Contacto no disponible' using errcode='42501'; end if;
  end if;
  if operation in ('create','update') then
    perform accesshome_private.fields(input,array['name','phone','email','notes','active']);
    if operation='create' then
      insert into accesshome.frequent_contacts(condominium_id,owner_user_id,name,phone,email,notes,active)
        values(a.condominium_id,a.user_id,trim(input->>'name'),trim(input->>'phone'),trim(input->>'email'),trim(input->>'notes'),(input->>'active')::boolean) returning id into new_id;
      return to_jsonb(new_id);
    end if;
    update accesshome.frequent_contacts set name=trim(input->>'name'),phone=trim(input->>'phone'),email=trim(input->>'email'),notes=trim(input->>'notes'),active=(input->>'active')::boolean where id=c.id;
  elsif operation='delete' then
    perform accesshome_private.fields(input,array[]::text[]);
    update accesshome.invitations set contact_id=null where invitations.contact_id=c.id;
    delete from accesshome.contact_vehicles where contact_vehicles.contact_id=c.id;
    delete from accesshome.frequent_contacts where id=c.id;
  elsif operation in ('create_vehicle','update_vehicle','delete_vehicle') then
    perform accesshome_private.fields(input,array['plates','brand','model','color','active']);
    if operation<>'create_vehicle' and not exists(select 1 from accesshome.contact_vehicles v where v.id=target and v.contact_id=c.id) then
      raise exception 'Vehículo no disponible' using errcode='42501';
    end if;
    if operation='delete_vehicle' then delete from accesshome.contact_vehicles where id=target and contact_vehicles.contact_id=c.id;
    elsif operation='update_vehicle' then
      update accesshome.contact_vehicles set plates=upper(trim(input->>'plates')),brand=trim(input->>'brand'),model=trim(input->>'model'),color=trim(input->>'color'),active=(input->>'active')::boolean where id=target and contact_vehicles.contact_id=c.id;
    else
      insert into accesshome.contact_vehicles(condominium_id,contact_id,plates,brand,model,color,active)
        values(a.condominium_id,c.id,upper(trim(input->>'plates')),trim(input->>'brand'),trim(input->>'model'),trim(input->>'color'),(input->>'active')::boolean);
    end if;
  else raise exception 'Operación no válida' using errcode='22023';
  end if;
  return null;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.manage_contact(operation text, target uuid, input jsonb, contact_id uuid default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.manage_contact($1,$2,$3,$4);
$$;
revoke all on function accesshome_private.manage_contact(text,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.manage_contact(text,uuid,jsonb,uuid) to authenticated;

create function accesshome_private.effective_status(i accesshome.invitations) returns text
language sql stable set search_path = '' as $$
  select case when i.status='activa' and i.expires_at<=statement_timestamp() then 'expirada' else i.status::text end;
$$;
create function accesshome_private.visit_vehicle(plates text, brand text, model text, color text) returns jsonb
language sql immutable set search_path = '' as $$
  select case when plates is null then null else jsonb_build_object('plates',plates,'brand',coalesce(brand,''),'model',coalesce(model,''),'color',coalesce(color,'')) end;
$$;
create function accesshome_private.invitation_dto(i accesshome.invitations, token text default '') returns jsonb
language sql stable set search_path = '' as $$
 select accesshome_private.camel(to_jsonb(i)-'condominium_id'-'vehicle_plates'-'vehicle_brand'-'vehicle_model'-'vehicle_color')
   ||jsonb_build_object('token',token,'status',accesshome_private.effective_status(i),
     'vehicle',accesshome_private.visit_vehicle(i.vehicle_plates,i.vehicle_brand,i.vehicle_model,i.vehicle_color));
$$;
create function accesshome.invitation_context() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences;
begin
 a:=accesshome_private.require_actor('resident');
 select * into r from accesshome.residences where id=a.residence_id;
 return jsonb_build_object('residenceName',r.name,'canManage',r.active and r.principal_user_id=a.user_id);
end $$;
create function accesshome.list_invitations(search text default '',status_filter text default 'todas') returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
 perform accesshome_private.require_actor('resident');
 return coalesce((select jsonb_agg(accesshome_private.invitation_dto(i) order by i.created_at desc) from accesshome.invitations i
  where (status_filter='todas' or accesshome_private.effective_status(i)=status_filter)
   and strpos(accesshome_private.search_key(concat_ws(' ',i.visitor_name,i.phone,i.vehicle_plates)),accesshome_private.search_key(search))>0),'[]');
end $$;
create function accesshome_private.invitation_details(target uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; i accesshome.invitations; token text;
begin
 a:=accesshome_private.require_actor();
 select * into i from accesshome.invitations where id=target and condominium_id=a.condominium_id and (a.role='admin' or residence_id=a.residence_id);
 if i.id is null then raise exception 'Invitación no disponible' using errcode='42501'; end if;
 select token_value into token from accesshome_private.invitation_tokens where invitation_id=i.id;
 return accesshome_private.invitation_dto(i,token);
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.invitation_details(target uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.invitation_details($1);
$$;
revoke all on function accesshome_private.invitation_details(uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.invitation_details(uuid) to authenticated;

create function accesshome_private.create_invitation(input jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
<<invitation_creation>>
declare a accesshome.profiles; r accesshome.residences; c accesshome.frequent_contacts; cv accesshome.contact_vehicles;
 v jsonb; start_time timestamptz; end_time timestamptz; zone text; new_id uuid; contact_id uuid;
 visitor text; phone text; token text;
begin
 a:=accesshome_private.require_actor('resident');
 r:=accesshome_private.managed_residence(a.residence_id);
 -- Serialize creators through the residence row. A new MVCC version also forces
 -- stale REPEATABLE READ/SERIALIZABLE transactions to abort instead of missing a
 -- concurrent invitation. READ COMMITTED gets a fresh snapshot for the check below.
 update accesshome.residences set principal_user_id=r.principal_user_id where id=r.id;
 perform accesshome_private.fields(input,array['validity','source','contactId','vehicleChoice','visitorName','phone','vehicle','saveAsContact']);
 perform accesshome_private.fields(input->'validity',array['kind','startsAt','expiresAt']);
 start_time:=clock_timestamp();
 if input#>>'{validity,kind}'='today' then
  select time_zone into zone from accesshome.condominiums where id=a.condominium_id;
  end_time:=((start_time at time zone zone)::date+1)::timestamp at time zone zone;
 elsif input#>>'{validity,kind}'='24hours' then end_time:=start_time+interval '24 hours';
 elsif input#>>'{validity,kind}'='custom' then
  start_time:=(input#>>'{validity,startsAt}')::timestamptz; end_time:=(input#>>'{validity,expiresAt}')::timestamptz;
 else raise exception 'Vigencia no válida' using errcode='22023'; end if;
 if start_time is null or end_time is null or not isfinite(start_time) or not isfinite(end_time) or end_time<=start_time or end_time<=clock_timestamp() then raise exception 'La vigencia debe finalizar en el futuro y después del inicio' using errcode='22023'; end if;
 if input->>'source'='contact' then
  select * into c from accesshome.frequent_contacts where id=(input->>'contactId')::uuid and owner_user_id=a.user_id and condominium_id=a.condominium_id and active for share;
  if c.id is null then raise exception 'Contacto no disponible' using errcode='42501'; end if;
  visitor:=c.name; phone:=c.phone; contact_id:=c.id;
  perform accesshome_private.fields(input->'vehicleChoice',array['kind','vehicleId','vehicle']);
  if input#>>'{vehicleChoice,kind}'='saved' then
   select * into cv from accesshome.contact_vehicles where id=(input#>>'{vehicleChoice,vehicleId}')::uuid and contact_vehicles.contact_id=c.id and active;
   if cv.id is null then raise exception 'Vehículo no disponible' using errcode='42501'; end if;
   v:=jsonb_build_object('plates',cv.plates,'brand',cv.brand,'model',cv.model,'color',cv.color);
  elsif input#>>'{vehicleChoice,kind}'='other' then v:=input#>'{vehicleChoice,vehicle}';
  elsif input#>>'{vehicleChoice,kind}'<>'none' or input#>>'{vehicleChoice,kind}' is null then raise exception 'Selecciona un vehículo válido'; end if;
 elsif input->>'source'='occasional' then
  visitor:=trim(input->>'visitorName'); phone:=trim(input->>'phone'); v:=nullif(input->'vehicle','null'::jsonb);
 else raise exception 'Origen no válido' using errcode='22023'; end if;
 if v is not null then
  perform accesshome_private.fields(v,array['plates','brand','model','color']);
  if coalesce(trim(v->>'plates'),'')='' then raise exception 'Placas obligatorias' using errcode='22023'; end if;
 end if;
 if input->>'source'='occasional' and coalesce((input->>'saveAsContact')::boolean,false) then
  insert into accesshome.frequent_contacts(condominium_id,owner_user_id,name,phone) values(a.condominium_id,a.user_id,visitor,coalesce(phone,'')) returning id into contact_id;
  if v is not null then insert into accesshome.contact_vehicles(condominium_id,contact_id,plates,brand,model,color)
   values(a.condominium_id,contact_id,upper(trim(v->>'plates')),coalesce(trim(v->>'brand'),''),coalesce(trim(v->>'model'),''),coalesce(trim(v->>'color'),'')); end if;
 end if;
 -- [start,end) permits adjacent windows. Compare contact identity + residence,
 -- never visitor names. Rows that expired by server time do not block reuse.
 if contact_id is not null and exists (
  select 1 from accesshome.invitations existing
  where existing.residence_id=r.id and existing.contact_id=invitation_creation.contact_id
    and existing.status='activa' and existing.expires_at>clock_timestamp()
    and existing.starts_at<end_time and start_time<existing.expires_at
 ) then
  raise exception 'Este contacto ya tiene una invitación activa con vigencia superpuesta en esta residencia.'
    using errcode='P0001';
 end if;
 insert into accesshome.invitations(condominium_id,residence_id,inviter_user_id,contact_id,visitor_name,phone,inviter_name,residence_name,
  vehicle_plates,vehicle_brand,vehicle_model,vehicle_color,starts_at,expires_at)
 values(a.condominium_id,r.id,a.user_id,contact_id,visitor,coalesce(phone,''),a.display_name,r.name,
  upper(trim(v->>'plates')),v->>'brand',v->>'model',v->>'color',start_time,end_time) returning id into new_id;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into accesshome_private.invitation_tokens(invitation_id,token_value) values(new_id,token);
 return new_id;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.create_invitation(input jsonb) returns uuid
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.create_invitation($1);
$$;
revoke all on function accesshome_private.create_invitation(jsonb) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.create_invitation(jsonb) to authenticated;

create function accesshome_private.cancel_invitation(target uuid) returns void language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences; i accesshome.invitations;
begin
 a:=accesshome_private.require_actor('resident'); r:=accesshome_private.managed_residence(a.residence_id);
 select * into i from accesshome.invitations where id=target and residence_id=r.id and condominium_id=a.condominium_id for update;
 if i.id is null then raise exception 'Invitación no disponible' using errcode='42501'; end if;
 if i.status<>'activa' or i.expires_at<=clock_timestamp() then raise exception 'Solo se puede cancelar una invitación activa'; end if;
 update accesshome.invitations set status='cancelada' where id=i.id;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.cancel_invitation(target uuid) returns void
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.cancel_invitation($1);
$$;
revoke all on function accesshome_private.cancel_invitation(uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.cancel_invitation(uuid) to authenticated;

revoke all on function accesshome_private.contact_dto(accesshome.frequent_contacts),accesshome_private.effective_status(accesshome.invitations),
 accesshome_private.visit_vehicle(text,text,text,text),accesshome_private.invitation_dto(accesshome.invitations,text) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.contact_dto(accesshome.frequent_contacts),accesshome_private.effective_status(accesshome.invitations),
 accesshome_private.visit_vehicle(text,text,text,text),accesshome_private.invitation_dto(accesshome.invitations,text) to authenticated;
revoke all on function accesshome.contact_access(),accesshome.list_contacts(text),accesshome.contact_details(uuid),accesshome.manage_contact(text,uuid,jsonb,uuid),
 accesshome.invitation_context(),accesshome.list_invitations(text,text),accesshome.invitation_details(uuid),accesshome.create_invitation(jsonb),accesshome.cancel_invitation(uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome.contact_access(),accesshome.list_contacts(text),accesshome.contact_details(uuid),accesshome.manage_contact(text,uuid,jsonb,uuid),
 accesshome.invitation_context(),accesshome.list_invitations(text,text),accesshome.invitation_details(uuid),accesshome.create_invitation(jsonb),accesshome.cancel_invitation(uuid) to authenticated;
commit;
