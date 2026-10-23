# Base SQL del prototipo integrado

## Estado vigente: gestión de guardias por el administrador pendiente (versión 18)

**Esta entrega añade únicamente `20261021000300_admin_guard_management.sql`, pendiente de aplicar remotamente.** El admin activo lista los guardias de su condominio (`list_guards`) y los activa o desactiva (`set_guard_status`); rol y condominio salen del perfil autenticado y solo cambia `profiles.active`. Identificadores inexistentes, de otro condominio o que no son de guardia reciben el mismo rechazo. Cada cambio efectivo queda en la tabla privada `accesshome_private.guard_status_changes` con su origen; repetir el mismo estado no escribe. El bloqueo del responsable del sistema (`set_guard_active(..., false)`, solo propietario) se guarda en la tabla privada `accesshome_private.guard_owner_blocks` y prevalece: mientras exista, el guardia permanece inactivo y el administrador no puede reactivarlo; solo `set_guard_active(..., true)` lo retira. Una desactivación del administrador no crea ese bloqueo. Al aplicarse, la migración convierte en bloqueo del responsable a cada guardia que ya estaba inactivo (hasta ahora solo `set_guard_active` podía desactivarlos); no reactiva a nadie, no modifica otras filas y no inventa bitácora para cambios anteriores, que nunca se registraron. La migración bloquea las escrituras de `profiles` (`lock table … share row exclusive`) antes de la retroconversión, de modo que ninguna desactivación queda entre esta y las barreras; las lecturas no se bloquean. Barreras de triggers (operaciones protegidas): cambiar `profiles.active` de un guardia fuera de `set_guard_active`/`set_guard_status` (marca transaccional `accesshome.guard_status_writer`, cerrada al terminar cada función y revertida con la transacción si falla), activar a un guardia con bloqueo, cualquier cambio de rol hacia o desde `guard` (ninguna función cambia roles y `provision_guard` rechaza otros roles; así un guardia bloqueado no puede pasar a admin activo y volver a guard), escribir `guard_owner_blocks` fuera de `set_guard_active` o sobre un guardia activo, y `TRUNCATE`. `require_guard` también rechaza a un guardia con bloqueo en cada solicitud. `security_baseline.sql` comprueba que los tres triggers existen, apuntan a su función y están habilitados.

**Límite de confianza.** Frente a los clientes (`anon`, `authenticated`) la barrera son los permisos: no tienen escritura sobre `profiles` ni privilegio alguno sobre las tablas privadas, y solo ejecutan `list_guards` y `set_guard_status`, que autorizan dentro. Los triggers protegen frente a errores de roles privilegiados, no frente al propietario: la marca no es un secreto ni un mecanismo de autorización, y el propietario o un superusuario está dentro del límite de confianza (puede fijarla, deshabilitar triggers o alterar la configuración). `set_guard_active` y `set_guard_status` registran cada cambio efectivo de forma atómica con su origen; una escritura directa del propietario fuera de esas funciones no debe considerarse auditada por ese solo hecho. `provision_guard` no cambia; `set_guard_active` y `require_guard` se redefinen con la misma firma, errores y permisos. `backend_health` añade `guardManagementVersion: 1`. Orden: aplicar, ejecutar `security_baseline.sql` (incluye `set_guard_status` en la lista de definers permitidos) y comprobar `guardManagementVersion: 1` con `npm run backend:check` antes de publicar una interfaz que la use. Hasta entonces la gestión de guardias no está disponible en producción y `backend:check` la informa como pendiente.

Estado conocido: el repositorio contiene dieciocho migraciones. En remoto están aplicadas las diecisiete hasta `20261021000200` (`supabase migration list` sincronizado y `npm run backend:check` con `publicInvitationVersion: 4`, 2026-10-21). `20261021000300` sigue pendiente.

## Etapa anterior (17): disponibilidad pública por casa (aplicada)

**Esa entrega añadió únicamente `20261021000200_public_invitation_residence_state.sql`, aplicada después en remoto.** `public_invitation` conserva firma, campos, límite y no-store, y añade `residenceActive` (estado de la casa leído en SQL). La vista del visitante deja de presentar como utilizable para entrar una invitación de una casa inactiva; si hay visita abierta muestra QR solo de salida. `backend_health` sube `publicInvitationVersion` a 4. Sin tablas, grants ni cambios de filas. Orden obligatorio: aplicar `20261021000200`, ejecutar `security_baseline.sql`, comprobar con `npm run backend:check` que informa `publicInvitationVersion: 4` y solo después publicar el frontend. Si el frontend llegara antes, la vista pública conservaría el comportamiento anterior (QR visible) hasta aplicar la migración; caseta sigue rechazando esas entradas.

