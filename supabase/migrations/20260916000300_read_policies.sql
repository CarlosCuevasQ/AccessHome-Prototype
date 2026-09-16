begin;

-- Funciones internas propiedad del migrador: evitan recursión de RLS al resolver
-- el perfil. No reciben identidad/rol del cliente ni usan user_metadata.
create function accesshome_private.current_actor()
returns table (user_id uuid, condominium_id uuid, residence_id uuid, role accesshome.app_role)
language sql stable security definer set search_path = ''
as $$
  select p.user_id, p.condominium_id, p.residence_id, p.role
  from accesshome.profiles p
  where p.user_id = (select auth.uid()) and p.active
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
    and (p.role <> 'resident' or exists (
      select 1 from accesshome.inhabitants i
      where i.user_id = p.user_id and i.residence_id = p.residence_id
        and i.condominium_id = p.condominium_id and i.active
    ));
$$;

create function accesshome_private.is_admin(target_condominium uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from accesshome_private.current_actor() a
    where a.role = 'admin' and a.condominium_id = target_condominium);
$$;

create function accesshome_private.is_resident_of(target_residence uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from accesshome_private.current_actor() a
    where a.role = 'resident' and a.residence_id = target_residence);
$$;

create function accesshome_private.owns_agenda(target_owner uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from accesshome_private.current_actor() a
    join accesshome.residences r on r.id = a.residence_id
    where a.role = 'resident' and a.user_id = target_owner
      and r.principal_user_id = a.user_id and r.condominium_id = a.condominium_id);
$$;

revoke all on function accesshome_private.current_actor() from public, anon, authenticated;
revoke all on function accesshome_private.is_admin(uuid) from public, anon, authenticated;
revoke all on function accesshome_private.is_resident_of(uuid) from public, anon, authenticated;
revoke all on function accesshome_private.owns_agenda(uuid) from public, anon, authenticated;
grant usage on schema accesshome, accesshome_private to authenticated;
grant execute on function accesshome_private.current_actor() to authenticated;
grant execute on function accesshome_private.is_admin(uuid) to authenticated;
grant execute on function accesshome_private.is_resident_of(uuid) to authenticated;
grant execute on function accesshome_private.owns_agenda(uuid) to authenticated;

create policy condominium_read on accesshome.condominiums for select to authenticated
using (exists (select 1 from accesshome_private.current_actor() a where a.condominium_id = id));

create policy profile_read on accesshome.profiles for select to authenticated
using (accesshome_private.is_admin(condominium_id)
  or exists (select 1 from accesshome_private.current_actor() a where a.user_id = profiles.user_id));

create policy residence_read on accesshome.residences for select to authenticated
using (accesshome_private.is_admin(condominium_id) or accesshome_private.is_resident_of(id));

create policy inhabitant_read on accesshome.inhabitants for select to authenticated
using (accesshome_private.is_admin(condominium_id) or accesshome_private.is_resident_of(residence_id));

create policy residence_vehicle_read on accesshome.residence_vehicles for select to authenticated
using (accesshome_private.is_admin(condominium_id) or accesshome_private.is_resident_of(residence_id));

create policy contact_read on accesshome.frequent_contacts for select to authenticated
using (accesshome_private.owns_agenda(owner_user_id));

create policy contact_vehicle_read on accesshome.contact_vehicles for select to authenticated
using (exists (select 1 from accesshome.frequent_contacts c
  where c.id = contact_id and c.condominium_id = contact_vehicles.condominium_id
    and accesshome_private.owns_agenda(c.owner_user_id)));

create policy invitation_read on accesshome.invitations for select to authenticated
using (accesshome_private.is_admin(condominium_id) or accesshome_private.is_resident_of(residence_id));

create policy access_read on accesshome.access_records for select to authenticated
using (accesshome_private.is_admin(condominium_id) or accesshome_private.is_resident_of(residence_id));

create policy report_read on accesshome.reports for select to authenticated
using (accesshome_private.is_admin(condominium_id)
  or (author_user_id = (select auth.uid()) and accesshome_private.is_resident_of(residence_id)));

grant select on accesshome.condominiums, accesshome.profiles, accesshome.residences,
  accesshome.inhabitants, accesshome.residence_vehicles, accesshome.frequent_contacts,
  accesshome.contact_vehicles, accesshome.invitations, accesshome.access_records,
  accesshome.reports to authenticated;

-- No INSERT/UPDATE/DELETE desde la API en esta base. Las próximas migraciones
-- añadirán RPCs transaccionales con autorización y privilegios explícitos.
-- Guardia: solo perfil propio/condominio, sin acceso a tablas operativas.
-- Visitante: cero tablas; la proyección pública por token se implementa después.
commit;
