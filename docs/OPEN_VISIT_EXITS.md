# Salidas de visitas abiertas, con o sin QR

El responsable confirmó las once migraciones anteriores aplicadas y el flujo QR probado en dispositivos reales. Esta mejora requiere **la duodécima migración, `20260918000200_open_visit_exits.sql`, pendiente de aplicación remota**. Esta entrega solo ejecutó pruebas locales; no aplicó SQL remoto, no cambió `.env.local` y no hizo commit, push ni despliegue.

## Aplicar al proyecto existente

1. Revisar el historial del mismo proyecto Supabase de ensayo. Las once versiones hasta `20260918000100` deben constar como aplicadas. Si se aplicaron por SQL Editor, reconciliar el historial antes de utilizar la CLI. No repetirlas, editarlas, ejecutar `seed_demo` ni reiniciar la base.
2. Revisar y aplicar únicamente [20260918000200_open_visit_exits.sql](../supabase/migrations/20260918000200_open_visit_exits.sql), completa, como propietario controlado. Contiene su propia transacción. Son instrucciones para el responsable: no se ejecutaron remotamente en esta entrega.
3. Ejecutar [security_baseline.sql](../supabase/tests/security_baseline.sql), ahora para doce migraciones. Debe terminar sin excepciones. Mantener `accesshome_private` fuera de Data API y Extra search path. No añadir grants generales ni cambiar políticas RLS.
4. Ejecutar `npm run backend:check`: esperar `schemaVersion: 9`, `guardWorkspaceVersion: 1`, `guardScanningVersion: 1`, **`publicInvitationVersion: 3` y `openVisitExitsVersion: 1`**. La versión base no cuenta archivos de migración. Este chequeo no sustituye las pruebas Auth/PostgREST.
5. Publicar el frontend actualizado por el procedimiento autorizado de [DEPLOYMENT.md](DEPLOYMENT.md). No requiere variables, cuentas, claves ni dependencias nuevas. Usar las dos variables públicas existentes del proyecto de ensayo.

La migración solo crea/reemplaza funciones y sus permisos. No crea tablas, altera filas existentes, genera tokens, extiende vigencias ni reactiva invitaciones. Una prueba de actualización compara todas las filas antes y después y verifica igualdad. Antes de aplicarla, el frontend anterior sigue siendo compatible; el nuevo frontend sobre un backend anterior mantiene oculto el QR revocado si falta el indicador y muestra un error al consultar el RPC manual ausente. Aplicar primero el backend.

## QR del visitante

`public_invitation` conserva la firma y la proyección anterior y agrega únicamente `hasOpenEntry`: exactamente una entrada en `access_records` y ninguna salida para esa invitación. Se obtiene en la misma consulta que el estado y los datos públicos. No se infiere del contador, del reloj local ni de localStorage. No expone IDs internos, placas, guardia, hora de entrada ni historial. `vehicle` no nulo sigue rechazado; se mantienen no-store y el límite de consultas.

| Estado del servidor | Entrada abierta | Presentación |
| --- | --- | --- |
| Activa | No o sí | QR habitual, sujeto a validación en caseta |
| Expirada / cancelada | Sí | Mismo QR y aviso **Código válido únicamente para salida** |
| Expirada / cancelada | No | QR oculto, sin código presentado como utilizable |
| Completada | Cualquiera | Estado final y QR oculto |

La página vuelve a consultar al abrir, recuperar foco/conexión, pulsar Actualizar estado y cada 10 segundos estando visible. Un fallo de consulta oculta los datos previos. La presentación nunca concede acceso: `validate_access` sigue rechazando entradas inválidas y valida cada salida. El detalle privado del residente conserva su comportamiento; desde él se puede abrir/compartir la vista pública actualizada.

## Salida sin QR

Desde caseta, menú o escáner, abrir **Registrar salida sin QR** (`/guardia/salidas`). La lista muestra nombre, residencia, placas si existen y hora de entrada en la zona del condominio. Incluye entradas antiguas; tiene páginas de 50 filas y se actualiza cada 30 segundos, al recuperar foco/conexión y manualmente. Seleccionar una visita muestra confirmación con visitante, residencia y hora antes de llamar al backend. Verificar identidad/vehículo en caseta; el sistema no reconoce personas automáticamente.

`guard_open_visits(page)` y `guard_register_exit(entry_id, request_id)` son interfaces `SECURITY INVOKER`; solo `authenticated` recibe EXECUTE. Su implementación privada comprueba un guardia activo del condominio mediante `require_guard`. Anónimos, residentes y administradores no pueden usar la operación ni llamar directamente a la implementación privada para eludirla. Guardias ajenos reciben lista vacía / entrada no encontrada. No se conceden nuevas lecturas o escrituras de tablas.

El identificador seleccionado es el del **registro de entrada**, no el token público ni el ID de invitación. El servidor bloquea residencia → invitación, comprueba exactamente una entrada sin salida y uso 1, y delega en el mismo `validate_access(..., 'MANUAL')` manteniendo los bloqueos. No implementa otro motor ni inserta movimientos por una segunda vía. Se conservan fecha del servidor, guardia, método MANUAL, snapshots del estado anterior y las restricciones de integridad existentes. Una salida completada consume el segundo uso y queda completada; no cambia las fechas ni permite volver a entrar.

