begin;

-- pgcrypto is required only for public capability tokens; internal UUIDs are separate.
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='extensions' and p.proname='gen_random_bytes') then
    raise exception 'pgcrypto must be installed in extensions before continuing';
  end if;
end $$;

create function accesshome_private.require_actor(required_role text default null)
returns accesshome.profiles language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles;
begin
  select p.* into actor from accesshome.profiles p
    join accesshome_private.current_actor() a on a.user_id=p.user_id
    where p.role in ('admin','resident') for share of p;
  if actor.user_id is null or (required_role is not null and actor.role::text<>required_role) then
    raise exception 'No tienes permiso para esta operación' using errcode='42501';
  end if;
  return actor;
end $$;

create function accesshome_private.managed_residence(target uuid)
returns accesshome.residences language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles; house accesshome.residences;
begin
  actor := accesshome_private.require_actor('resident');
  select * into house from accesshome.residences r where r.id=target for update;
  if house.id is null or house.condominium_id<>actor.condominium_id or house.id<>actor.residence_id
    or house.principal_user_id is distinct from actor.user_id or not house.active then
    raise exception 'Solo el principal de una residencia activa puede modificar estos datos' using errcode='42501';
  end if;
  return house;
end $$;

create function accesshome_private.fields(input jsonb, allowed text[]) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(input) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(input) k where not k=any(allowed)) then
    raise exception 'Campos no permitidos' using errcode='22023';
  end if;
end $$;

create function accesshome_private.camel(input jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(
    (select string_agg(case when ord=1 then part else upper(left(part,1))||substr(part,2) end,'' order by ord)
     from unnest(string_to_array(k,'_')) with ordinality as parts(part,ord)),v),'{}')
  from jsonb_each(input) as fields(k,v);
$$;

create function accesshome_private.search_key(input text) returns text
language sql immutable set search_path = '' as $$
 select translate(lower(trim(coalesce(input,''))),'áéíóúüñ','aeiouun');
$$;

create function accesshome_private.residence_dto(r accesshome.residences) returns jsonb
language sql immutable set search_path = '' as $$
  select accesshome_private.camel(to_jsonb(r)-'created_at') || jsonb_build_object('number',r.number::text);
$$;
create function accesshome_private.person_dto(p accesshome.inhabitants) returns jsonb
language sql immutable set search_path = '' as $$
  select accesshome_private.camel(to_jsonb(p)-'condominium_id');
$$;
create function accesshome_private.vehicle_dto(v accesshome.residence_vehicles) returns jsonb
language sql immutable set search_path = '' as $$
  select accesshome_private.camel(to_jsonb(v)-'condominium_id'-'plate_key'-'owner_inhabitant_id') || jsonb_build_object('ownerId',v.owner_inhabitant_id);
$$;
create function accesshome_private.profile_dto(p accesshome.profiles) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',p.user_id,'name',p.display_name,'email','','role',p.role,'condominiumId',p.condominium_id,'residenceId',p.residence_id);
$$;

create function accesshome.session_profile() returns jsonb language sql security invoker set search_path = '' as $$
  select accesshome_private.profile_dto(p) from accesshome.profiles p
    join accesshome_private.current_actor() a on a.user_id=p.user_id where p.role in ('admin','resident');
$$;

create function accesshome.community_summary() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles;
begin
  a:=accesshome_private.require_actor('admin');
  return jsonb_build_object(
    'condominium',(select to_jsonb(c)-'created_at'-'time_zone' from accesshome.condominiums c where c.id=a.condominium_id),
    'residenceCount',(select count(*) from accesshome.residences),
    'residentCount',(select count(*) from accesshome.inhabitants),
    'vehicleCount',(select count(*) from accesshome.residence_vehicles),
    'activeVehicleCount',(select count(*) from accesshome.residence_vehicles where active));
end $$;

create function accesshome.list_residences(search text default '') returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform accesshome_private.require_actor('admin');
  return coalesce((select jsonb_agg(accesshome_private.residence_dto(r) || jsonb_build_object(
    'principalName',(select display_name from accesshome.profiles where user_id=r.principal_user_id),
    'residentCount',(select count(*) from accesshome.inhabitants where residence_id=r.id),
    'vehicleCount',(select count(*) from accesshome.residence_vehicles where residence_id=r.id)) order by r.number)
    from accesshome.residences r where r.number::text like '%'||regexp_replace(trim(search),'^Casa *','','i')||'%'),'[]');
end $$;

