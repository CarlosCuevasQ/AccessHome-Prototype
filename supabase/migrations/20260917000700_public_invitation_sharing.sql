begin;

-- Same token capability, lock order, rate limiter and optional vehicle write.
-- Only the public projection changes. No rows or tokens are rewritten.
create or replace function accesshome_private.public_invitation(token text, vehicle jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i accesshome.invitations; r accesshome.residences; iid uuid; state text; can_add boolean; condo_name text;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if not accesshome_private.public_request_allowed(token) then return jsonb_build_object('error','Demasiadas consultas. Espera un minuto.'); end if;
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select invitation_id into iid from accesshome_private.invitation_tokens where token_value=token;
  if iid is null then return null; end if;
  select h.* into r from accesshome.residences h join accesshome.invitations v on v.residence_id=h.id where v.id=iid for share of h;
  select * into i from accesshome.invitations where id=iid for update;
  state:=case when i.status='activa' and i.expires_at<=clock_timestamp() then 'expirada' else i.status::text end;
  can_add:=i.vehicle_plates is null and i.used_uses=0 and state='activa' and r.active;
  -- Preserve the existing optional operation for compatible callers. The visitor
  -- page no longer exposes this form or any vehicle information.
  if vehicle is not null and vehicle<>'null'::jsonb then
    if not can_add then return jsonb_build_object('error','Solo puedes añadir un vehículo una vez, antes de entrar y con una invitación activa.'); end if;
    begin
      perform accesshome_private.fields(vehicle,array['plates','brand','model','color']);
      if coalesce(trim(vehicle->>'plates'),'')='' then raise exception 'Placas obligatorias'; end if;
      update accesshome.invitations set vehicle_plates=upper(trim(vehicle->>'plates')),vehicle_brand=coalesce(trim(vehicle->>'brand'),''),
        vehicle_model=coalesce(trim(vehicle->>'model'),''),vehicle_color=coalesce(trim(vehicle->>'color'),'') where id=i.id returning * into i;
    exception when others then return jsonb_build_object('error','Revisa los datos y las placas del vehículo.');
    end;
  end if;
  select name into condo_name from accesshome.condominiums where id=i.condominium_id;
  return jsonb_build_object('token',token,'visitorName',i.visitor_name,'residenceName',i.residence_name,
    'condominiumName',condo_name,'startsAt',i.starts_at,'expiresAt',i.expires_at,'status',state);
end $$;

revoke all on function accesshome_private.public_invitation(text,jsonb),accesshome.public_invitation(text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function accesshome_private.public_invitation(text,jsonb),accesshome.public_invitation(text,jsonb) to anon,authenticated;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',2);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;

commit;