El `request_id` permite recuperar la misma salida del mismo actor; no puede reutilizarse para otra visita, otro guardia, otro método ni una entrada. Solicitudes simultáneas manual/manual o manual/QR producen una sola salida. Una lista desactualizada se rechaza al confirmar. Se mantiene la separación de 3 segundos entre movimientos, la comprobación de residencia activa, vigencia ya iniciada y secuencia coherente. Si la residencia está inactiva o el historial es inconsistente, se requiere revisión administrativa: no se debilitan estas reglas en esta etapa.

En el frontend, el botón queda bloqueado durante la petición. Si se pierde la respuesta, **Reintentar la misma salida** conserva el ID en memoria. Cambiar de cuenta/cerrar sesión limpia ese intento. Recargar o cerrar el navegador pierde el intento en memoria: consultar pendientes/historial antes de repetir; el backend sigue impidiendo una segunda salida. Los rechazos no crean movimientos históricos.

## Pruebas de aceptación manual

Datos: cuentas individuales existentes de residente, administrador y guardia del mismo condominio; guardia de otro condominio si ya existe; visitantes ficticios y un navegador visitante sin sesión. Para vencimiento, crear una vigencia personalizada breve y esperar realmente su fin, sin modificar SQL ni fechas de datos existentes.

| Caso | Pasos | Resultado esperado |
| --- | --- | --- |
| S-01 | Crear invitación vigente y abrir enlace sin sesión | QR normal; solo datos públicos |
| S-02 | Registrar entrada QR; esperar vencimiento; actualizar visitante | Expirada, mismo QR, aviso de uso exclusivo para salida |
| S-03 | Escanear ese QR como guardia del condominio | Una salida QR, completada, estado previo conservado; actualizar visitante oculta QR |
| S-04 | Repetir con otra visita: entrada, luego cancelación por residente | Cancelada con QR de salida; escanear registra solo salida, trazabilidad Cancelada |
| S-05 | Cancelar / dejar vencer invitaciones sin entrada | Sin QR utilizable; un código previamente guardado tampoco permite entrar |
| S-06 | Crear otra entrada y abrir Registrar salida sin QR | Solo visitas abiertas del condominio, incluidas las canceladas/vencidas; selección pide confirmación |
| S-07 | Confirmar nombre, residencia y hora; registrar salida | SALIDA, método manual, hora del servidor y operador; desaparece de pendientes |
| S-08 | Administrador actualiza historial; visitante actualiza enlace | Un registro de salida MANUAL y estado anterior; visitante Completada sin QR |
| S-09 | Dos sesiones de guardia seleccionan la misma visita abierta y confirman juntas | Una sola salida; la segunda petición distinta rechazada. Probar también manual frente a QR |
| S-10 | Guardar la selección en otra pestaña, cerrar visita desde la primera y confirmar la selección antigua | Rechazo, ninguna segunda salida |
| S-11 | Como residente o visitante llamar `guard_open_visits` / `guard_register_exit` mediante cliente de prueba con su propia sesión | Rechazo de permisos; nunca usar SQL Editor como propietario para esta prueba |
| S-12 | Como guardia de otro condominio intentar el ID conocido de la entrada | No encontrado; cero cambios en historial ajeno |
| S-13 | Simular respuesta perdida y reintentar con el mismo `request_id` y sesión | Mismo registro, aviso de movimiento ya registrado, sin otro paso autorizado |
| S-14 | Inspeccionar respuesta de `public_invitation` sin copiar tokens a logs o analítica | Solo campos anteriores más booleano `hasOpenEntry`; sin operador, teléfono, vehículo ni historial |
| S-15 | Usar móvil y tablet; confirmar, volver, refrescar, cerrar sesión | Controles legibles, sin scroll horizontal; ruta guardia inaccesible tras logout |

Automatizadas locales: `npm test` **191/191**, `npm run test:concurrency` **22/22**, `npm run build` aprobado. SQL en PGlite y PostgreSQL 17.10 temporal con conexiones independientes y Auth simulado. Incluyen privacidad exacta de proyecciones, grants/RLS, preservación de filas, rechazo de roles/condominio/inactividad, QR tras cancelación/vencimiento, método en historial administrativo, idempotencia, rollback y carreras entre ambos métodos. Persiste la advertencia previa de bundle principal >500 kB.

Fixture UI reproducible: `node tests/helpers/invitation-preview.mjs --open-exits`. Crea ejemplos únicamente en una base nueva PGlite en memoria; Auth simulado, sin conexión al Supabase remoto. Usar `guard@fixture.invalid` en `http://127.0.0.1:5176` y `resident@fixture.invalid` en `http://localhost:5176`, con texto efímero no vacío en contraseña. Detener con Ctrl+C; nunca publicar este fixture. La validación remota de esta mejora, los nuevos escenarios con cámaras físicas y Vercel quedan pendientes del responsable después de aplicar/publicar.
