begin;

-- Extend the existing movement ledger; no new validation system or historical rewrite.
alter table accesshome.access_records drop constraint access_records_method_check;
alter table accesshome.access_records add constraint access_records_method_check check (method in ('QR','MANUAL'));
alter table accesshome.access_records add column validator_name varchar(150);
-- Immutable snapshots on new movements, without backfilling or changing old rows.
-- Completion still satisfies the existing status <-> two uses CHECK.
alter table accesshome.access_records add column invitation_status_before accesshome.invitation_status;
alter table accesshome.access_records add column invitation_effective_status_before accesshome.invitation_status;

-- One implementation for the existing admin workflow and the guard scanner.
create function accesshome_private.validate_access(token text, request_id uuid, scan_method text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a accesshome.profiles; i accesshome.invitations; r accesshome.residences; movement accesshome.access_records;
  iid uuid; initial_uses integer; instant timestamptz; reason text; message text; dto jsonb;
  entries integer; exits integer; last_movement timestamptz;
  effective_state accesshome.invitation_status; exit_override boolean := false;
begin
  if exists(select 1 from accesshome_private.current_actor() where role='guard') then
    a:=accesshome_private.require_guard();
  else
    a:=accesshome_private.require_actor('admin');
  end if;
  if request_id is null or scan_method is null or scan_method not in ('QR','MANUAL') then
    raise exception 'Identificador o método de operación no válido' using errcode='22023';
  end if;
  if token is null or token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('authorized',false,'reason','not_found','message','Invitación no encontrada.');
  end if;
  select v.id,v.used_uses into iid,initial_uses from accesshome.invitations v
    join accesshome_private.invitation_tokens t on t.invitation_id=v.id
    where t.token_value=token and v.condominium_id=a.condominium_id;
  if iid is null then return jsonb_build_object('authorized',false,'reason','not_found','message','Invitación no encontrada.'); end if;
  -- Preserve house -> invitation lock order shared by cancellation.
  select h.* into r from accesshome.residences h join accesshome.invitations v on v.residence_id=h.id where v.id=iid for share of h;
  select * into i from accesshome.invitations where id=iid for update;
  select * into movement from accesshome.access_records ar where ar.request_id=validate_access.request_id;
  if movement.id is not null then
    if movement.invitation_id<>iid or movement.validated_by<>a.user_id or movement.method<>scan_method then
      raise exception 'Identificador de operación no disponible' using errcode='42501';
    end if;
    dto:=case when a.role='guard' then jsonb_build_object('id',movement.id,'visitorName',movement.visitor_name,
      'residenceName',movement.residence_name,'vehicle',accesshome_private.visit_vehicle(movement.vehicle_plates,movement.vehicle_brand,movement.vehicle_model,movement.vehicle_color),
      'type',movement.direction,'method',movement.method,'occurredAt',movement.occurred_at,'validatorName',movement.validator_name,
      'invitationStatusBefore',movement.invitation_status_before,'invitationEffectiveStatusBefore',movement.invitation_effective_status_before)
      else accesshome_private.access_dto(movement) end;
    return jsonb_build_object('authorized',true,'record',dto,'replayed',true,
      'usedUses',case when movement.direction='entrada' then 1 else 2 end,'maxUses',2,
      'status',case when movement.direction='entrada' then 'activa' else 'completada' end);
  end if;
  instant:=clock_timestamp();
  effective_state:=case when i.status='activa' and i.expires_at<=instant then 'expirada'::accesshome.invitation_status else i.status end;
  select count(*) filter(where direction='entrada'),count(*) filter(where direction='salida'),max(occurred_at)
    into entries,exits,last_movement from accesshome.access_records where invitation_id=i.id;
  if i.status='completada' or i.used_uses>=i.max_uses then
    return jsonb_build_object('authorized',false,'reason','completed','message','Esta invitación ya completó sus usos.');
  end if;
  if exits<>0 or entries<>i.used_uses or i.used_uses not in (0,1) then
    return jsonb_build_object('authorized',false,'reason','invalid_sequence','message','La secuencia de movimientos requiere revisión administrativa.');
  end if;
  exit_override:=a.role='guard' and entries=1 and i.starts_at<=instant
    and (i.status='cancelada' or i.status='expirada' or (i.status='activa' and i.expires_at<=instant));
  -- An existing entry is evidence of an open visit, not permission for re-entry.
  -- Only an active guard of this condominium may close it after cancellation
  -- or expiry. Admin keeps its normal, valid-visit flow.
  if not r.active then reason:='inactive_residence'; message:='La residencia está inactiva.';
  elsif not exit_override then
    if i.status='cancelada' then reason:='cancelled'; message:='Invitación cancelada.';
    elsif i.status='expirada' or i.expires_at<=instant then reason:='expired'; message:='La invitación expiró.';
    elsif i.starts_at>instant then reason:='outside_period'; message:='La vigencia aún no comienza.';
    end if;
  end if;
  if i.used_uses<>initial_uses then reason:='concurrent_scan'; message:='Otra lectura cambió esta invitación. Revisa el historial antes de escanear de nuevo.'; end if;
  if reason is not null then return jsonb_build_object('authorized',false,'reason',reason,'message',message); end if;
  -- Camera bursts on separate devices must not consume an exit immediately after entry.
  -- The legacy admin simulator retains its sequential flow. No client can bypass this for a guard.
  if a.role='guard' and last_movement>instant-interval '3 seconds' then
    return jsonb_build_object('authorized',false,'reason','recent_scan',
      'message','Lectura reciente. No se registró otro movimiento. Espera al menos 3 segundos y verifica si corresponde una salida.');
  end if;
  insert into accesshome.access_records(invitation_id,condominium_id,residence_id,inviter_user_id,validated_by,validator_name,request_id,
    visitor_name,residence_name,inviter_name,vehicle_plates,vehicle_brand,vehicle_model,vehicle_color,direction,method,occurred_at,
    invitation_status_before,invitation_effective_status_before)
  values(i.id,i.condominium_id,i.residence_id,i.inviter_user_id,a.user_id,a.display_name,validate_access.request_id,
    i.visitor_name,i.residence_name,i.inviter_name,i.vehicle_plates,i.vehicle_brand,i.vehicle_model,i.vehicle_color,
    case when i.used_uses=0 then 'entrada'::accesshome.access_direction else 'salida'::accesshome.access_direction end,scan_method,instant,
    i.status,effective_state)
  returning * into movement;
  update accesshome.invitations set used_uses=used_uses+1,
    status=case when used_uses=1 then 'completada'::accesshome.invitation_status else status end where id=i.id returning * into i;
  dto:=case when a.role='guard' then jsonb_build_object('id',movement.id,'visitorName',movement.visitor_name,
    'residenceName',movement.residence_name,'vehicle',accesshome_private.visit_vehicle(movement.vehicle_plates,movement.vehicle_brand,movement.vehicle_model,movement.vehicle_color),
    'type',movement.direction,'method',movement.method,'occurredAt',movement.occurred_at,'validatorName',movement.validator_name,
    'invitationStatusBefore',movement.invitation_status_before,'invitationEffectiveStatusBefore',movement.invitation_effective_status_before)
    else accesshome_private.access_dto(movement) end;
  return jsonb_build_object('authorized',true,'record',dto,'replayed',false,'usedUses',i.used_uses,'maxUses',i.max_uses,'status',i.status);
end $$;

-- Preserve the original signature as a compatibility interface to the same engine.
create or replace function accesshome_private.validate_access(token text, request_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.validate_access($1,$2,'QR');
$$;
create function accesshome.validate_access(token text, request_id uuid, scan_method text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select accesshome_private.validate_access($1,$2,$3);
$$;
revoke all on function accesshome_private.validate_access(text,uuid,text),accesshome.validate_access(text,uuid,text),
  accesshome_private.validate_access(text,uuid),accesshome.validate_access(text,uuid) from public,anon,authenticated,service_role;
grant execute on function accesshome_private.validate_access(text,uuid,text),accesshome.validate_access(text,uuid,text),
  accesshome_private.validate_access(text,uuid),accesshome.validate_access(text,uuid) to authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',2,'guardScanningVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;

commit;