create function accesshome.residence_details(target uuid default null) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences; principal jsonb;
begin
  a:=accesshome_private.require_actor();
  select * into r from accesshome.residences where id=coalesce(target,a.residence_id);
  if r.id is null then raise exception 'Residencia no disponible' using errcode='42501'; end if;
  -- Residents see the principal name through their household, never another login email.
  select jsonb_build_object('id',i.user_id,'name',i.first_name||' '||i.last_name,'email','','role','resident',
    'condominiumId',r.condominium_id,'residenceId',r.id) into principal
    from accesshome.inhabitants i where i.user_id=r.principal_user_id;
  return jsonb_build_object(
    'residence',accesshome_private.residence_dto(r),
    'condominium',(select to_jsonb(c)-'created_at'-'time_zone' from accesshome.condominiums c where c.id=r.condominium_id),
    'inhabitants',coalesce((select jsonb_agg(accesshome_private.person_dto(i) order by i.first_name) from accesshome.inhabitants i where i.residence_id=r.id),'[]'),
    'vehicles',coalesce((select jsonb_agg(accesshome_private.vehicle_dto(v) order by v.plates) from accesshome.residence_vehicles v where v.residence_id=r.id),'[]'),
    'primaryResident',principal,'permissions',jsonb_build_object('manageStructure',a.role='admin',
      'manageHousehold',a.role='resident' and r.active and r.principal_user_id=a.user_id));
end $$;

