begin;

-- The public projection adds residenceActive, read in the same query as the
-- invitation. An inactive house rejects new entries in validate_access; the
-- visitor page must not present that invitation as usable for entering.
-- Same signature, rate limit, no-store and read-only vehicle rule as before.
-- No new grants, tables or row changes; create or replace keeps EXECUTE.
create or replace function accesshome_private.public_invitation(token text, vehicle jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare projection jsonb;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if not accesshome_private.public_request_allowed(token) then return jsonb_build_object('error','Demasiadas consultas. Espera un minuto.'); end if;
  if vehicle is not null and vehicle<>'null'::jsonb then
    return jsonb_build_object('error','La consulta pública es de solo lectura. El residente debe definir el vehículo al crear la invitación.');
  end if;
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select jsonb_build_object('token',token,'visitorName',v.visitor_name,'residenceName',v.residence_name,
    'condominiumName',c.name,'startsAt',v.starts_at,'expiresAt',v.expires_at,
    'status',case when v.status='activa' and v.expires_at<=clock_timestamp() then 'expirada' else v.status::text end,
    'hasOpenEntry',
    (select count(*)=1 from accesshome.access_records e where e.invitation_id=v.id and e.direction='entrada')
    and not exists(select 1 from accesshome.access_records x where x.invitation_id=v.id and x.direction='salida'),
    'residenceActive',h.active)
    into projection
    from accesshome.invitations v
    join accesshome_private.invitation_tokens t on t.invitation_id=v.id
    join accesshome.condominiums c on c.id=v.condominium_id
    join accesshome.residences h on h.id=v.residence_id and h.condominium_id=v.condominium_id
    where t.token_value=token;
  return projection;
end $$;

create or replace function accesshome.backend_health() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('application','AccessHome','schemaVersion',9,'guardWorkspaceVersion',1,'publicInvitationVersion',4,
   'guardScanningVersion',1,'openVisitExitsVersion',1,'serviceAccessVersion',1,'guardReportsVersion',1,'guardReportLogVersion',1,
   'inactiveResidenceExitVersion',1);
$$;
revoke all on function accesshome.backend_health() from public,anon,authenticated,service_role;
grant execute on function accesshome.backend_health() to anon,authenticated;

commit;