Estado de esa etapa al redactarse: el repositorio contenía diecisiete migraciones y en remoto estaban aplicadas las dieciséis hasta `20261021000100` (`inactiveResidenceExitVersion: 1`). `20261021000200` se aplicó después (ver estado vigente).

Etapa anterior (16): el 2026-10-21 `npm run backend:check` (solo lectura) detectó en remoto hasta `guardReportLogVersion: 1`, es decir, las quince versiones hasta `20261007000200`. **Esa entrega añadió únicamente `20261021000100_inactive_residence_exit.sql`, aplicada después en remoto (ver estado conocido).** Redefine `validate_access` para que un guardia cierre una visita abierta aunque la casa esté desactivada, sin permitir entradas. Las dieciséis se probaron localmente; ninguna de las quince anteriores se editó. Guía: [OPEN_VISIT_EXITS.md](../docs/OPEN_VISIT_EXITS.md). Sin `.env.local`, cuentas nuevas ni SQL remoto.

Etapa anterior: `20261007000200_guard_report_log.sql` (bitácora de caseta); guía en [GUARD_REPORTS.md](../docs/GUARD_REPORTS.md).

Para escaneo sigue [GUARD_SCANNING.md](../docs/GUARD_SCANNING.md); para compartir/publicar, [DEPLOYMENT.md](../docs/DEPLOYMENT.md); para provisionar Guardia, [GUARD_SETUP.md](../docs/GUARD_SETUP.md). No repetir `seed_demo` ni las versiones ya aplicadas. Las instrucciones de instalación base que siguen son solo para proyectos nuevos; no corresponden al proyecto existente.

Revisión previa del 17 de septiembre: las ocho migraciones base incorporaron prevención de superposición concurrente y separación de funciones privilegiadas. Consulta [SQL_MIGRATION_REVIEW.md](../docs/SQL_MIGRATION_REVIEW.md) para el registro histórico. La incremental conserva esos contratos y políticas.

Las tres primeras migraciones crean el esquema y las políticas base. Las cinco siguientes agregan RPCs con autorización, tokens públicos criptográficos, operaciones atómicas, dashboards, reportes y provisión controlada.

Diseño completo, matriz de permisos y orden de adaptación: [SHARED_BACKEND_PLAN.md](../docs/SHARED_BACKEND_PLAN.md).

## Archivos y orden

