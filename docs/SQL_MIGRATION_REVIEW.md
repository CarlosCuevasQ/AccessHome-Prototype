# Revisión de las ocho migraciones pendientes

17 de septiembre de 2026. Proyecto de ensayo y `.env.local` configurados por el usuario; ninguna migración aplicada todavía. Esta revisión modifica los ocho archivos pendientes, sin añadir versiones ni alterar su orden. No se modificó `.env.local` ni se mostraron sus valores; no se ejecutó SQL remoto, `db push`, commit ni push.

## Invitaciones superpuestas

`accesshome.create_invitation(jsonb)` conserva su contrato. Delega en `accesshome_private.create_invitation(jsonb)`, que autentica al residente principal y bloquea su residencia activa antes de validar o escribir.

La consulta rechaza una invitación si existe otra con el mismo `contact_id` y `residence_id`, `status = 'activa'`, vencimiento posterior al reloj real del servidor y periodos superpuestos: `existente.starts_at < nueva.expires_at AND nueva.starts_at < existente.expires_at`. Se consideran intervalos `[inicio, fin)`: 10:00–11:00 y 11:00–12:00 se permiten. Una invitación futura también bloquea otro periodo que se superponga con ella.

Canceladas, completadas y expiradas no bloquean. Una fila todavía marcada `activa` pero cuyo vencimiento ya pasó tampoco bloquea; no se necesita un cron para cambiar estados. La comprobación usa `clock_timestamp()` después de obtener el bloqueo. El rechazo tiene código SQL `P0001` y un mensaje específico de superposición, que el service muestra sin cambiar de proveedor.

El criterio es identidad de contacto y residencia, nunca nombre. Contactos distintos con igual nombre y visitantes ocasionales sin `contact_id` no se deduplican. Guardar un visitante ocasional como contacto crea una identidad nueva; esta revisión no intenta fusionar personas por datos parecidos.

### Garantía de concurrencia

Todas las altas autorizadas pasan por el RPC: los clientes no tienen `INSERT`, `UPDATE` ni `DELETE` de tablas. `managed_residence` obtiene `FOR UPDATE` de la residencia y mantiene el bloqueo hasta COMMIT/ROLLBACK. La consulta de solapamiento se ejecuta después, en otra instrucción de la función `VOLATILE`. En `READ COMMITTED`, la segunda conexión ve lo confirmado por la primera y rechaza el duplicado.

Además, el alta escribe el mismo valor de `principal_user_id` en la fila bloqueada para generar una versión MVCC. Esto no cambia la asignación, pero hace que una transacción `REPEATABLE READ` o `SERIALIZABLE` con snapshot anterior aborte con `40001` en lugar de validar contra datos antiguos. Debe reintentarse la transacción completa; al hacerlo, el conflicto vigente se rechaza con `P0001`. No hay reintento automático de creación en el frontend.

La creación, cancelación, incorporación pública de vehículo y validación de acceso conservan el orden residencia → invitación. La serialización es por residencia, suficiente para la demo. El índice parcial `invitations_active_contact_period_idx` agiliza la consulta por residencia/contacto/periodo; su predicado no depende del reloj.

La garantía corresponde a escrituras de la aplicación por RPC. Un propietario de base puede eludir estos procedimientos: cualquier importación administrativa futura debe respetar la misma regla. No se añade una restricción de exclusión con `now()` porque la expiración dinámica no es un predicado de índice inmutable.

## Funciones privilegiadas y permisos

