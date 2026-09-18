begin;

-- Read-only visitor capability. Keep the signature for old callers but reject writes.
-- The rate limiter remains; no invitation rows or tokens are rewritten.
create or replace function accesshome_private.public_invitation(token text, vehicle jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i accesshome.invitations; iid uuid; state text; condo_name text;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if not accesshome_private.public_request_allowed(token) then return jsonb_build_object('error','Demasiadas consultas. Espera un minuto.'); end if;
  if vehicle is not null and vehicle<>'null'::jsonb then
    return jsonb_build_object('error','La consulta pública es de solo lectura. El residente debe definir el vehículo al crear la invitación.');
  end if;
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select invitation_id into iid from accesshome_private.invitation_tokens where token_value=token;
  if iid is null then return null; end if;
  select * into i from accesshome.invitations where id=iid;
  state:=case when i.status='activa' and i.expires_at<=clock_timestamp() then 'expirada' else i.status::text end;
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