| Versión | Archivo | Resultado |
| --- | --- | --- |
| 20260916000100 | `migrations/20260916000100_community.sql` | Esquemas propios, tres roles, condominio, perfiles Auth, casas, habitantes y vehículos; FK, índices y RLS sin acceso inicial. |
| 20260916000200 | `migrations/20260916000200_visits_and_reports.sql` | Contactos/vehículos, invitaciones, tokens privados, movimientos y reportes; snapshots e integridad. |
| 20260916000300 | `migrations/20260916000300_read_policies.sql` | Funciones internas de autorización y diez políticas SELECT por condominio/casa/autor. |
| 20260917000100–00500 | `migrations/20260917000*.sql` | Adaptadores SQL, RPCs de comunidad/contactos/invitaciones/accesos/reportes, tokens CSPRNG, límite público, dashboards y provisión controlada. |
| 20260917000600 | `migrations/20260917000600_guard_workspace.sql` | Sesión guard, consultas mínimas de caseta/historial y provisión/activación privadas. Sin nuevas tablas ni cambios de datos. |
| 20260917000700 | `migrations/20260917000700_public_invitation_sharing.sql` | Proyección pública mínima, condominio y Cache-Control no-store. Conserva firma/rate limit/token, pero rechaza `vehicle` no nulo como solo lectura; grants limitados. Salud añade publicInvitationVersion: 2. Sin tablas ni cambios de filas. |
| 20260918000100 | `migrations/20260918000100_guard_scanning.sql` | Amplía validate_access para guard/admin con un solo motor; método MANUAL y nombre de operador en movimientos. Protección concurrente, secuencia, reintentos y DTO guard mínimo. Salud añade guardScanningVersion: 1. Sin tablas nuevas ni reescritura de datos. |
| Auditoría | `tests/security_baseline.sql` | Comprueba catálogo: tablas con RLS, políticas SELECT, grants limitados y funciones internas restringidas. No reemplaza pruebas con usuarios. |
| 20260918000200 | `migrations/20260918000200_open_visit_exits.sql` | Indicador público hasOpenEntry, pendientes mínimos y salida manual por ID de entrada delegada al motor existente. Salud: publicInvitationVersion 3 y openVisitExitsVersion 1. Solo funciones/permisos, sin cambios de filas. |
| 20260919000100 | `migrations/20260919000100_service_access.sql` | service_visits/service_events, RLS admin propio condominio, context/list/command privados con wrappers mínimos. Llegada, decisión y movimientos MANUAL con guardia activo, concurrencia e idempotencia. Salud: serviceAccessVersion 1. No cambia filas anteriores. |
| 20261007000100 | `migrations/20261007000100_guard_reports.sql` | guard_shift_reports con snapshot/IDs fuente, métricas calculadas desde access_records/service_events, RLS propio guardia/admin del condominio y RPC guard_reports privado con wrapper mínimo. Unicidad, locks e idempotencia; guardReportsVersion 1, schemaVersion 9 sin cambios. No altera fuentes. |
| 20261007000200 | `migrations/20261007000200_guard_report_log.sql` | guard_report_log paginado y autorizado, proyección explícita de fuentes inmutables; shift_snapshot amplía referencias de contexto/cancelación manteniendo métricas. Sin tablas/grants de lectura directa/backfill. guardReportLogVersion 1. |
| 20261021000100 | `migrations/20261021000100_inactive_residence_exit.sql` | `validate_access` permite a un guardia activo del condominio cerrar una visita abierta (`entries=1`, `exits=0`, `used_uses=1`) con la casa inactiva; entradas siguen rechazadas. Resto del motor literal. Sin tablas, grants ni cambios de filas. inactiveResidenceExitVersion 1. |
| 20261021000200 | `migrations/20261021000200_public_invitation_residence_state.sql` | `public_invitation` añade `residenceActive` (join a la casa de la invitación) sin cambiar firma, demás campos, límite, no-store ni rechazo de `vehicle`. publicInvitationVersion 4. Sin tablas, grants ni cambios de filas. |
| 20261021000300 | `migrations/20261021000300_admin_guard_management.sql` | `list_guards` (invoker, RLS) y `set_guard_status` (wrapper invoker sobre definer privado) para el admin activo del propio condominio; solo cambia `profiles.active` de perfiles guard. Bloqueo del responsable en `guard_owner_blocks` (redefine `set_guard_active`, mismo contrato), sembrado con los guardias ya inactivos sin inventar bitácora. Triggers `profiles_guard_active_write_rules`, `guard_owner_blocks_write_rules` y `guard_owner_blocks_no_truncate`: fuera de las dos funciones auditadas rechazan cambios de `active` de guardias y de bloqueos, cambios de rol hacia o desde `guard` y la activación de un guardia bloqueado (no frenan a un propietario que deshabilite triggers o fije la marca). `require_guard` rechaza guardias bloqueados. Bitácora `guard_status_changes` con origen. Tablas privadas con RLS y sin grants. guardManagementVersion 1. |

Requieren un proyecto Supabase con `auth.users`, `auth.uid()`, `auth.jwt()` y roles PostgreSQL `anon`/`authenticated`. Se aplican como propietario de migraciones controlado (por ejemplo, `postgres` del proyecto). Los IDs de dominio usan `gen_random_uuid()` del PostgreSQL de Supabase. No necesitan Docker ni una base PostgreSQL instalada en este equipo.

En una instalación inicial los esquemas `accesshome` y `accesshome_private` deben estar libres. En el proyecto ya poblado, aplicar las incrementales faltantes en orden tras las ocho versiones iniciales; conservan sus datos. No se usa `IF NOT EXISTS` para ocultar objetos incompatibles.

## Instalación inicial manual sin CLI (solo proyecto nuevo)