create function accesshome.profile_context(target_user uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles;
begin
  a:=accesshome_private.require_actor();
  if target_user<>a.user_id then raise exception 'Perfil no disponible' using errcode='42501'; end if;
  return jsonb_build_object('condominium',(select to_jsonb(c)-'created_at'-'time_zone' from accesshome.condominiums c where id=a.condominium_id),
    'residence',(select accesshome_private.residence_dto(r) from accesshome.residences r where id=a.residence_id));
end $$;

create function accesshome_private.manage_community(operation text, target uuid, input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; new_id uuid; r accesshome.residences;
begin
  a:=accesshome_private.require_actor('admin');
  if operation='condominium' then
    perform accesshome_private.fields(input,array['name','address']);
    update accesshome.condominiums set name=trim(input->>'name'),address=trim(input->>'address') where id=a.condominium_id;
  elsif operation in ('create_residence','update_residence') then
    perform accesshome_private.fields(input,array['number','street','active']);
    if operation='create_residence' then
      insert into accesshome.residences(condominium_id,number,street,active)
        values(a.condominium_id,(input->>'number')::integer,trim(input->>'street'),(input->>'active')::boolean) returning id into new_id;
      return to_jsonb(new_id);
    end if;
    select * into r from accesshome.residences where id=target and condominium_id=a.condominium_id for update;
    if r.id is null then raise exception 'Residencia no disponible' using errcode='42501'; end if;
    update accesshome.residences set number=(input->>'number')::integer,street=trim(input->>'street'),active=(input->>'active')::boolean where id=r.id;
  else raise exception 'Operación no válida' using errcode='22023';
  end if;
  return null;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.manage_community(operation text, target uuid, input jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.manage_community($1,$2,$3);
$$;
revoke all on function accesshome_private.manage_community(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.manage_community(text,uuid,jsonb) to authenticated;

create table accesshome_private.principal_assignments (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references accesshome.residences(id),
  previous_user_id uuid, new_user_id uuid not null references accesshome.profiles(user_id),
  assigned_by uuid not null references accesshome.profiles(user_id),
  assigned_at timestamptz not null default now()
);
alter table accesshome_private.principal_assignments enable row level security;
revoke all on accesshome_private.principal_assignments from public,anon,authenticated,service_role;

create function accesshome_private.assign_principal(residence_id uuid, inhabitant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; r accesshome.residences; person accesshome.inhabitants;
begin
  a:=accesshome_private.require_actor('admin');
  select * into r from accesshome.residences where id=residence_id and condominium_id=a.condominium_id for update;
  if r.id is null then raise exception 'Residencia no disponible' using errcode='42501'; end if;
  select i.* into person from accesshome.inhabitants i join accesshome.profiles p on p.user_id=i.user_id
    where i.id=inhabitant_id and i.residence_id=r.id and i.active and p.active and p.role='resident' and p.residence_id=r.id;
  if person.id is null then raise exception 'Selecciona un habitante activo con cuenta vinculada a esta casa'; end if;
  insert into accesshome_private.principal_assignments(residence_id,previous_user_id,new_user_id,assigned_by)
    values(r.id,r.principal_user_id,person.user_id,a.user_id);
  update accesshome.residences set principal_user_id=person.user_id where id=r.id;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.assign_principal(residence_id uuid, inhabitant_id uuid) returns void
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.assign_principal($1,$2);
$$;
revoke all on function accesshome_private.assign_principal(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.assign_principal(uuid,uuid) to authenticated;

create function accesshome_private.manage_household(operation text, residence_id uuid, target uuid, input jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r accesshome.residences; person accesshome.inhabitants; vid uuid;
begin
  r:=accesshome_private.managed_residence(residence_id);
  if operation in ('create_inhabitant','update_inhabitant') then
    perform accesshome_private.fields(input,array['firstName','lastName','phone','email','relationship','active']);
    if operation='update_inhabitant' then
      select * into person from accesshome.inhabitants i where i.id=target and i.residence_id=r.id for update;
      if person.id is null then raise exception 'Habitante no disponible' using errcode='42501'; end if;
      if person.user_id=r.principal_user_id and not (input->>'active')::boolean then raise exception 'Asigna otro principal antes de desactivar al actual'; end if;
      update accesshome.inhabitants set first_name=trim(input->>'firstName'),last_name=trim(input->>'lastName'),
        phone=trim(input->>'phone'),email=trim(input->>'email'),relationship=trim(input->>'relationship'),active=(input->>'active')::boolean where id=person.id;
      update accesshome.profiles set display_name=trim(input->>'firstName')||' '||trim(input->>'lastName') where user_id=person.user_id;
    else
      insert into accesshome.inhabitants(condominium_id,residence_id,first_name,last_name,phone,email,relationship,active)
      values(r.condominium_id,r.id,trim(input->>'firstName'),trim(input->>'lastName'),trim(input->>'phone'),trim(input->>'email'),trim(input->>'relationship'),(input->>'active')::boolean);
    end if;
  elsif operation in ('create_vehicle','update_vehicle','delete_vehicle') then
    perform accesshome_private.fields(input,array['plates','brand','model','color','ownerId','active']);
    if operation<>'create_vehicle' then
      select id into vid from accesshome.residence_vehicles v where v.id=target and v.residence_id=r.id for update;
      if vid is null then raise exception 'Vehículo no disponible' using errcode='42501'; end if;
    end if;
    if operation='delete_vehicle' then delete from accesshome.residence_vehicles where id=vid;
    elsif operation='update_vehicle' then
      update accesshome.residence_vehicles set plates=upper(trim(input->>'plates')),brand=trim(input->>'brand'),model=trim(input->>'model'),
        color=trim(input->>'color'),owner_inhabitant_id=(input->>'ownerId')::uuid,active=(input->>'active')::boolean where id=vid;
    else
      insert into accesshome.residence_vehicles(condominium_id,residence_id,plates,brand,model,color,owner_inhabitant_id,active)
        values(r.condominium_id,r.id,upper(trim(input->>'plates')),trim(input->>'brand'),trim(input->>'model'),trim(input->>'color'),(input->>'ownerId')::uuid,(input->>'active')::boolean);
    end if;
  else raise exception 'Operación no válida' using errcode='22023';
  end if;
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.manage_household(operation text, residence_id uuid, target uuid, input jsonb) returns void
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.manage_household($1,$2,$3,$4);
$$;
revoke all on function accesshome_private.manage_household(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.manage_household(text,uuid,uuid,jsonb) to authenticated;

-- Explicit function grants; table writes remain unavailable to every client role.
revoke all on all functions in schema accesshome from public,anon,authenticated,service_role;
revoke all on function accesshome_private.search_key(text), accesshome_private.require_actor(text), accesshome_private.managed_residence(uuid),
  accesshome_private.fields(jsonb,text[]), accesshome_private.camel(jsonb), accesshome_private.residence_dto(accesshome.residences),
  accesshome_private.person_dto(accesshome.inhabitants), accesshome_private.vehicle_dto(accesshome.residence_vehicles),
  accesshome_private.profile_dto(accesshome.profiles) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.search_key(text), accesshome_private.require_actor(text), accesshome_private.camel(jsonb),
  accesshome_private.residence_dto(accesshome.residences), accesshome_private.person_dto(accesshome.inhabitants),
  accesshome_private.vehicle_dto(accesshome.residence_vehicles), accesshome_private.profile_dto(accesshome.profiles) to authenticated;
grant execute on function accesshome.session_profile(),accesshome.community_summary(),accesshome.list_residences(text),
  accesshome.residence_details(uuid),accesshome.profile_context(uuid),accesshome.manage_community(text,uuid,jsonb),
  accesshome.assign_principal(uuid,uuid),accesshome.manage_household(text,uuid,uuid,jsonb) to authenticated;
commit;
