begin;
-- These procedures are intentionally inaccessible to Data API roles.
-- Run manually as the migration owner after creating Auth accounts in Dashboard.
create function accesshome_private.provision_resident(auth_user_id uuid, inhabitant_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i accesshome.inhabitants;
begin
 select * into i from accesshome.inhabitants where id=inhabitant_id for update;
 if i.id is null or not i.active or i.user_id is not null then raise exception 'Selecciona un habitante activo sin cuenta'; end if;
 if exists(select 1 from accesshome.profiles where user_id=auth_user_id) then raise exception 'La cuenta ya tiene un perfil; no se trasladan identidades'; end if;
 if not exists(select 1 from auth.users where id=auth_user_id) then raise exception 'Primero crea la cuenta en Supabase Auth'; end if;
 insert into accesshome.profiles(user_id,condominium_id,residence_id,display_name,role)
 values(auth_user_id,i.condominium_id,i.residence_id,i.first_name||' '||i.last_name,'resident');
 update accesshome.inhabitants set user_id=auth_user_id where id=i.id;
end $$;

create function accesshome_private.seed_demo(accounts jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare condo uuid; house uuid; person uuid; contact uuid; row_data record; uid uuid; house24 uuid; daniel uuid; mariana uuid;
begin
 perform pg_advisory_xact_lock(902409);
 perform accesshome_private.fields(accounts,array['admin','daniel','ana','mariana','jorge','luis','elena']);
 if exists(select 1 from accesshome.condominiums) then raise exception 'La base ya contiene datos. No se sobrescribe ni se vuelve a sembrar.'; end if;
 if coalesce(accounts->>'admin','')='' or coalesce(accounts->>'daniel','')='' or coalesce(accounts->>'ana','')='' then
   raise exception 'Indica UUID Auth de admin, daniel y ana'; end if;
 if (select count(*) from jsonb_each_text(accounts))<>(select count(distinct value) from jsonb_each_text(accounts)) then raise exception 'Cada cuenta debe tener un UUID diferente'; end if;
 for row_data in select key,value from jsonb_each_text(accounts) loop
  if not exists(select 1 from auth.users where id=row_data.value::uuid) then raise exception 'Cuenta Auth no encontrada: %',row_data.key; end if;
 end loop;
 insert into accesshome.condominiums(name,address) values('Residencial Los Robles','Av. de los Robles 120, Ciudad de México') returning id into condo;
 insert into accesshome.residences(condominium_id,number,street) values
  (condo,12,'Circuito Robles'),(condo,24,'Circuito Robles'),(condo,37,'Paseo del Bosque'),(condo,51,'Paseo del Bosque');
 insert into accesshome.profiles(user_id,condominium_id,display_name,role)
  values((accounts->>'admin')::uuid,condo,'Administrador Demo','admin');
 for row_data in select * from (values
   ('daniel',24,'Daniel','Cuevas'),('mariana',24,'Mariana','Torres'),
   ('ana',12,'Ana','López'),('jorge',12,'Jorge','Mendoza'),('luis',37,'Luis','Herrera'),('elena',51,'Elena','Ríos'),
   ('andrea',24,'Andrea','Cuevas'),('carlos',24,'Carlos','Cuevas')) as people(alias,number,first_name,last_name) loop
   select id into house from accesshome.residences where condominium_id=condo and number=row_data.number;
   uid:=(accounts->>row_data.alias)::uuid;
   if uid is not null then
    insert into accesshome.profiles(user_id,condominium_id,residence_id,display_name,role)
    values(uid,condo,house,row_data.first_name||' '||row_data.last_name,'resident');
   end if;
   insert into accesshome.inhabitants(condominium_id,residence_id,user_id,first_name,last_name,relationship)
     values(condo,house,uid,row_data.first_name,row_data.last_name,'Habitante') returning id into person;
   if row_data.alias in ('daniel','ana','luis','elena') and uid is not null then
    update accesshome.residences set principal_user_id=uid where id=house;
   end if;
   if row_data.alias='daniel' then house24:=house; daniel:=person; end if;
   if row_data.alias='mariana' then mariana:=person; end if;
 end loop;
 insert into accesshome.residence_vehicles(condominium_id,residence_id,owner_inhabitant_id,plates,brand,model,color,active) values
 (condo,house24,daniel,'DEMO-024','Nissan','Versa','Gris',true),
 (condo,house24,mariana,'DEMO-124','Toyota','Corolla','Blanco',false);
 for row_data in select * from (values (12,'DEMO-012','Kia','Rio','Azul'),(37,'DEMO-037','Mazda','CX-5','Rojo'),(51,'DEMO-051','Honda','CR-V','Plata')) as cars(number,plates,brand,model,color) loop
  select id into house from accesshome.residences where condominium_id=condo and number=row_data.number;
  insert into accesshome.residence_vehicles(condominium_id,residence_id,plates,brand,model,color) values(condo,house,row_data.plates,row_data.brand,row_data.model,row_data.color);
 end loop;
 for row_data in select * from (values ('Carlos López','JKL-1234','Nissan','Sentra','Gris'),('María González','MGA-240','Toyota','Yaris','Blanco'),('Pedro Ramírez','PRA-240','Honda','Civic','Azul')) as contacts(name,plates,brand,model,color) loop
  insert into accesshome.frequent_contacts(condominium_id,owner_user_id,name,notes)
   values(condo,(accounts->>'daniel')::uuid,row_data.name,'Contacto ficticio de demostración') returning id into contact;
  insert into accesshome.contact_vehicles(condominium_id,contact_id,plates,brand,model,color)
   values(condo,contact,row_data.plates,row_data.brand,row_data.model,row_data.color);
 end loop;
 return jsonb_build_object('condominiumId',condo,'residence24',house24);
end $$;
revoke all on function accesshome_private.seed_demo(jsonb),accesshome_private.provision_resident(uuid,uuid) from public,anon,authenticated,service_role;
create function accesshome.backend_health() returns jsonb language sql immutable security invoker set search_path = '' as $$
 select jsonb_build_object('application','AccessHome','schemaVersion',9);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;
commit;