1. Seleccionar el proyecto **de ensayo** correcto en el Dashboard y verificar si tiene datos/esquemas existentes. Conservar respaldo si corresponde.
2. En SQL Editor, ejecutar los ocho archivos base en el orden indicado en [SHARED_BACKEND_SETUP.md](../docs/SHARED_BACKEND_SETUP.md) y después las diez incrementales de la tabla en orden hasta `20261021000300`. Cada archivo tiene `begin/commit`: si falla, corregir la causa y reintentar solo la versión que no se confirmó.
3. Registrar las dieciocho versiones aplicadas y el proyecto, sin guardar contraseñas ni claves en Git. No editar y repetir una migración ya aplicada: las correcciones posteriores requieren una nueva versión.
4. Ejecutar `tests/security_baseline.sql` completo. Debe finalizar sin excepciones; usa transacción de solo lectura y termina con `rollback`.
5. Revisar tablas/políticas en Dashboard. Exponer `accesshome` para la aplicación y mantener `accesshome_private` y `auth` fuera de los esquemas expuestos. No añadir `accesshome_private` a Extra search path. El cliente selecciona `accesshome` dentro de `services`.
6. Probar RLS con JWTs de cuentas de ensayo y la clave publishable según la matriz del plan. SQL Editor como propietario atraviesa RLS y no prueba aislamiento por usuario.

Las migraciones 001–003 por sí solas no convierten el login demo en Supabase Auth ni habilitan la sincronización; el frontend compartido requiere también las migraciones 004–008. No otorgar `ALL` a `anon` o `authenticated` para intentar usar los formularios contra esta base.

## Alternativa con CLI e historial automático

No se ha instalado ni ejecutado la CLI. Cuando esté disponible, elegir **una sola** vía de aplicación. `supabase start` y `db reset` no forman parte de esta preparación.

1. Inicializar la configuración CLI con `supabase init`, conservando estos archivos; autenticar la CLI manualmente.
2. Vincular el proyecto real con `supabase link --project-ref` seguido de su referencia real. No escribir credenciales en scripts o historial de comandos.
3. Revisar `supabase migration list` y `supabase db push --dry-run`. En un proyecto nuevo verificar las dieciocho versiones; en el proyecto existente debe faltar únicamente `20261021000300`.
4. Solo después de la revisión y con el proyecto autorizado, `supabase db push` aplica las versiones pendientes. No se ejecutó desde esta tarea.
5. Si se aplicó SQL Editor antes, la CLI no conocerá ese historial automáticamente: reconciliar versiones verificadas mediante `supabase migration repair` conforme a la documentación antes de usar `db push`. Nunca marcar una versión como aplicada si su esquema no coincide.

Referencia: [migraciones](https://supabase.com/docs/guides/deployment/database-migrations) y [CLI](https://supabase.com/docs/reference/cli/supabase-db-push).

## Límites de seguridad de esta base

- `anon`: USAGE de los dos esquemas para resolver funciones; sin privilegios de tablas ni CREATE. Solo ejecuta health y la proyección por token (wrapper e implementación privada). La proyección conserva el límite de frecuencia; ningún helper permite saltárselo. USAGE no expone el esquema privado en Data API.
- `authenticated`: SELECT de tablas de dominio sujeto a RLS; ninguna escritura directa. Guardia solo perfil propio/condominio. Perfil ausente/inactivo o habitante inactivo no accede a datos.
- `accesshome_private.invitation_tokens`: ningún privilegio de cliente y RLS sin políticas. El RPC de detalle devuelve un token solo al destinatario autorizado; el visitante recibe una proyección limitada por su token.
- Todos los SECURITY DEFINER están en `accesshome_private`, con `search_path` vacío, objetos calificados y autorización interna. Sus interfaces expuestas son SECURITY INVOKER. Los visitantes solo pueden ejecutar la implementación pública por token; no los helpers ni la provisión.
- Las funciones tienen autorización y grants específicos. Guardia consulta caseta e invoca validate_access del propio condominio; no administra ni escribe tablas. Servicios y cierres reutilizan autorización, bloqueo e idempotencia, sin tocar invitaciones. Solo guardias activos generan cierres; admin consulta su condominio. Cierres remotos requieren la nueva incremental y aceptación manual. Realtime e importación local siguen fuera de alcance.
- Las claves secretas y de administración permanecen fuera del frontend. `.env.example` contiene únicamente las dos variables públicas necesarias para el cliente.

## Próximas migraciones

Los cierres guardan las referencias fuente que justifican sus métricas; una futura ampliación debe conservar esos snapshots y no confundir llegadas/decisiones con entradas físicas. No modificar retroactivamente las versiones aplicadas ni habilitar publicaciones Realtime generales.
