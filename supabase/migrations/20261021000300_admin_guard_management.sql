begin;

-- The condominium admin lists its guards and activates/deactivates them. Role and
-- condominium come from the authenticated profile; only profiles.active changes.
-- The system owner (set_guard_active, owner-only) keeps precedence: its block lives
-- in its own private table, independent of profiles.active, and only the owner can
-- lift it. provision_guard is untouched.

-- Writers of profiles wait until commit, so no guard is deactivated between the backfill
-- below and the creation of the barriers. Reads (including FOR SHARE) are not blocked.
-- Same lock mode that the foreign keys and triggers below take anyway; made explicit here.
lock table accesshome.profiles in share row exclusive mode;

-- Owner block: presence of a row means "blocked by the system owner". Not inferred
-- from history and never created by an admin deactivation.
create table accesshome_private.guard_owner_blocks (
  guard_user_id uuid primary key,
  condominium_id uuid not null,
  blocked_at timestamptz not null default now(),
  foreign key (guard_user_id, condominium_id) references accesshome.profiles(user_id, condominium_id)
);
alter table accesshome_private.guard_owner_blocks enable row level security;
revoke all on accesshome_private.guard_owner_blocks from public,anon,authenticated,service_role;

-- Until now only the owner's set_guard_active could deactivate a guard (provision_guard
-- always creates active guards), so every inactive guard is an existing owner block.
-- Preserve it; no audit rows are invented for history that was never recorded.
insert into accesshome_private.guard_owner_blocks(guard_user_id,condominium_id)
  select p.user_id,p.condominium_id from accesshome.profiles p
  where p.role='guard' and not p.active
  on conflict (guard_user_id) do nothing;

-- Append-only trail of effective changes (active and/or owner block), with origin.
-- No reusable audit exists (principal_assignments is principal-specific).
create table accesshome_private.guard_status_changes (
  id uuid primary key default gen_random_uuid(),
  guard_user_id uuid not null,
  condominium_id uuid not null,
  enabled boolean not null,
  owner_blocked boolean not null,
  source text not null check (source in ('admin','owner')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  check ((source='admin') = (changed_by is not null)),
  check (source='owner' or not owner_blocked),
  foreign key (guard_user_id, condominium_id) references accesshome.profiles(user_id, condominium_id),
  foreign key (changed_by, condominium_id) references accesshome.profiles(user_id, condominium_id)
);
alter table accesshome_private.guard_status_changes enable row level security;
revoke all on accesshome_private.guard_status_changes from public,anon,authenticated,service_role;

-- Write rules for the protected operations. Clients cannot reach them: they have no
-- write grants on profiles nor any grant on the private tables. The rules guard against
-- mistakes by privileged roles: the two audited functions announce themselves through a
-- transaction-local setting just around their writes, and other writes of these columns
-- and tables are rejected. The setting is not a secret; the database owner stays inside
-- the trust boundary (it can set it, or disable triggers).

-- profiles of guards: no role change into or out of 'guard' (no function changes roles
-- and provision_guard refuses other roles; otherwise a blocked guard could become an
-- active admin and then a guard again); active only through set_guard_active or
-- set_guard_status, and never while an owner block exists.
create function accesshome_private.guard_active_write_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role is distinct from new.role then
    raise exception 'El rol guard no se asigna ni se retira; usa una cuenta independiente';
  end if;
  if coalesce(current_setting('accesshome.guard_status_writer',true),'') not in ('set_guard_active','set_guard_status') then
    raise exception 'Cambia el estado de un guardia con set_guard_active o set_guard_status';
  end if;
  if new.active and exists(select 1 from accesshome_private.guard_owner_blocks b where b.guard_user_id=new.user_id) then
    raise exception 'El responsable del sistema bloqueó a este guardia; solo él puede reactivarlo';
  end if;
  return new;
end $$;
create trigger profiles_guard_active_write_rules
  before update of active, role on accesshome.profiles
  for each row when ((old.role='guard' or new.role='guard')
    and (old.active is distinct from new.active or old.role is distinct from new.role))
  execute function accesshome_private.guard_active_write_rules();

-- Owner blocks: only set_guard_active places or lifts them, and only on an inactive guard.
create function accesshome_private.guard_owner_block_write_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='TRUNCATE' or coalesce(current_setting('accesshome.guard_status_writer',true),'')<>'set_guard_active' then
    raise exception 'Solo set_guard_active puede cambiar el bloqueo del responsable';
  end if;
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from accesshome.profiles p where p.user_id=new.guard_user_id and p.active) then
    raise exception 'Desactiva al guardia antes de registrar el bloqueo del responsable';
  end if;
  return new;
end $$;
create trigger guard_owner_blocks_write_rules
  before insert or update or delete on accesshome_private.guard_owner_blocks
  for each row execute function accesshome_private.guard_owner_block_write_rules();
create trigger guard_owner_blocks_no_truncate
  before truncate on accesshome_private.guard_owner_blocks
  for each statement execute function accesshome_private.guard_owner_block_write_rules();
revoke all on function accesshome_private.guard_active_write_rules(),accesshome_private.guard_owner_block_write_rules()
  from public,anon,authenticated,service_role;

