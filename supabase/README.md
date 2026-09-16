# Base SQL del prototipo integrado

**Preparada, sin aplicar.** La aplicación actual no utiliza Supabase. Estas migraciones crean el esquema y abren únicamente lecturas autenticadas con RLS; las escrituras y la vista pública por token siguen cerradas hasta sus RPCs.

Diseño completo, matriz de permisos y orden de adaptación: [SHARED_BACKEND_PLAN.md](../docs/SHARED_BACKEND_PLAN.md).

## Archivos y orden

| Versión | Archivo | Resultado |
| --- | --- | --- |
| 20260916000100 | `migrations/20260916000100_community.sql` | Esquemas propios, tres roles, condominio, perfiles Auth, casas, habitantes y vehículos; FK, índices y RLS sin acceso inicial. |
| 20260916000200 | `migrations/20260916000200_visits_and_reports.sql` | Contactos/vehículos, invitaciones, tokens privados, movimientos y reportes; snapshots e integridad. |
| 20260916000300 | `migrations/20260916000300_read_policies.sql` | Funciones internas de autorización y diez políticas SELECT por condominio/casa/autor. |
| Auditoría | `tests/security_baseline.sql` | Comprueba catálogo: once tablas con RLS, diez políticas SELECT, grants limitados y funciones internas restringidas. No reemplaza pruebas con usuarios. |

Requieren un proyecto Supabase con `auth.users`, `auth.uid()`, `auth.jwt()` y roles PostgreSQL `anon`/`authenticated`. Se aplican como propietario de migraciones controlado (por ejemplo, `postgres` del proyecto). Los IDs de dominio usan `gen_random_uuid()` del PostgreSQL de Supabase. No necesitan Docker ni una base PostgreSQL instalada en este equipo.

Los esquemas `accesshome` y `accesshome_private` deben estar libres. No se usa `IF NOT EXISTS` para ocultar objetos incompatibles. Las FK nuevas solo afectan estas tablas y su relación con Auth; no se crean usuarios, no se importan datos, no se cambian tablas de otras aplicaciones. No hay seed con contraseñas ni instrucciones de reset.

## Aplicación manual sin CLI

1. Seleccionar el proyecto **de ensayo** correcto en el Dashboard y verificar si tiene datos/esquemas existentes. Conservar respaldo si corresponde.
2. En SQL Editor, ejecutar completo el archivo 001, luego 002, luego 003. Cada archivo tiene `begin/commit`: si falla, corregir la causa y reintentar solo la versión que no se confirmó; no continuar con una migración fallida.
3. Registrar las tres versiones aplicadas y el proyecto, sin guardar contraseñas ni claves en Git. No editar y repetir una migración ya aplicada: las correcciones posteriores requieren una nueva versión.
4. Ejecutar `tests/security_baseline.sql` completo. Debe finalizar sin excepciones; usa transacción de solo lectura y termina con `rollback`.
5. Revisar tablas/políticas en Dashboard. Mantener `accesshome_private` y `auth` fuera de los esquemas expuestos. Cuando se implemente el adaptador, exponer `accesshome` en Data API. El futuro cliente usará `.schema('accesshome')` exclusivamente dentro de `services`.
6. Probar RLS con JWTs de cuentas de ensayo y la clave publishable según la matriz del plan. SQL Editor como propietario atraviesa RLS y no prueba aislamiento por usuario.

Aplicar estos archivos no convierte el login demo en Supabase Auth ni habilita la sincronización. No otorgar `ALL` a `anon` o `authenticated` para intentar usar los formularios actuales contra esta base.

## Alternativa con CLI e historial automático

No se ha instalado ni ejecutado la CLI. Cuando esté disponible, elegir **una sola** vía de aplicación. `supabase start` y `db reset` no forman parte de esta preparación.

1. Inicializar la configuración CLI con `supabase init`, conservando estos archivos; autenticar la CLI manualmente.
2. Vincular el proyecto real con `supabase link --project-ref` seguido de su referencia real. No escribir credenciales en scripts o historial de comandos.
3. Revisar `supabase migration list` y `supabase db push --dry-run`. Verificar que el destino y las tres versiones sean correctos.
4. Solo después de la revisión y con el proyecto autorizado, `supabase db push` aplica las versiones pendientes. No se ejecutó desde esta tarea.
5. Si se aplicó SQL Editor antes, la CLI no conocerá ese historial automáticamente: reconciliar versiones verificadas mediante `supabase migration repair` conforme a la documentación antes de usar `db push`. Nunca marcar una versión como aplicada si su esquema no coincide.

Referencia: [migraciones](https://supabase.com/docs/guides/deployment/database-migrations) y [CLI](https://supabase.com/docs/reference/cli/supabase-db-push).

## Límites de seguridad de esta base

- `anon`: sin uso de esquemas/tablas ni ejecución de funciones internas. Todavía no existe RPC público.
- `authenticated`: SELECT de tablas de dominio sujeto a RLS; ninguna escritura directa. Guardia solo perfil propio/condominio. Perfil ausente/inactivo o habitante inactivo no accede a datos.
- `accesshome_private.invitation_tokens`: ningún privilegio de cliente y RLS sin políticas. Futuro RPC devuelve un token solo al destinatario autorizado; el visitante recibe una proyección limitada por su token.
- Los helpers privados son `security definer` para consultar perfiles sin recursión; `search_path` vacío y objetos calificados. No exponer su esquema por REST ni otorgar ejecución a visitantes.
- Las futuras funciones transaccionales necesitan sus propios controles de autorización y grants específicos. El esquema base no implementa aún la inmutabilidad mediante RPCs, provisión de cuentas, asignación de principal, reloj/consumo transaccional o cambios de estado. No hay vía de escritura de cliente que pueda eludir esos controles pendientes.
- Las claves secretas y de administración permanecen fuera del frontend. `.env.example` contiene únicamente variables públicas vacías, reservadas para Prompt 9.

## Próximas migraciones

Agregar RPCs por módulo y pruebas de éxito/rechazo antes de conceder `EXECUTE`. Para servicio/guardia, definir primero los contratos de `service_accesses` y `guard_reports` del plan. No modificar retroactivamente las versiones aplicadas ni habilitar publicaciones Realtime generales.