Supabase recomienda mantener las funciones `SECURITY DEFINER` fuera de esquemas expuestos y usar `SECURITY INVOKER` por defecto, con `search_path` seguro y permisos de ejecución explícitos. Se aplicó esa separación sin modificar los nombres, parámetros, valores por defecto o tipos de retorno de las interfaces que utilizan los services. Referencias: [RLS y funciones privadas](https://supabase.com/docs/guides/database/postgres/row-level-security), [seguridad y permisos de funciones](https://supabase.com/docs/guides/database/functions).

Las 12 implementaciones privilegiadas pasan a `accesshome_private`; en `accesshome` quedan wrappers `SECURITY INVOKER`, `VOLATILE`, con `search_path = ''` y delegación calificada. Las demás consultas siguen usando `SECURITY INVOKER` y RLS.

| Implementación privada | Autorización interna | EXECUTE de cliente |
| --- | --- | --- |
| `manage_community`, `assign_principal` | Admin activo, propio condominio; asignación válida de la misma casa | `authenticated` |
| `manage_household` | Principal activo, residencia propia activa | `authenticated` |
| `manage_contact`, `create_invitation`, `cancel_invitation` | Principal, residencia activa, propiedad/destino de los registros | `authenticated` |
| `invitation_details` | Admin del condominio o residente activo de esa casa | `authenticated` |
| `active_access_invitations`, `validate_access` | Admin activo del condominio; validación conserva bloqueos e idempotencia | `authenticated` |
| `create_report`, `advance_report` | Principal de su casa / admin del condominio, respectivamente | `authenticated` |
| `public_invitation` | Token criptográfico, proyección limitada, límite de frecuencia y reglas de vehículo | `anon`, `authenticated` |

Los wrappers necesitan `USAGE` del esquema privado y `EXECUTE` únicamente sobre la implementación correspondiente. Por ello `anon` recibe `USAGE` de `accesshome_private`, pero solo puede ejecutar allí `public_invitation(text,jsonb)`: no puede consultar tablas, crear objetos ni llamar al helper que cobra el límite. `USAGE` **no equivale a exponer un esquema en Data API**. Mantener exclusivamente `accesshome` como esquema expuesto de la aplicación y dejar `accesshome_private` fuera también de Extra search path.

Ocultar el esquema no sustituye autorización: las funciones privadas comprueban por sí mismas `auth.uid()`, perfil activo, rol y residencia. Las pruebas llaman directamente a las implementaciones privadas para comprobar que no existe un atajo. El visitante conserva el acceso por token incluso sin sesión; ese contrato no da acceso general a las tablas.

Se revocan grants implícitos de `PUBLIC`, `anon`, `authenticated` y `service_role` antes de otorgar los permisos específicos. No se otorga escritura general. Los helpers internos sin interfaz (`managed_residence`, `public_request_allowed`) y los procedimientos de provisión (`seed_demo`, `provision_resident`) no son ejecutables por clientes. El propietario controlado conserva la provisión. Guardia sigue sin funciones operativas.

`security_baseline.sql` ahora rechaza funciones definer en `accesshome`, paths inseguros, privilegios CREATE de cliente, grants PUBLIC/service_role y funciones privadas privilegiadas fuera de la lista permitida. No puede certificar la configuración del Dashboard remoto: debe comprobarse antes de activar Data API.

## Archivos de migración

| Archivo en `supabase/migrations/` | Cambio en esta revisión |
| --- | --- |
| `20260916000100_community.sql` | Revocación explícita también de `service_role` en esquemas/tablas |
| `20260916000200_visits_and_reports.sql` | Revocación explícita también de `service_role` en tablas |
| `20260916000300_read_policies.sql` | Revocación explícita también de `service_role` en helpers |
| `20260917000100_shared_community.sql` | Tres implementaciones privadas, wrappers y grants limitados |
| `20260917000200_shared_invitations.sql` | Cuatro implementaciones privadas, wrappers, índice y prevención de superposición concurrente |
| `20260917000300_shared_public_and_access.sql` | Tres implementaciones privadas, wrappers, USAGE privado y único EXECUTE anónimo necesario |
| `20260917000400_shared_reports_and_dashboards.sql` | Dos implementaciones privadas, wrappers y grants limitados |
| `20260917000500_controlled_demo_provisioning.sql` | Revocación explícita de `service_role` para health; provisión sigue solo para propietario |

No se cambia la estructura de los DTO ni se necesitan cambios de pantallas/services. Las ocho migraciones se aplican completas en el orden documentado. Esta edición es válida porque ninguna versión se ha aplicado; si eso cambia, no repetir archivos sobre una base ya migrada.

Otros archivos modificados o añadidos en esta revisión:

- `supabase/tests/security_baseline.sql`: auditoría de catálogo y lista exacta de privilegios.
- `tests/shared-backend.test.mjs`: cinco casos nuevos de superposición y seguridad.
- `tests/helpers/shared-sql-fixture.mjs`: instalación de las ocho migraciones y Auth simulado reutilizable en ambos motores locales.
- `tests/concurrency/invitations.test.mjs`: nueve pruebas con PostgreSQL nativo y conexiones independientes.
- `package.json`, `package-lock.json`: comando `test:concurrency`, PostgreSQL temporal y cliente como dependencias de desarrollo.
- `README.md`, `supabase/README.md`, `docs/SHARED_BACKEND_SETUP.md`, `docs/SHARED_BACKEND_PLAN.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md` y este informe: estado vigente, pasos de activación, pruebas y límites.

## Pruebas locales y pendientes

Resultado de esta revisión: **139/139** pruebas con `npm test`, **9/9** pruebas nativas con `npm run test:concurrency` y `npm run build` correcto. Vite conserva la advertencia previa de chunk superior a 500 kB. Las ocho migraciones y la auditoría pasaron tanto en PGlite como en PostgreSQL 17.10 nativo.

`npm test` incluye la suite SQL/PGlite, regresión local y adaptadores HTTP simulados. Se prueban igualdad, inclusiones, intersecciones parciales, ventanas futuras, límites adyacentes, estados no bloqueantes, expiración real, identidad/contacto/casa, tokens sin escrituras parciales, firmas de wrappers y denegación de llamadas privadas por rol.

`npm run test:concurrency` inicia un PostgreSQL 17.10 temporal con tres conexiones TCP independientes en `127.0.0.1`, contraseña efímera y puerto disponible. Instala las ocho migraciones y audita el catálogo. No lee archivos `.env`, no acepta URL remota, no crea usuarios del sistema ni utiliza Docker. Al terminar detiene su cluster y elimina solo su directorio temporal recién creado. Requiere poder ejecutar binarios nativos (dependencia de desarrollo `embedded-postgres` fijada en el lockfile); en Linux debe ejecutarse como usuario no root.

La prueba no usa solo una pausa como evidencia: consulta `pg_blocking_pids` y exige observar al segundo backend bloqueado por el primero. Comprueba cinco carreras idénticas, superposición parcial, periodos adyacentes, rollback, snapshots antiguos en dos niveles de aislamiento, cancelación concurrente y expiración durante la espera. Verifica cantidades de invitaciones/tokens y errores, con timeouts para no quedar esperando indefinidamente.

Pendientes remotos: ejecutar las migraciones autorizadas, auditoría de catálogo, confirmar esquemas expuestos/Extra search path, ejecutar `backend:check` y probar Auth/PostgREST con JWT reales y los dos navegadores del recorrido SB-01–SB-08. Las pruebas locales simulan Auth y no certifican políticas/configuración del proyecto remoto. El control público de frecuencia sigue siendo básico; no es protección completa contra DoS.

Fundamento de la concurrencia: [aislamiento de PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html) y [snapshots de funciones VOLATILE](https://www.postgresql.org/docs/current/xfunc-volatility.html). Herramienta de prueba: [embedded-postgres](https://github.com/leinelissen/embedded-postgres).