-- Per-request barrier: a blocked guard is refused even if its profile were active.
-- Same signature, message and grants as 20260917000600; only the block check is added.
create or replace function accesshome_private.require_guard() returns accesshome.profiles
language plpgsql security definer set search_path = '' as $$
declare actor accesshome.profiles;
begin
  select p.* into actor from accesshome.profiles p
    join accesshome_private.current_actor() a on a.user_id=p.user_id
    where p.role='guard' and p.active and p.residence_id is null
      and not exists(select 1 from accesshome_private.guard_owner_blocks b where b.guard_user_id=p.user_id)
    for share of p;
  if actor.user_id is null then
    raise exception 'Solo un guardia activo puede consultar la caseta' using errcode='42501';
  end if;
  return actor;
end $$;

-- Same signature, errors and owner-only grants as 20260917000600. false places the
-- owner block (after deactivating); true lifts it (before activating). Repeats are no-ops.
create or replace function accesshome_private.set_guard_active(auth_user_id uuid, condominium_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare g accesshome.profiles; blocked boolean;
begin
  if enabled is null then raise exception 'Indica true o false' using errcode='22023'; end if;
  select * into g from accesshome.profiles p
    where p.user_id=auth_user_id and p.condominium_id=set_guard_active.condominium_id and p.role='guard'
    for update;
  if g.user_id is null then raise exception 'Guardia no encontrado en ese condominio'; end if;
  blocked:=exists(select 1 from accesshome_private.guard_owner_blocks b where b.guard_user_id=g.user_id);
  if enabled and g.active and not blocked then return; end if;
  if not enabled and blocked and not g.active then return; end if;
  perform set_config('accesshome.guard_status_writer','set_guard_active',true);
  if enabled then
    delete from accesshome_private.guard_owner_blocks b where b.guard_user_id=g.user_id;
    update accesshome.profiles set active=true where user_id=g.user_id;
  else
    update accesshome.profiles set active=false where user_id=g.user_id;
    insert into accesshome_private.guard_owner_blocks(guard_user_id,condominium_id)
      values(g.user_id,g.condominium_id) on conflict (guard_user_id) do nothing;
  end if;
  perform set_config('accesshome.guard_status_writer','',true);
  insert into accesshome_private.guard_status_changes(guard_user_id,condominium_id,enabled,owner_blocked,source,changed_by)
    values(g.user_id,g.condominium_id,enabled,not enabled,'owner',null);
end $$;

-- Read under RLS (profile_read lets the admin see its condominium) plus explicit filters.
create function accesshome.list_guards() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a accesshome.profiles;
begin
  a:=accesshome_private.require_actor('admin');
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.display_name,'active',p.active,'createdAt',p.created_at)
      order by p.display_name,p.user_id)
    from accesshome.profiles p
    where p.condominium_id=a.condominium_id and p.role='guard' and p.residence_id is null),'[]'::jsonb);
end $$;

create function accesshome_private.set_guard_status(guard_id uuid, enabled boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; g accesshome.profiles;
begin
  a:=accesshome_private.require_actor('admin');
  if guard_id is null or enabled is null then raise exception 'Indica guardia y estado' using errcode='22023'; end if;
  -- Same answer for unknown IDs, other condominiums and non-guard profiles.
  select * into g from accesshome.profiles p
    where p.user_id=guard_id and p.condominium_id=a.condominium_id and p.role='guard' and p.residence_id is null
    for update;
  if g.user_id is null then raise exception 'Guardia no disponible en tu condominio' using errcode='42501'; end if;
  -- Own barrier, checked after locking the profile (the owner also locks it first).
  if enabled and exists(select 1 from accesshome_private.guard_owner_blocks b where b.guard_user_id=g.user_id) then
    raise exception 'El responsable del sistema bloqueó a este guardia; solo él puede reactivarlo';
  end if;
  if g.active is distinct from enabled then
    perform set_config('accesshome.guard_status_writer','set_guard_status',true);
    update accesshome.profiles set active=enabled where user_id=g.user_id;
    perform set_config('accesshome.guard_status_writer','',true);
    insert into accesshome_private.guard_status_changes(guard_user_id,condominium_id,enabled,owner_blocked,source,changed_by)
      values(g.user_id,g.condominium_id,enabled,false,'admin',a.user_id);
    return jsonb_build_object('id',g.user_id,'name',g.display_name,'active',enabled,'changed',true);
  end if;
  return jsonb_build_object('id',g.user_id,'name',g.display_name,'active',g.active,'changed',false);
end $$;

-- Data API interface: no elevated privileges; authorization remains in the private implementation.
create function accesshome.set_guard_status(guard_id uuid, enabled boolean) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.set_guard_status($1,$2);
$$;

revoke all on function accesshome.list_guards(),accesshome_private.set_guard_status(uuid,boolean),
  accesshome.set_guard_status(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function accesshome.list_guards(),accesshome_private.set_guard_status(uuid,boolean),
  accesshome.set_guard_status(uuid,boolean) to authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',4,
   'guardScanningVersion',1,'openVisitExitsVersion',1,'serviceAccessVersion',1,'guardReportsVersion',1,'guardReportLogVersion',1,
   'inactiveResidenceExitVersion',1,'guardManagementVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;

commit;
