# Base SQL del prototipo integrado

## Estado vigente: base activa; incremental de consulta pública pendiente

El responsable confirmó que las ocho migraciones iniciales, la semilla y Auth ya funcionan remotamente. **Esta entrega añade únicamente `20260917000700_public_invitation_sharing.sql`, todavía pendiente de aplicar remotamente.** Las diez se probaron localmente; ninguna de las nueve anteriores se editó. No se modificó `.env.local`, no se crearon cuentas externas ni se ejecutó SQL remoto. La aplicación remota de la novena, de caseta, no se reconfirmó: consultar el historial antes de aplicar pendientes.

Para compartir y publicar sigue [DEPLOYMENT.md](../docs/DEPLOYMENT.md); para activar Guardia, [GUARD_SETUP.md](../docs/GUARD_SETUP.md). No repetir `seed_demo` ni las versiones ya aplicadas. Las instrucciones de instalación base que siguen son solo para proyectos nuevos; no corresponden al proyecto existente.

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
| 20260917000700 | `migrations/20260917000700_public_invitation_sharing.sql` | Proyección pública mínima, condominio y Cache-Control no-store. Conserva firma, rate limit, token, operación opcional de vehículo y grants limitados. Salud añade publicInvitationVersion: 2. Sin tablas ni cambios de filas. |
| Auditoría | `tests/security_baseline.sql` | Comprueba catálogo: tablas con RLS, políticas SELECT, grants limitados y funciones internas restringidas. No reemplaza pruebas con usuarios. |

Requieren un proyecto Supabase con `auth.users`, `auth.uid()`, `auth.jwt()` y roles PostgreSQL `anon`/`authenticated`. Se aplican como propietario de migraciones controlado (por ejemplo, `postgres` del proyecto). Los IDs de dominio usan `gen_random_uuid()` del PostgreSQL de Supabase. No necesitan Docker ni una base PostgreSQL instalada en este equipo.

En una instalación inicial los esquemas `accesshome` y `accesshome_private` deben estar libres. En el proyecto ya poblado, aplicar las incrementales faltantes en orden tras las ocho versiones iniciales; conservan sus datos. No se usa `IF NOT EXISTS` para ocultar objetos incompatibles.

## Instalación inicial manual sin CLI (solo proyecto nuevo)

1. Seleccionar el proyecto **de ensayo** correcto en el Dashboard y verificar si tiene datos/esquemas existentes. Conservar respaldo si corresponde.
2. En SQL Editor, ejecutar los ocho archivos base en el orden indicado en [SHARED_BACKEND_SETUP.md](../docs/SHARED_BACKEND_SETUP.md) y después las incrementales `20260917000600_guard_workspace.sql` y `20260917000700_public_invitation_sharing.sql`. Cada archivo tiene `begin/commit`: si falla, corregir la causa y reintentar solo la versión que no se confirmó.
3. Registrar las diez versiones aplicadas y el proyecto, sin guardar contraseñas ni claves en Git. No editar y repetir una migración ya aplicada: las correcciones posteriores requieren una nueva versión.
4. Ejecutar `tests/security_baseline.sql` completo. Debe finalizar sin excepciones; usa transacción de solo lectura y termina con `rollback`.
5. Revisar tablas/políticas en Dashboard. Exponer `accesshome` para la aplicación y mantener `accesshome_private` y `auth` fuera de los esquemas expuestos. No añadir `accesshome_private` a Extra search path. El cliente selecciona `accesshome` dentro de `services`.
6. Probar RLS con JWTs de cuentas de ensayo y la clave publishable según la matriz del plan. SQL Editor como propietario atraviesa RLS y no prueba aislamiento por usuario.

Las migraciones 001–003 por sí solas no convierten el login demo en Supabase Auth ni habilitan la sincronización; el frontend compartido requiere también las migraciones 004–008. No otorgar `ALL` a `anon` o `authenticated` para intentar usar los formularios contra esta base.

## Alternativa con CLI e historial automático

No se ha instalado ni ejecutado la CLI. Cuando esté disponible, elegir **una sola** vía de aplicación. `supabase start` y `db reset` no forman parte de esta preparación.

1. Inicializar la configuración CLI con `supabase init`, conservando estos archivos; autenticar la CLI manualmente.
2. Vincular el proyecto real con `supabase link --project-ref` seguido de su referencia real. No escribir credenciales en scripts o historial de comandos.
3. Revisar `supabase migration list` y `supabase db push --dry-run`. En un proyecto nuevo verificar las diez versiones; en uno existente, solo las incrementales aún no aplicadas.
4. Solo después de la revisión y con el proyecto autorizado, `supabase db push` aplica las versiones pendientes. No se ejecutó desde esta tarea.
5. Si se aplicó SQL Editor antes, la CLI no conocerá ese historial automáticamente: reconciliar versiones verificadas mediante `supabase migration repair` conforme a la documentación antes de usar `db push`. Nunca marcar una versión como aplicada si su esquema no coincide.

Referencia: [migraciones](https://supabase.com/docs/guides/deployment/database-migrations) y [CLI](https://supabase.com/docs/reference/cli/supabase-db-push).

## Límites de seguridad de esta base

- `anon`: USAGE de los dos esquemas para resolver funciones; sin privilegios de tablas ni CREATE. Solo ejecuta health y la proyección por token (wrapper e implementación privada). La proyección conserva el límite de frecuencia; ningún helper permite saltárselo. USAGE no expone el esquema privado en Data API.
- `authenticated`: SELECT de tablas de dominio sujeto a RLS; ninguna escritura directa. Guardia solo perfil propio/condominio. Perfil ausente/inactivo o habitante inactivo no accede a datos.
- `accesshome_private.invitation_tokens`: ningún privilegio de cliente y RLS sin políticas. El RPC de detalle devuelve un token solo al destinatario autorizado; el visitante recibe una proyección limitada por su token.
- Todos los SECURITY DEFINER están en `accesshome_private`, con `search_path` vacío, objetos calificados y autorización interna. Sus interfaces expuestas son SECURITY INVOKER. Los visitantes solo pueden ejecutar la implementación pública por token; no los helpers ni la provisión.
- Las funciones tienen autorización y grants específicos. Caseta es solo consulta en esta etapa; escaneo operativo, servicios, reportes de turno, Realtime e importación local siguen pendientes.
- Las claves secretas y de administración permanecen fuera del frontend. `.env.example` contiene únicamente las dos variables públicas necesarias para el cliente.

## Próximas migraciones

Para las próximas acciones de guardia/servicios, reutilizar la estructura existente y definir los contratos faltantes antes de añadir tablas. No modificar retroactivamente las versiones aplicadas ni habilitar publicaciones Realtime generales.
