# Capa services de AccessHome

Las pantallas conservan los contratos de los services. Cada fachada elige, una vez por proceso, la implementación local o la compartida. No hay fallback por operación ni sincronización implícita.

- shared/provider.ts: modo compartido si cualquiera de las dos variables públicas tiene contenido.
- shared/client.ts: cliente Supabase único, schema accesshome, sesión Auth gestionada por el SDK. Solo admite clave publishable.
- shared/auth.ts: signInWithPassword, getSession + perfil desde RPC, logout y eventos diferidos para evitar reentrar en el lock de Auth.
- shared/adapters.ts: contratos existentes → RPCs tipados. No recibe tablas privadas, no guarda bases en localStorage.
- shared/transport.ts: errores y notificaciones después de escribir. Sin caché de datos de dominio.
- demoStorage.ts: exclusivo de local, rechaza cualquier acceso si el proveedor es compartido.

Todos los RPCs expuestos son security invoker. Las operaciones privilegiadas llaman implementaciones security definer del esquema privado con search_path vacío y comprobaciones explícitas de identidad/rol/propiedad. Las funciones privadas de formato no elevan privilegios; las de autorización consultan solo el actor autenticado. No se permite escritura genérica de clientes.

| Contrato | RPCs principales |
| --- | --- |
| authService | session_profile + Supabase Auth |
| communityService / householdService | community_summary, list_residences, residence_details, manage_community, manage_household |
| principalService | assign_principal (cuenta previamente vinculada) |
| contactsService | contact_access, list_contacts, contact_details, manage_contact |
| invitationsService | invitation_context, list_invitations, invitation_details, create_invitation, cancel_invitation |
| publicInvitationService | public_invitation (proyección/vehículo y límite de frecuencia) |
| accessService | active_access_invitations, validate_access, list_access |
| accessHistoryService | history_context, list_access |
| reportsService | report_context, list_reports, report_details, create_report, advance_report |
| dashboardService | admin_dashboard, resident_dashboard |
| guardService | guard_dashboard, guard_history; solo compartido, perfil guard activo, proyección mínima del condominio; sin escrituras |
| demoService | profile_context; reset rechazado en compartido |

El dominio no cambia de proveedor durante una sesión. Una configuración parcial o caída de red falla explícitamente. El modo local conserva la simulación, pero la selección de cuenta por correo no representa autenticación real.

La hora autoritativa compartida es la del servidor. Hoy/historial diario utilizan la zona del condominio; formularios personalizados y presentación de fechas usan la hora del dispositivo y envían ISO con zona. El token público se genera exclusivamente en servidor con 32 bytes CSPRNG. El UUID para request_id de acceso usa Web Crypto con disponibilidad comprobada. Un fallo ambiguo de acceso conserva el request_id en memoria para reintentar; no se guarda historia local.

Los hooks refrescan al consultar, recuperar foco/conexión o tras mutación. El polling existente pasa a 10 segundos en compartido y se pausa con pestaña oculta. Caseta/historial guard usan 30 segundos; el historial guard limita a siete días con páginas de 50 movimientos. Las consultas filtradas son nuevas cada vez. Los otros listados completos todavía no ofrecen paginación visible; usar datos de ensayo.

Validación: regresión local, PostgreSQL/PGlite, PostgreSQL nativo concurrente y SDK con HTTP simulado. Base remota activa según el responsable; incremental/rol guard remoto pendiente según [GUARD_SETUP.md](../../docs/GUARD_SETUP.md).

