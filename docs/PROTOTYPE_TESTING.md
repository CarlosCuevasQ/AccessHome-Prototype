## Etapa 12 · Escáner QR y movimientos compartidos

### Ejecutado localmente

- `npm test`: **182/182**. Regresiones de la aplicación local/compartida; once migraciones SQL, grants/RLS y conservación de datos poblados; escenarios SQL de entrada/salida normal, salida controlada tras cancelación/expiración, trazabilidad, entradas/salidas inválidas y seis escenarios de lector/cámara/sesión. Dos casos adicionales del SDK verifican método, request_id estable tras perder respuesta, ausencia de campos de autoridad y reconfirmación/cambio de identidad Auth. El parámetro público `vehicle` se prueba con anon, residente, administrador y guardia y no modifica filas; el service compartido tampoco intenta escribir.
- `npm run test:concurrency`: **17/17**, PostgreSQL 17.10 temporal, tres conexiones TCP y Auth simulado. Cinco carreras con solicitudes distintas producen una entrada y ninguna salida; esperar más de 3 segundos por el lock tampoco consume salida. Reintentos del mismo ID, rollback del primero, salidas simultáneas, snapshot obsoleto y cancelación concurrente probados. Las diez pruebas previas de invitaciones/caseta siguen pasando.
- `npm run build` y `npm run build:vercel`: correctos. El segundo también revisó `dist` sin claves privilegiadas reconocibles ni archivos privados. Advertencia previa de chunk principal >500 kB (~695 kB, ~196 kB gzip); decodificador QR diferido ~35 kB (~14 kB gzip).
- Lector real: imagen QR generada y decodificada, extracción de token y rechazo de formatos ajenos. Runtime de cámara controlado en tests: no permiso inicial, una única lectura, cierre de tracks, permiso tardío, denegación, hardware ausente, fallo de reproducción/canvas y desmontaje. **Estas simulaciones no verifican una cámara física.**
- Navegador sobre PGlite desechable: residente crea invitación de 24 h; guardia en sesión/origen separado registra ENTRADA manual; administrador consulta un registro con Claudia Seguridad/método Manual. Guardia registra SALIDA; administrador recarga y consulta exactamente dos registros. Tercer intento rechazado como completada. Activar/Detener cámara probado con solicitud de permiso pendiente, sin captura física. Resultado verde/rojo y controles comprobados a 390 × 844; sin desbordamiento horizontal a 390/768 px, consolas guard/admin sin errores.

Fixture reproducible: `node tests/helpers/invitation-preview.mjs`, abrir `http://127.0.0.1:5176/login` como `resident@fixture.invalid` o `admin@fixture.invalid`, y `http://localhost:5176/login` como `guard@fixture.invalid`. Acepta cualquier texto efímero no vacío en contraseña **solo en esta simulación Auth**, sin cuentas remotas. Ambos orígenes tienen sesiones separadas y consultan la misma base PGlite en memoria. El fixture instala esquema/datos únicamente en su memoria y no usa credenciales del proyecto. Detener con Ctrl+C. No publicar este servidor ni usarlo como backend de ensayo remoto.

### Manual y remoto pendiente

Preparación: [GUARD_SCANNING.md](GUARD_SCANNING.md). El responsable aplica solo las migraciones faltantes en orden y verifica **guardScanningVersion: 1** y auditoría SQL. Usar el deployment HTTPS real, mismo proyecto de ensayo, cuentas reales de residente principal, administrador y guardia del mismo condominio, visitante ficticio y dos dispositivos. No cambiar `.env.local` ni repetir semilla para estas pruebas.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| E-01 | Como residente de Casa 24, crear invitación vigente de dos usos con visitante y vehículo ficticios | Activa, QR/enlace disponible, cero usos; datos persistidos en Supabase |
| E-02 | Pulsar Enviar por WhatsApp y compartir deliberadamente con el dispositivo visitante | Mensaje con enlace HTTPS real; envío decidido por el residente |
| E-03 | Abrir enlace en navegador sin sesión del visitante | Datos mínimos y QR, sin login ni datos locales del residente |
| E-04 | Guardia inicia sesión, entra a `/guardia/escanear` y pulsa Activar cámara | No pide permiso antes del botón. Tras concederlo, vista de cámara; guardia/condominio correctos |
| E-05 | Enfocar el QR del otro dispositivo y mantenerlo enfocado | Una ENTRADA verde con visitante, Casa 24, vehículo/placas, método QR, operador y hora del servidor; stream se detiene y resultado permanece |
| E-06 | Administrador abre/refresca historial desde otra sesión | Exactamente una entrada autorizada, datos y operador correspondientes; caseta cuenta visita pendiente |
| E-07 | Al salir realmente el visitante, pulsar Escanear siguiente y Activar cámara; leer el mismo QR | SALIDA verde, dos usos e invitación completada. Separar las lecturas al menos 3 segundos |
| E-08 | Administrador actualiza historial y visitante actualiza invitación | Exactamente entrada y salida; visitante Completada sin QR, pendiente de salida desaparece de caseta |
| E-09 | Releer una copia del QR completado o pegar el mismo enlace manualmente | Rojo: completada. No aparece un tercer registro ni se consume otro uso |
| E-10 | Crear otra invitación, conservar código y cancelarla desde residente antes de escanear | Rechazo cancelada, sin movimientos nuevos; captura antigua no autoriza |
| E-11 | Crear una visita con vigencia corta y esperar a que venza; leer su código conservado | Rechazo expirada según hora del servidor, sin movimientos |
| E-12 | Dos guardias/dispositivos leen simultáneamente una nueva visita; mantener QR enfocado y repetir rápidamente tras Siguiente | Un solo movimiento. El otro dispositivo obtiene advertencia concurrente/lectura reciente, nunca salida por esa ráfaga; comprobar historial. Una lectura deliberada posterior a 3 segundos puede registrar salida |
| E-13 | Denegar permiso de cámara y pegar enlace/token en el campo manual | Aviso comprensible; validación manual funciona y guarda método MANUAL. Sin hardware disponible ofrece la misma alternativa |

Comprobaciones adicionales necesarias:

- **Permisos:** residente/anon no ejecutan `validate_access`; guardia no valida invitación de otro condominio (Invitación no encontrada) ni modifica residencias, habitantes, vehículos, roles o movimientos mediante services/SQL directo. Perfil guard inactivo se rechaza aun con JWT previo. La auditoría/SQL Editor como propietario no sustituye estos intentos con Auth real.
- **Ciclo de cámara:** detener durante permiso pendiente, cambiar ruta, cerrar sesión, esconder la pestaña o bloquear el teléfono. El indicador de cámara debe apagarse; volver exige Activar. Probar Chrome Android y Safari iOS, enfoque/iluminación/orientación y controles a 375–430/768 px. No se ha realizado con hardware físico.
- **Respuesta perdida:** si se interrumpe la conexión al validar, no mostrar verde ni permitir siguiente; restablecer y pulsar Reintentar misma operación. Si ya se confirmó en servidor, devolver el mismo movimiento en amarillo, sin duplicar. Reenfocar pestaña con la misma sesión no cambia el request_id. Tras una recarga completa/cambio de cuenta, consultar historial antes de volver a operar.
- **Secuencia:** cancelar o dejar vencer después de entrada impide una nueva entrada, pero un guardia activo del mismo condominio puede cerrar la única entrada abierta mediante la salida controlada. La salida guarda el estado previo (cancelada/expirada), completa la invitación sin reabrirla y no funciona sin entrada, con segunda salida, para otra residencia o con residencia inactiva. No permite editar historial.
- **Vehículo público:** la migración 11 mantiene `public_invitation(text,jsonb)` por compatibilidad, pero cualquier `vehicle` distinto de `null` se rechaza en backend como solo lectura. Se comprueba que no cambia la invitación para anon, residentes, administradores ni guardias. El modo local conserva su demo aislada; no representa el backend compartido.
- **Privacidad:** resultado de caseta solo con visitante/casa/vehículo/operación; sin correo/teléfono/notas/anfitrión. No registrar tokens, video ni claves en logs/analítica, ni exportar capturas/solicitudes reales durante las comprobaciones.

**Pendiente:** todas las pruebas con Supabase Auth/PostgREST remotos, teléfonos físicos, cámara real, WhatsApp real y hosting. Las pruebas locales anteriores no demuestran esos resultados remotos. Servicios y reportes de turno no se implementan en esta etapa.

Las siguientes secciones son el registro histórico de entregas previas. Para probar el escáner actual usar E-01–E-13; los avisos históricos de próxima etapa para escaneo ya no describen el frontend actual.

## Etapa 11 · Compartir invitaciones y Vercel

### Ejecutado localmente

- `npm test`: **161/161**. Incluye las regresiones anteriores, siete casos de compartir/URL, consulta pública SQL de los cuatro estados, cliente anónimo sin sesión y tres casos de configuración/inspección del artefacto. Las pruebas SQL ejecutan las diez migraciones en PGlite con pgcrypto; conservan grants, RLS, rate limit, snapshots y datos al actualizar desde la base poblada.
- `npm run test:concurrency`: **10/10**, PostgreSQL 17.10 desechable con conexiones TCP independientes y las diez migraciones. No usa el proyecto remoto.
- `npm run build` y `npm run build:vercel`: correctos. El segundo incluye `deployment:check` y no detectó claves privilegiadas reconocidas ni archivos privados en `dist`. Advertencia de bundle ~686 kB (~193 kB gzip), superior a 500 kB. Build Vercel repetido con permiso tras bloqueo `spawn EPERM` del sandbox.
- Navegador: residente crea una visita de 24 horas; Copiar enlace coincide con el enlace público; WhatsApp contiene mensaje y misma URL, sin abrir/enviar mensajes. Visitante accede desde `localhost` sin la sesión del residente en `127.0.0.1`, consulta PGlite y muestra solo datos mínimos/QR. Cancelar desde residente, Actualizar estado y recargar ruta directa muestran Cancelada y retiran el QR. Detalle y visitante sin scroll horizontal en 390 × 844; consola del visitante sin errores. Bloque compartir único tras refetch/cancelación.

Fixture reproducible: `node tests/helpers/invitation-preview.mjs`, abrir `http://127.0.0.1:5176/login`, correo `resident@fixture.invalid` y cualquier texto efímero no vacío como contraseña. **Auth simulado, SQL real desechable en PGlite**, nunca Supabase remoto. Se instala el esquema y semilla únicamente en memoria. No lee credenciales remotas ni modifica `.env.local`; fuerza variables ficticias solo en su proceso y escucha en loopback. Abrir el enlace público cambiando únicamente `127.0.0.1` por `localhost` permite un almacenamiento de sesión separado. Detener con Ctrl+C. Estas direcciones no son URLs de despliegue ni sirven para probar un teléfono.

### Manual/remoto pendiente

Preparación del responsable en [DEPLOYMENT.md](DEPLOYMENT.md): comprobar historial; aplicar solo incrementales faltantes, incluida **20260917000700**; salud `publicInvitationVersion: 2`; publicar frontend con `npm run build:vercel` y las dos variables públicas del mismo Supabase de ensayo. No repetir semilla. Usar residente real principal de Casa 24 y datos ficticios del visitante. La autenticación base remota funciona según el responsable; estas pruebas nuevas aún no se ejecutaron allí.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| I-01 | Crear invitación de 24 horas como residente real | Detalle Activa, destino Casa 24 y token/QR existentes persistidos en Supabase |
| I-02 | Pulsar Enviar por WhatsApp | Mensaje breve y URL correctos; residente elige destinatario y decide enviar; sin API Business ni envío automático |
| I-03 | Copiar enlace y probar Compartir invitación | URL HTTPS del dominio real, `/invitacion/TOKEN`; menú nativo cuando existe, copia/manual si no; cancelar no realiza acciones alternativas |
| I-04 | Abrir copia en otro navegador/incógnito sin sesión | Vista pública desde Supabase, sin login ni datos locales del residente |
| I-05 | Abrir desde teléfono, con otra conexión | Misma visita, diseño legible y sin scroll horizontal; sin localhost o 192.168 en enlace |
| I-06 | Escanear QR con cámara física | Abre la misma visita; visible solo visitante, destino, vigencia, estado, QR e instrucciones; ninguna información privada extra |
| I-07 | Cancelar desde residente y confirmar | Estado Cancelada persistido, QR retirado y detalle sin bloques duplicados |
| I-08 | Actualizar estado o F5 en visitante | Nueva consulta a la base; no usa copia de localStorage del residente |
| I-09 | Comparar visitante y residente | Ambos Cancelada y sin QR; visible refresca también en hasta 10 s o al recuperar foco/conexión |
| I-10 | Abrir URL pública directamente y recargar en Vercel | Sin 404 del hosting ni login AccessHome/Vercel; estado actual incluso tras cancelación |
| I-11 | Dejar vencer una visita corta; completar otra mediante el control administrativo existente | Expirada/Completada y sin QR. No es necesario implementar escaneo de Guardia para probar estos estados |
| I-12 | Abrir token inexistente; bloquear red de prueba y Actualizar estado; restaurarla | Invitación no disponible o error claro, sin datos/QR válidos conservados; al recuperar red permite consultar de nuevo |

Web Share nativo y WhatsApp reales, teléfono/cámara física, dos navegadores reales, Supabase Auth/PostgREST y reglas de Vercel siguen pendientes. No registrar tokens, enlaces completos, HAR, contraseñas o capturas con QR reales en evidencias compartidas. Anotar solo caso, resultado y hora. Una captura de QR no acredita vigencia: la autorización definitiva se comprueba en backend al operar el acceso.

## Etapa 10 · Guardia y caseta (entrega anterior)

### Ejecutado localmente

- `npm test`: **149/149**. Ocho nuevos casos SQL de caseta, contrato Auth/service guard y rechazo en modo local, además de las 139 regresiones anteriores. PGlite con pgcrypto, Auth simulado: conservación exacta de filas al aplicar la incremental sobre base poblada, provisión/activación, grants, RLS, aislamiento por condominio, datos mínimos, zona horaria, paginación, rechazo de operaciones y metadata sin autoridad.
- `npm run test:concurrency`: **10/10**, PostgreSQL 17.10 temporal con tres conexiones TCP. Incluye carrera de provisión de guardia (un perfil) y consulta bloqueada por desactivación (rechazo `42501` tras el commit). No usa `.env.local` ni destinos remotos.
- `npm run build`: correcto; persiste la advertencia de tamaño de bundle superior a 500 kB.
- Navegador local con HTTP/Auth simulado: login de guardia → caseta, datos correctos, `/admin` rechazado, filtro de salidas, rutas pendientes, menú y logout. Después de logout, `/guardia` vuelve a login. Medido sin scroll horizontal en 375/390 px y tablet 768 px; historial móvil como filas adaptadas. Sin errores de consola.

Fixture visual reproducible: `node tests/helpers/guard-preview.mjs`, abrir `http://127.0.0.1:5175`, correo `guard@fixture.invalid` y cualquier texto efímero no vacío en el campo contraseña. **No son credenciales Auth reales ni datos compartidos**; es un servidor de pruebas local con respuestas simuladas. Solo escucha en loopback, no cambia `.env.local`, no llama al proyecto y no forma parte del frontend compilado. Detener con Ctrl+C al terminar. La seguridad SQL se prueba por separado en las suites anteriores.

### Pruebas manuales remotas pendientes

Preparación exclusiva del responsable: [GUARD_SETUP.md](GUARD_SETUP.md). Aplicar únicamente **20260917000600**, comprobar salud y auditoría, crear/vincular cuenta Auth al condominio existente. No repetir semilla ni reset. Usar el frontend en **Modo compartido**, con una cuenta de guardia, una de administrador y una de residente. La infraestructura base ya funciona según el responsable; las comprobaciones siguientes no se ejecutaron contra su proyecto en esta entrega.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| G-01 · Login | Iniciar sesión con la cuenta real de guardia; repetir con contraseña errónea | Correcta: `/guardia`; errónea: error sin sesión |
| G-02 · Panel | Abrir `/guardia`, comparar nombre/condominio con el perfil provisionado | Guardia y condominio correctos, sin datos de otro condominio; fecha/hora en la zona configurada |
| G-03 · Actividad | Consultar movimientos existentes del ensayo desde admin y guardia | Total de hoy cuenta entradas y salidas; cinco recientes de cada tipo; pendientes son entradas sin salida, incluso vencidas/canceladas. Sin movimientos: ceros y estados vacíos reales |
| G-04 · Ruta administrativa | Con sesión guardia, abrir `/admin`, `/admin/residencias` y `/residente` | Redirección a caseta con aviso; sin formularios administrativos/residenciales |
| G-05 · Backend | Intentar operaciones desde services/SDK como se indica abajo | Error de permiso; ninguna residencia, asignación, invitación ni acceso histórico modificado |
| G-06 · Autoasignación | Con sesión de residente intentar cambiar su perfil a `guard` o llamar provisión privada | Denegado por privilegios/RLS o esquema no expuesto. Cambiar metadata nunca concede autoridad |
| G-07 · Logout | Cerrar sesión desde menú y volver a `/guardia` o usar Atrás | Login, sin datos de caseta accesibles |
| G-08 · Móvil/tablet | Repetir login, panel, navegación, filtro, menú y logout en 375–430 px y 768 px | Sin scroll horizontal; controles legibles y accesibles; Escanear principal muestra próxima etapa sin cámara |
| G-09 · Vigencia del perfil | Con guardia conectado, responsable ejecuta `set_guard_active(...,false)`; consultar panel/historial; repetir provisión idéntica; luego reactivar explícitamente | Consultas rechazadas aun con JWT previo; datos retirados en refetch y sesión pierde perfil. Provisión no reactiva; `true` permite nuevo login |
| G-10 · Aislamiento/privacidad | Si hay segundo condominio de ensayo, vincular otra cuenta guardia allí sin mover perfiles existentes; consultar panel/historial y tablas | Solo movimientos propios; sin IDs de anfitrión/residencia/invitación, tokens, teléfonos, correos o notas; tablas de dominio vacías para guardia |
| G-11 · Actualización y próximas etapas | Abrir panel en dos navegadores, consultar movimientos nuevos del flujo administrativo existente; abrir las tres rutas pendientes | Ambos actualizan al enfocar/Actualizar o hasta 30 s visibles; escaneo/servicios/reportes informan próxima etapa y permiten volver, sin simular escrituras |

Para comprobar G-05 desde DevTools del **servidor Vite de desarrollo** con sesión guardia (los módulos no se importan así en producción):

```js
const { communityService } = await import('/src/services/communityService.ts')
await communityService.getSummary() // Debe rechazar por permiso, aunque no haya botón.
await communityService.createResidence({ number: '99999', street: 'Prueba denegada', active: true }) // Debe rechazar y no crear fila.
```

Para G-06, iniciar sesión como residente, sin pegar tokens ni claves en consola:

```js
const { getClient } = await import('/src/services/shared/client.ts')
const { authService } = await import('/src/services/authService.ts')
const current = await authService.getSession()
const attempt = await getClient().from('profiles').update({ role: 'guard' }).eq('user_id', current.id)
console.log(attempt.error?.code) // 42501; no cambia el rol.
```

Los tests SQL automatizados cubren además principal/habitantes/vehículos/invitaciones/reportes, SQL directo y los helpers privados. SQL Editor ejecutado como `postgres` **no representa** permisos del guardia: usar las cuentas Auth y los services para las pruebas remotas.

No se ejecutó `backend:check` contra el proyecto, no se aplicó SQL remoto, no se provisionaron cuentas ni se modificaron datos remotos durante esta etapa. Permanecen pendientes Auth real, PostgREST, configuración de esquemas expuestos y recorrido entre dispositivos físicos. El fixture de navegador no acredita esos puntos.

## Revisión SQL previa a aplicar · 17 de septiembre de 2026 (histórico)

Pruebas locales aprobadas: `npm test` **139/139**, `npm run test:concurrency` **9/9**, `npm run build` correcto con la advertencia previa de tamaño del bundle. La suite de concurrencia inicia PostgreSQL **17.10** temporal en 127.0.0.1, simula Auth y usa tres conexiones independientes. No lee `.env.local`, no acepta conexiones remotas y elimina su cluster al terminar. Requiere poder ejecutar los binarios de desarrollo; no instala un servicio ni usuarios del sistema. No sustituye las pruebas con Auth/PostgREST reales.

La suite exige observar un bloqueo mediante `pg_blocking_pids` antes de liberar la primera transacción. Comprueba cinco carreras de periodos idénticos, intersección parcial, límites adyacentes, rollback, snapshots antiguos en REPEATABLE READ/SERIALIZABLE, cancelación concurrente y expiración durante la espera. Al rechazar, no queda una segunda invitación ni un token huérfano.

La suite SQL/PGlite comprueba además intervalos contenidos, ventanas futuras, canceladas/completadas/vencidas, contactos distintos con igual nombre, separación por residencia y visitantes sin contacto. La auditoría verifica cero SECURITY DEFINER expuestos, firmas preservadas, EXECUTE limitado y autorización de las implementaciones privadas.

### Comprobación remota pendiente después de aplicar

Usar Daniel/Casa 24 y el mismo contacto frecuente en dos navegadores; elegir un día futuro y la misma zona horaria en ambos dispositivos.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| SQL-01 | Crear para Carlos 10:00–12:00 y repetir desde el otro navegador | Solo una invitación; mensaje de superposición en la segunda |
| SQL-02 | Intentar 11:00–13:00, 10:30–11:30 y 09:00–13:00 | Todas rechazadas mientras la primera esté activa |
| SQL-03 | Crear 12:00–13:00 para el mismo contacto | Permitida; los límites consecutivos no se superponen |
| SQL-04 | Cancelar la de 10:00–12:00 y recrearla desde el otro navegador | Permitida; ambos consultan el estado compartido |
| SQL-05 | Repetir cuando una invitación finalizó por dos usos o su vencimiento real | No bloquea una nueva vigencia válida |
| SQL-06 | Enviar simultáneamente el mismo periodo/contacto desde dos navegadores | Una sola alta confirmada; segunda rechazada, sin escrituras locales |
| SQL-07 | Auditar catálogo y Data API | `security_baseline.sql` sin excepciones; solo accesshome expuesto, privado fuera de Exposed schemas y Extra search path |
| SQL-08 | Repetir SB-01–SB-08 con JWT reales | Roles, aislamiento, creación, consulta y cancelación conservados |

No ejecutar SQL de fixtures de las pruebas nativas en un proyecto Supabase: crean roles y simulan Auth únicamente en su cluster desechable. Procedimiento e inventario: [SQL_MIGRATION_REVIEW.md](SQL_MIGRATION_REVIEW.md).

## Etapa 9 · Pruebas de backend compartido (entrega anterior)

### Ejecutado localmente

`npm test`: 134 pruebas correctas. Incluye regresión de los flujos locales, ocho migraciones en PostgreSQL/PGlite con pgcrypto, auditoría de privilegios, RLS por residencia/condominio, snapshots, escritura autorizada, rollback, idempotencia, límite del endpoint público y contrato de Supabase Auth mediante HTTP simulado.

`npm run build`: correcto (advertencia de tamaño del bundle). No se conectó al proyecto remoto desde las pruebas. Los fixtures generan UUID y contraseñas efímeros solo en memoria; no son valores para configurar .env.local.

Navegador: demo de 5174, login de Daniel por correo, contactos, crear invitación de Carlos López por 24 horas, abrir visitante/QR en viewport de 390 × 844; sin errores de consola y sin desbordamiento horizontal en el detalle. Se conservó la invitación local de prueba; no afecta la base compartida ni los datos del origen 5173.

### Preparación de la prueba real (pendiente)

Completar [SHARED_BACKEND_SETUP.md](SHARED_BACKEND_SETUP.md). Esperar autorización antes de aplicar las migraciones remotas. Después de aplicarlas y exponer accesshome, `npm run backend:check` debe informar AccessHome, esquema 9.

Datos: usuarios Auth reales asignados a admin, Daniel (Casa 24), Ana (Casa 12) y, preferentemente, Mariana (Casa 24, consulta). Usar los correos y contraseñas individuales suministrados de forma privada por el responsable. No usar la identidad local sin contraseña contra Supabase.

Ambos navegadores/dispositivos deben cargar una aplicación marcada **Modo compartido** conectada al mismo proyecto. Puede haber distintos almacenamientos de sesión. El enlace público requiere una dirección de frontend accesible desde el otro dispositivo; 127.0.0.1 no representa la computadora del anfitrión desde un teléfono.

### Recorrido obligatorio de dos navegadores

| Caso | Pasos | Resultado esperado |
| --- | --- | --- |
| SB-01 · Sesiones | Iniciar sesión como Daniel en navegador A y también como Daniel en B (perfiles separados o dispositivos distintos). | Ambos muestran Casa 24 y Modo compartido. Una contraseña errónea falla; no abre una cuenta local. |
| SB-02 · Modificación autorizada | En A abrir Mi residencia y agregar habitante **Lucía Prueba Compartida**, apellido **Verificación**, sin cuenta. | Alta correcta. No puede editar el número de casa ni asignarse admin. |
| SB-03 · Datos compartidos | En B entrar a Mi residencia, o recuperar foco/recargar si estaba abierta. | Aparece Lucía. El dato persiste después de cerrar y volver a iniciar sesión; no depende de accesshome.demo.v1. |
| SB-04 · Crear invitación | En A abrir contactos, Carlos López → Invitar, vehículo guardado, 24 horas. Guardar y copiar enlace. | Invitación compartida con UUID interno, token de 64 caracteres hex, snapshot, Casa 24, 0/2 usos y QR. |
| SB-05 · Otra consulta | En B abrir invitaciones y su detalle. Abrir también el enlace en ventana sin sesión. | Misma invitación/estado; visitante ve solo proyección y QR. No requiere cuenta. |
| SB-06 · Cancelar | En A cancelar esa invitación y confirmar. | Se conserva la historia y cambia a cancelada. |
| SB-07 · Sincronización | En B volver al detalle o recuperar foco; si sigue visible esperar hasta 10 s. Repetir en visitante sin sesión. | Ambos muestran Cancelada desde Supabase; no se borra/recrea ninguna base local. |
| SB-08 · Separación | En B cerrar sesión y entrar como Ana. Pegar las rutas de Casa 24, detalle de invitación y contacto de Daniel; intentar los RPCs con IDs conocidos. | Lecturas protegidas/mutaciones denegadas, sin datos ajenos. Un token público voluntariamente compartido sí concede solo la proyección de esa visita. |

### Permisos y consistencia adicionales

- Mariana consulta Casa 24 pero no gestiona habitantes, vehículos, agenda ni crea/cancela invitaciones.
- Admin ve solo su condominio, no la agenda privada de Daniel. Gestiona estructura y estados de reportes; no modifica habitantes/vehículos cotidianos como residente.
- Asignar a Mariana principal desde admin: Daniel pierde gestión y acceso a su agenda inmediatamente en SQL. Volver a asignar a Daniel para restablecer la demo. Las invitaciones históricas conservan su anfitrión.
- Desactivar Casa 12: Ana conserva consulta y pierde gestión. Reactivar desde admin al terminar.
- Cambiar user_metadata.role o mandar residenceId/ownerUserId/usos/token añadidos al payload nunca concede permisos.
- Sin perfil, perfil inactivo o habitante inactivo: denegar operaciones. Guardia no puede usar los RPCs operativos.
- Editar/eliminar un contacto después de invitar: conservar nombre/vehículo históricos. El borrado desvincula contactId y elimina vehículos del contacto en una transacción.
- Crear ocasional con guardar contacto y datos inválidos: no queda ni invitación ni contacto parcial.
- Crear reporte como Daniel; Ana y Mariana no lo ven. Admin solo avanza pendiente → en proceso → completado.
- Desconectar la red en compartido: mostrar error, no permitir guardar en localStorage. Recuperar red y consultar de nuevo.
- Logout y cambio de cuenta: las rutas protegidas deben desmontarse y no conservar datos de la cuenta anterior.
- Como anon, un SELECT directo de tablas falla. El endpoint público no devuelve teléfono, correo, IDs internos, contactos ni listados.
- En una sesión adicional PostgreSQL real, revisar carreras de creación/cancelación/vehículo/entrada y dos validaciones simultáneas. PGlite no prueba carreras multi-conexión.
- Repetir validate_access con el mismo request_id: mismo resultado, un movimiento. La siguiente operación intencional usa otro request_id. Un tercer uso queda rechazado.

### Separación de proveedores

1. Con ambas variables vacías, o con `npm run dev:local`, comprobar etiqueta Modo local y acceso por correo sin contraseña.
2. Con ambas configuradas, comprobar Modo compartido y formulario con contraseña.
3. Con solo una variable configurada, la aplicación sigue en compartido y presenta error de configuración; no debe abrir la demo local.
4. Con una clave no publishable, Vite debe rechazar la configuración antes de construir el frontend. No incluir credenciales reales para probar este rechazo.
5. No copiar ni importar accesshome.demo.v1 a Supabase. Cambiar de modo no cambia sus datos de dominio; entrar a la demo local elimina únicamente antiguos campos de contraseña.
6. Restaurar demo solo existe en modo local, con confirmación, y afecta exclusivamente ese origen.

## Historial de pruebas de las etapas locales

Las tablas históricas siguientes documentan entregas previas. En la versión actual, el login local no lleva contraseña y se exige Web Crypto para nuevas altas/tokens. Las pruebas de autenticación por contraseña y fallback inseguro de esas entregas quedan sustituidas por la etapa 9.

# Guía acumulativa de pruebas

Esta guía se amplía en cada etapa. Al incorporar funciones nuevas, repetir también las pruebas anteriores que puedan verse afectadas.

## Preparación

1. Instalar una versión de Node.js compatible con el README.
2. Ejecutar `npm install` desde la raíz del proyecto.
3. Ejecutar `npm run dev` y mantener esa terminal abierta.
4. Abrir http://127.0.0.1:5173.

## Etapa 8 · Preparación de backend compartido

**Esta entrega no conecta Supabase.** Los datos/cuentas de etapas 1–7 siguen siendo locales. No usar `[contraseña histórica retirada]` para proteger un backend publicado. El [plan](SHARED_BACKEND_PLAN.md) contiene la matriz de pruebas para la futura integración.

| Caso | Pasos | Resultado esperado |
| --- | --- | --- |
| B8-01 Regresión local | Ejecutar `npm test` y `npm run build`. | Las 115 pruebas previas pasan y TypeScript/Vite genera el build. No se necesitan claves Supabase. |
| B8-02 Navegación conservada | Abrir `http://127.0.0.1:5173`, login Daniel/admin con los datos demo anteriores; consultar casa, contactos, invitaciones, historial y reportes. | Rutas y datos locales conservados. No se crea sesión Supabase ni se afirma sincronización entre teléfonos. |
| B8-03 Configuración | Revisar `.env.example`; opcionalmente copiar a `.env.local` y completar únicamente valores públicos del proyecto real. | Sin secretos en Git. La aplicación aún usa los servicios locales; estas variables no cambian proveedor. |
| B8-04 Reproducción SQL, pendiente | En un proyecto de ensayo configurado, aplicar 001 → 002 → 003 según `supabase/README.md`. | Diez tablas de dominio y tokens privados, tres roles, FK/índices/RLS. Sin usuarios/importaciones automáticas ni escrituras API. |
| B8-05 Auditoría SQL, pendiente | Ejecutar `supabase/tests/security_baseline.sql` como migrador. | Sin excepciones; comprueba grants/RLS/functions desde catálogo y no modifica datos. No equivale a probar RLS como usuario. |
| B8-06 Aislamiento, pendiente | Con cuentas Auth/perfiles reales de ensayo, probar consultas directas con publishable + JWT de admin, dos residentes, adicional y guardia. Repetir sin sesión. | Admin solo su condominio; residente solo casa, agenda propia y reportes propios; guardia solo contexto básico hasta sus RPCs; anónimo sin tablas. Ninguno escribe por API en esta base. |
| B8-07 Público/concurrencia, futuro | Tras implementar RPCs, repetir QR entre dispositivos, dos validadores, reintento del mismo `request_id`, cancelación y placas simultáneas. | Proyección pública mínima, tiempo servidor, exactamente dos usos máximos y registros atómicos; no fallback a local. |

Revisar también una cuenta sin perfil, perfil/habitante inactivo e intento de elevar rol mediante metadata. Para la importación futura, mantener copias originales, usar mapa de UUIDs, comprobar cantidades y snapshots, repetir un lote sin duplicados y no importar contraseñas/sesión. Los registros locales sin operador conocido deben conservar esa ausencia (`source = local_import`), sin atribuirlos a un guardia inventado.

**Límite de verificación:** no hay proyecto configurado ni PostgreSQL/CLI disponible en esta entrega. Se revisaron los archivos SQL, pero no se ejecutaron migraciones ni auditoría RLS. El build del frontend no valida SQL. No se realizaron pruebas entre dispositivos contra un backend. Las verificaciones remotas quedan explícitamente pendientes para el Prompt 9.

Resultado de esta entrega: `npm run build` correcto (118 módulos) y `npm test` con 115/115 pruebas correctas. Se comprobó que `.env.local` y `supabase/.temp/` están ignorados por Git. No se cambió código funcional ni se reiniciaron datos del navegador.

## Etapa 7 · Historial, reportes y dashboards (conservada)

### Datos y preparación

Utiliza el mismo navegador y origen; no hace falta restaurar los datos. Daniel: `residente@accesshome.demo`; administrador: `admin@accesshome.demo`; Ana, principal de Casa 12: `ana@accesshome.demo`. Contraseña para los tres: `[contraseña histórica retirada]`. Mariana (`mariana@accesshome.demo`) conserva consulta de Casa 24. Si se cambiaron principales en pruebas anteriores, revisa la asignación administrativa antes de comenzar.

Datos nuevos sugeridos: visitante **Visita historial de prueba**, sin vehículo, vigencia **24 horas**; reporte **Lámpara de acceso apagada**, categoría **Instalaciones**, descripción **La lámpara junto al acceso de Casa 24 no enciende por la noche. Solicito su revisión.** Anota los indicadores iniciales y el ID del reporte para comparar. La semilla empieza sin movimientos ni reportes; una base migrada conserva lo existente.

### Siete recorridos solicitados

| Caso | Pasos | Resultado esperado |
| --- | --- | --- |
| H7-01 Entrada y salida | Daniel: Inicio → Nueva invitación, crear el visitante de prueba y copiar token. Administrador: Control de acceso, validarlo dos veces y repetir una tercera. | Primera Entrada, segunda Salida y Completada. Dos nuevos registros QR autorizados; tercera rechazada, sin nuevo movimiento. |
| H7-02 Historial admin | Abrir Historial de accesos, buscar el nombre y combinar Casa 24, Salida, Desde/Hasta con la fecha local de la prueba. Limpiar filtros. | Una salida de esa visita; incluye visitante, casa, anfitrión, placas o Sin vehículo, hora, método y Autorizado. Limpiar recupera todos los registros permitidos. |
| H7-03 Historial residente | Entrar como Daniel y abrir Historial de accesos. Buscar la visita y alternar Entrada/Salida. Recargar. | Ambos movimientos de Casa 24 persisten. No hay selector de otras casas. El estado Autorizado del movimiento se conserva aunque la invitación esté Completada. |
| H7-04 Crear reporte | Daniel: Inicio → Crear reporte. Probar campos vacíos; completar título, categoría y descripción de prueba y enviar una vez. Recargar detalle. | Validación de obligatorios. Reporte Pendiente de Daniel, Casa 24, con fecha y descripción. Aparece en Mis reportes. No se pide elegir casa o autor. |
| H7-05 Procesar reporte | Administrador: Reportes → Ver reporte → Marcar en proceso → Marcar completado. Volver a entrar como Daniel. | Datos del autor/casa/categoría/fecha visibles, avance persistente. Desaparece la acción al completar. Daniel consulta el estado pero no puede modificarlo. |
| H7-06 Indicadores | Comparar ambos inicios antes y después de crear la invitación, validar entrada/salida y crear/procesar el reporte. Probar acciones Registrar vehículo y Agregar habitante; cancelar sin guardar. | Invitación +1 activa al crear y −1 tras salida; accesos admin +2 hoy y visitas residente +1. Reporte +1 pendiente al crear y −1 al pasar a En proceso. Formularios rápidos abren la propia casa; cancelar no modifica cifras. |
| H7-07 Aislamiento | Guardar URL del reporte de Daniel, salir y entrar como Ana. Abrir Inicio, Historial y Mis reportes, buscar la visita de Casa 24 y pegar la URL guardada. Repetir consulta del reporte con Mariana. | Ana ve solo Casa 12 y sus indicadores; no aparecen movimientos de Casa 24. Reporte ajeno no disponible, incluso para Mariana de la misma casa. Acceder a `/admin/historial` como residente redirige a su inicio por rol. |

### Definición de cifras y casos adicionales

- **Administrador:** residencias todas; habitantes solo activos; vehículos permanentes todos, incluso inactivos; accesos hoy incluye entradas y salidas autorizadas en el día local; invitaciones Activas incluye futuras; reportes pendientes excluye En proceso y Completado. Actividad reciente muestra los últimos cinco movimientos, también de días anteriores.
- **Residente:** cifras de su propia casa; Habitantes y Vehículos incluye activos/inactivos. Visitas recientes cuenta entradas en los últimos siete días naturales incluido hoy; no duplica por la salida. Reportes pendientes cuenta exclusivamente al propio autor. Agregar vehículos a contactos no cambia los vehículos permanentes de ningún dashboard.
- En la semilla limpia admin muestra 4 casas, 8 habitantes activos, 5 vehículos, 0 accesos, 0 invitaciones y 0 reportes. Daniel: 0 invitaciones, 0 visitas, 4 habitantes, 2 vehículos y 0 reportes. No comparar esos valores fijos con una base previamente modificada.
- Probar Desde posterior a Hasta: error legible sin registros fuera del alcance. Buscar sin acentos y por placas; combinar filtros sin perder las fechas introducidas. Probar un día sin movimientos y Limpiar filtros.
- A 375 px: abrir menú, Nueva invitación debe ser prioritaria; reporte en una columna; historial y reportes con filas etiquetadas legibles, sin tabla ancha. Repetir en escritorio. Revisar foco de teclado, etiquetas y mensajes de error.
- Casa inactiva o usuario adicional: consulta conservada; no permite crear reportes ni gestionar habitantes/vehículos. Administrador no crea reportes como residente. Desactivar un habitante con cuenta invalida su acceso como en etapas anteriores.
- Editar contacto/nombre de casa después del acceso no reescribe los snapshots del historial. El anfitrión refleja a quien invitó. Rechazos del control no incrementan actividad ni totales.
- Recargar y cerrar/abrir sesión conserva reportes y movimientos. La migración a esquema 7 añade reportes vacíos sin restaurar la comunidad, agenda, invitaciones o sesión. Reset solo debe usarse si se desea recuperar la semilla y perder los datos demo actuales.

### Verificación directa de permisos de servicios

Con Daniel autenticado, en la consola de desarrollo del prototipo Vite, la siguiente consulta debe rechazar el filtro ajeno:

```js
const { accessHistoryService } = await import('/src/services/accessHistoryService.ts')
await accessHistoryService.listRecords({ residenceId: 'house-12' })
```

Para probar reportes ajenos, copia el ID real creado por Daniel, entra como Ana y ejecuta `getReport(id)` de `reportsService` importado desde `/src/services/reportsService.ts`: debe rechazarlo. `updateStatus(id, 'en_proceso')` como residente también debe fallar. `createReport` con `residenceId: 'house-24'` mientras Ana está autenticada debe rechazar el destino ajeno, aunque título/categoría/descripción sean válidos. Estas verificaciones están también automatizadas; los botones ocultos no son la protección del servicio.

### Verificación realizada

- **115 pruebas automatizadas correctas**: 99 de regresión y 16 nuevas en `tests/reports.test.mjs` y `tests/dashboard-history.test.mjs`. Incluyen ambas casas y otro condominio, privacidad por autor, roles, filtros/medianoche, ventana de siete días, contadores reales, transiciones inválidas, escritura fallida, datos corruptos, migración v6 con invitación/entrada existentes y reset.
- **Navegador, 15–16 de septiembre de 2026:** reporte **Lámpara de acceso apagada · Prueba** creado por Daniel y llevado hasta Completado; visita **Visita historial · Prueba** con Entrada/Salida el día 15 a las 19:17 y estado Completada. Se conservaron ambos registros y los datos anteriores.
- En esa sesión, admin pasó de 2 a 4 accesos del día y de 1 a 0 reportes pendientes al procesar. El día 16 el contador de accesos de hoy mostró 0, conservando los cuatro movimientos en el historial. Daniel vio 2 visitas recientes, 5 habitantes, 2 vehículos y 0 reportes pendientes. Las invitaciones activas bajaron también al expirar visitas del día anterior, como corresponde.
- Daniel vio sus cuatro movimientos y su reporte Completado tras volver a entrar. Ana vio Casa 12, 2 habitantes, 1 vehículo, sin actividad; el historial no mostró movimientos de Casa 24 y la URL del reporte de Daniel indicó **Reporte no disponible para tu cuenta**.
- Búsqueda + casa + movimiento + fechas comprobadas, incluido estado vacío. Se corrigió la captura de fechas para conservarlas al cambiar otros filtros. Revisión visual de dashboard, formularios e historial a 375 px y tabla administrativa a 1366 px, sin desbordamiento en las vistas medidas. Acciones rápidas abrieron los formularios correctos; cancelar no guardó registros.
- Build final con TypeScript/Vite correcto. Sin dependencias nuevas, restauración de datos, commit ni push. El guion general de presentación queda para una etapa posterior.

## Corrección · Compatibilidad de identificadores

Cuenta: `residente@accesshome.demo` / `[contraseña histórica retirada]`. Datos nuevos sugeridos: **Prueba compatibilidad**, placas **COMP-242**. Repetir en el navegador y la misma dirección donde apareció el error; no restaurar los datos ni cambiar de origen para comprobar su conservación.

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| C-01 | Recargar la página actual para cargar el código corregido. Invitaciones → Nuevo visitante → Prueba compatibilidad → Sin vehículo → 24 horas → Generar. | Detalle con ID/token, QR, Casa 24, estado Activa y 0 de 2 usos, sin `crypto.randomUUID is not a function`. |
| C-02 | Recargar el detalle, abrir el enlace público y regresar al listado. | Mismos datos, token e invitación; la sesión y las invitaciones anteriores se conservan. |
| C-03 | Contactos frecuentes → un contacto propio activo → Invitar → elegir vehículo o Sin vehículo → Generar. | Creación correcta y snapshot del contacto, con destino automático y usos iniciales intactos. |
| C-04 | Crear otra ocasional con COMP-242 y Guardar como contacto frecuente marcado. | Invitación, contacto y vehículo nuevos con identificadores distintos; vehículo de agenda separado del permanente. |
| C-05 | Como administrador, validar el token de prueba tres veces. | Entrada, Salida/Completada y tercer rechazo; dos movimientos persistentes. |
| C-06 | Ejecutar `npm test`. | 99 pruebas correctas, incluidas las alternativas descritas abajo. No modifica localStorage del navegador. |

`tests/compatibility.test.mjs` simula: UUID nativo; únicamente `getRandomValues`; objeto Crypto ausente; métodos no invocables; reloj y aleatorio repetidos; ausencia de `structuredClone`. Verifica formato UUID v4 y sus bits, unicidad dentro de una misma ejecución, copias independientes y migración conservada. Dos recorridos de servicios crean casa/principal, habitante, vehículo permanente, contacto/vehículo, invitación con guardado opcional y entrada/salida, tanto sin UUID nativo como sin Crypto, también sin `structuredClone`.

La alternativa final devuelve un identificador de timestamp/contador/aleatorio, que puede no tener forma UUID; el prototipo lo trata como una cadena opaca, incluido en URL y QR. No cambian los tokens existentes ni las validaciones de invitaciones. No se añadieron dependencias. La revisión adicional de APIs se limitó al código de la aplicación; no es una certificación de navegadores antiguos.

**Verificación de esta corrección:** `npm test` 99/99; `npm run build` correcto. Las pruebas nuevas usan almacenamiento aislado. Los recorridos de navegador de la etapa 6 que siguen son el registro de esa entrega; no se atribuyen a una nueva prueba en un teléfono físico.

## Etapa 6 · QR, visitante y control de acceso (conservada)

### Preparación y datos

- Residente Daniel, Casa 24: `residente@accesshome.demo` / `[contraseña histórica retirada]`.
- Administrador: `admin@accesshome.demo` / `[contraseña histórica retirada]`.
- Crear un visitante ocasional **Visita QR de prueba**, sin vehículo, vigencia **24 horas**, sin guardarlo como contacto. Usar placas **QR-9002** para la incorporación posterior.
- En su detalle, copiar el token y el enlace **Abrir invitación pública**. Cada invitación nueva tiene un token diferente generado por `generateId()`; no copiar tokens de ejemplos históricos para probar acceso activo.
- Ruta administrativa: `/admin/control-acceso`. Ruta pública: `/invitacion/{token}`.
- Mantener `http://127.0.0.1:5173` durante todo el recorrido. Otra pestaña comparte datos y sesión; cerrar sesión permite comprobar acceso anónimo. Una ventana privada, otro perfil, `localhost`, otro puerto u otro dispositivo tienen datos independientes.

**Límite de la demostración:** el QR codifica la URL, no transporta la base de datos. Un teléfono distinto no podrá consultar las invitaciones guardadas en el navegador del equipo. Para esta etapa usar el enlace en el mismo navegador y emulación móvil. No hace falta cámara para el simulador: se valida el token almacenado. La sincronización entre dispositivos requiere la futura API.

### Nueve recorridos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| A6-01 | Crear la visita indicada como Daniel y abrir su detalle. Seguir Abrir invitación pública. | QR real en ambas vistas, URL `/invitacion/{token}`, visitante, Casa 24, Daniel, vigencia, estado Activa y 0 de 2 usos. Consultar el QR no consume usos. |
| A6-02 | Copiar el enlace, cerrar sesión y abrirlo en el mismo origen. Revisar a 375 px. | Consulta sin login, QR legible y adaptable. No aparecen controles administrativos, habitantes, teléfonos/correos ni notas privadas. |
| A6-03 | Administrador → Control de acceso → seleccionar esa invitación → Validar acceso. | Seleccionar solo carga el token. Al validar: **Acceso autorizado**, **Entrada**, 1 de 2 usos y un registro con visitante, casa, anfitrión, vehículo, método QR y fecha/hora. La vista pública indica Entrada registrada. |
| A6-04 | Validar nuevamente el mismo token. | **Acceso autorizado**, **Salida**, 2 de 2 usos y estado Completada. Hay exactamente dos registros y deja de aparecer en el selector de activas. |
| A6-05 | Mantener/pegar el mismo token y validar por tercera vez. Recargar el panel. | **Acceso rechazado: Invitación completada**. No se añade un tercer movimiento. Los dos existentes persisten; el resultado visual se limpia al recargar. |
| A6-06 | Introducir `token-inexistente` y validar. Abrir `/invitacion/token-inexistente`. | Panel: **Invitación inexistente** en rojo, sin movimientos. Público: Invitación no disponible, sin datos de otra visita ni obligación de iniciar sesión. |
| A6-07 | Daniel crea otra invitación, copia su token y la cancela. Administrador valida ese token. | **Acceso rechazado: Invitación cancelada**. Consulta pública muestra Cancelada; no permite incorporar vehículo. Sin nuevos movimientos. |
| A6-08 | Crear una personalizada que comience ahora y termine en uno o dos minutos. Esperar a su final y validar su token. | **Acceso rechazado: Invitación expirada**. Estado público se actualiza sin recargar; ya no admite vehículo. Sin usos ni movimientos nuevos. |
| A6-09 | En una invitación nueva sin vehículo, antes de A6-03, abrir el enlace público → Sí → completar solo QR-9002 → Guardar vehículo. Recargar; luego realizar entrada y salida. | Placas obligatorias; marca/modelo/color opcionales. El formulario desaparece tras guardar. Datos persistentes en ESA invitación y sus dos movimientos; no se crea contacto ni vehículo permanente. No se permite sustituirlos. |

### Validación adicional y regresión

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| A6-10 | Crear personalizada con inicio mañana; seleccionarla y validar antes del inicio. | Fuera del periodo permitido. Se permite preparar el vehículo, pero no consumir usos. El intervalo válido incluye el inicio y excluye el instante final. |
| A6-11 | Crear sin vehículo, registrar entrada y abrir el enlace público. Repetir con una invitación creada originalmente con vehículo. | Ninguna permite incorporar/reemplazar vehículo. Tras entrada se conserva el snapshot para la salida. |
| A6-12 | Abrir `/admin/control-acceso` como Daniel y repetir llamadas directas al servicio como residente o sin sesión. | Ruta y servicio impiden validar y consultar el historial administrativo. La ruta pública permanece accesible. |
| A6-13 | En datos de prueba, desactivar la casa destino y validar una invitación activa. Reactivar después. | Rechazo por residencia inactiva y bloqueo de incorporación pública de vehículo. No consume usos. Administrador de otro condominio tampoco accede a esa invitación ni sus registros. |
| A6-14 | Mantener el enlace público en una pestaña y validar desde otra. Editar después un contacto que originó una invitación con vehículo. | Estado/usos se actualizan. Invitación y movimientos conservan las copias del visitante, anfitrión, casa y vehículo; no reconstruyen datos desde el contacto. |
| A6-15 | Revisar formulario, rechazo e historial a 375 × 812, 768 × 1024 y 1366 × 1000; recorrer con teclado. | Botones amplios, etiquetas visibles, foco identificable y mensajes anunciados. Tabla de movimientos pasa a lista compacta sin desbordamiento horizontal. QR sin controles administrativos alrededor. |
| A6-16 | En almacenamiento aislado, simular cuota agotada al validar o guardar vehículo; reintentar después. | Error sin autorización, uso consumido ni registro parcial. Los datos anteriores permanecen. Cubierto por pruebas automatizadas. |
| A6-17 | Migrar una base v5 editada; recargar. Restaurar demo solo en un perfil destinado a pruebas. | Migración añade movimientos vacíos una sola vez, conserva tokens/usos/invitaciones y sesión. No inventa movimientos de usos anteriores. Reset vacía invitaciones/movimientos, recupera semilla y cierra sesión. |
| A6-18 | Repetir validaciones consecutivas y una cancelación después de entrada. | Máximo dos movimientos por invitación. Cancelar tras entrada impide salida. El botón bloquea envíos mientras guarda; cada validación relee estado y hora. |

Para comprobar permisos en desarrollo, con Daniel autenticado, ejecutar en la consola:

```js
const { accessService } = await import('/src/services/accessService.ts')
await accessService.validateToken('token-inexistente')
await accessService.listAccessRecords()
```

Ejecutar las llamadas por separado: ambas deben rechazar por rol, sin guardar. Las pruebas automatizadas también verifican aislamiento entre condominios. La simulación representa un puesto local; no prueba concurrencia entre dispositivos, que requiere transacciones en la futura API.

### Verificación automatizada

`npm test`: **90/90** correctas. Las 21 nuevas son 12 de acceso y 9 de consulta/modificación pública. Incluyen entrada/salida, rechazos, límites exactos de tiempo, roles, condominio, residencia inactiva, snapshots, fallos de escritura, validaciones consecutivas, migración v5, corrupción de movimientos y restauración. Se conservan las 69 pruebas anteriores. Los tests usan almacenamiento aislado y no alteran los datos del navegador.

`npm run build` verifica TypeScript y genera el frontend con la única dependencia nueva `qrcode.react` 4.2.0. El QR se genera localmente, sin llamadas a servicios externos.

### Recorrido verificado en navegador · 15 de septiembre de 2026

- Daniel creó **Visita QR demostración**, Casa 24, sin vehículo y 24 horas. QR real visible y enlace público abiertos; acceso sin sesión comprobado a 375 × 812.
- Visitante añadió únicamente **QR-9001**; recarga conservó placas y retiró formulario. Ninguna otra invitación se modificó.
- Administrador registró entrada y salida, comprobó Completada y tercer rechazo. Se conservaron exactamente dos movimientos con método QR; recarga mantiene historial y sesión.
- Token inexistente, invitación cancelada anterior, expirada anterior y futura **Prueba fechas** rechazados con sus motivos. Enlace público inválido mostró el estado de error sin información privada.
- Vista pública actualizada entre pestañas tras entrada y salida; la segunda indica Completada y que el código ya no permite accesos.
- Formulario y registro revisados a 375 px, comprobación de anchura a 768 px y revisión de escritorio a 1366 px. Sin desbordamientos en las vistas medidas ni errores/advertencias de consola al finalizar. Se restauraron las dimensiones normales del navegador.
- Se conservaron datos previos, incluidas las bajas realizadas por el usuario. No se reinició la demo ni se consumieron usos de invitaciones ajenas a la prueba. La visita QR de prueba quedó Completada con sus dos movimientos. No se hizo escaneo con una cámara física.

## Etapa 5 · Invitaciones (conservada)

Los casos siguen sirviendo como regresión. Las referencias históricas de esta sección a QR/enlace público/usos pendientes quedaron resueltas en la etapa 6.

### Preparación y datos

- Daniel / Casa 24: `residente@accesshome.demo` / `[contraseña histórica retirada]`.
- Ana / Casa 12: `ana@accesshome.demo` / `[contraseña histórica retirada]`, para comprobar aislamiento.
- Mariana / Casa 24: `mariana@accesshome.demo` / `[contraseña histórica retirada]`, consulta sin gestión.
- Semilla: Carlos López, teléfono 3312345678, Mazda 3 / JKL-1234; María González sin vehículo; Pedro Ramírez, Nissan Versa / HJK-7821.
- Visitante ocasional de prueba: Lucía Pérez; vehículo solo placas `VIS-9001`. Otro vehículo: Toyota Tacoma / `VIS-9002`.
- Las invitaciones empiezan vacías. La migración respeta contactos y vehículos previamente eliminados. Si falta Carlos, puedes crear un contacto ficticio equivalente o usar otro. No es necesario reiniciar el navegador.

### Ocho recorridos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| I5-01 | Daniel → Contactos frecuentes → Carlos López → Invitar. Mantener Mazda 3 · JKL-1234 y Hoy → Generar invitación. | Nombre/teléfono precargados; destino Casa 24 fijo; confirmación con Mazda 3, placas, token, estado Activa y 0 de 2 usos. Hoy vence a la próxima medianoche local. |
| I5-02 | Invitar a Carlos seleccionando Sin vehículo. Repetir con María, que no tiene vehículo. | Invitaciones válidas sin campos de placas ni vehículo; el detalle indica Sin vehículo. |
| I5-03 | Invitaciones → Nuevo visitante → Lucía Pérez. Dejar teléfono vacío, elegir Sí, en vehículo; completar solo VIS-9001. Dejar Guardar como contacto frecuente desmarcado; seleccionar 24 horas y generar. | No exige marca/modelo/color; la agenda y los vehículos permanentes no cambian. Vigencia exacta de 24 horas, Casa 24 automática. |
| I5-04 | Carlos → Invitar → Otro vehículo → VIS-9002, Toyota, Tacoma → Generar. | La invitación conserva el nuevo vehículo. Carlos sigue teniendo su Mazda en la agenda; no se registra un vehículo permanente. |
| I5-05 | Nuevo visitante → Personalizada → seleccionar inicio mañana a las 10:00 y fin mañana a las 12:00. Alternar 24 horas y Personalizada; generar. | Conserva fechas elegidas; detalle muestra ese intervalo y aviso de inicio programado. Fin igual/anterior al inicio, fecha inválida o fin pasado se rechazan. |
| I5-06 | Abrir una activa → Cancelar invitación → Mantener invitación. Repetir y Confirmar cancelación. | Primero conserva Activa; después muestra Cancelada, mantiene el historial y oculta la acción. Aparece en filtro Cancelada; recarga conserva el estado. |
| I5-07 | Crear un contacto de prueba con Mazda 3 / SNP-9001 y generar invitación. Editar nombre, teléfono y vehículo a Toyota Tacoma / SNP-9999. Volver a la URL de la invitación y recargar. | Conserva nombre, teléfono y Mazda 3 / SNP-9001 originales. Eliminar el vehículo/contacto de prueba tampoco invalida la invitación histórica. |
| I5-08 | Con Daniel intentar enviar otra residencia al servicio (ejemplo inferior). Copiar URL de una invitación de Casa 24, entrar como Ana y abrirla. | Servicio rechaza generar para Casa 12, sin escribir. Ana no ve el detalle ni puede cancelarlo; su listado solo contiene invitaciones de Casa 12. |

### Casos adicionales y regresión

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| I5-09 | Crear ocasional marcando Guardar como contacto frecuente, con y sin vehículo. | Crea contacto privado y vehículo opcional junto con la invitación, sin cuenta funcional ni vehículo permanente. |
| I5-10 | Buscar por nombre sin acentos, teléfono y placas. Combinar con cada filtro; buscar un texto inexistente. | Resultados correctos y estado vacío claro. Los cuatro filtros están disponibles. |
| I5-11 | Crear personalizada que finalice dentro de dos minutos y mantener abierto el detalle hasta su fin. | Cambia a Expirada sin recargar; no puede cancelarse. El filtro Expirada la muestra. |
| I5-12 | Mariana entra en Invitaciones de Casa 24 e intenta abrir directamente `/residente/invitaciones/nueva`. | Consulta permitida; no hay acciones de crear/cancelar; la ruta de creación explica la restricción. |
| I5-13 | Desactivar Casa 24 desde administrador en datos de prueba; volver como Daniel. Reasignar principal en otra prueba. | Casa inactiva mantiene consulta y bloquea crear/cancelar; el principal anterior pierde gestión al ser reemplazado. Reactivar/restablecer asignación al terminar. |
| I5-14 | Contacto o vehículo inactivo, IDs ajenos, usuario anónimo, intento de modificar invitador/usos/estado al crear. | Validaciones del servicio impiden eludir permisos y valores iniciales; no se crean datos parciales. |
| I5-15 | Crear y recargar; cerrar sesión y volver a entrar; abrir segunda pestaña del mismo origen. | Historial y sesión conservados; los cambios se notifican entre pestañas. Login y navegación anteriores siguen funcionando. |
| I5-16 | A 375 px: abrir menú, Invitar, elegir vehículo, vigencia, generar, consultar y cancelar. Probar fechas con teclado. Repetir listado a 768 y 1366 px. | Formularios de una columna, acciones de 48 px, texto legible y sin desbordamiento horizontal. Foco de confirmación en Mantener invitación. |
| I5-17 | Probar fallo de escritura en entorno aislado al generar con contacto opcional y al cancelar. | Error visible, sin éxito ni guardado parcial. Datos previos conservados. Cubierto automáticamente. |
| I5-18 | Migrar datos v4 editados o restaurar demo en un perfil destinado a pruebas. | Migración conserva datos/sesión/bajas y añade invitaciones vacías una sola vez. Restauración recupera semilla, vacía invitaciones y cierra sesión. |

**Completadas:** se derivan de `usedUses >= maxUses`. No hay interfaz para consumir usos en esta etapa; `npm test` utiliza una invitación aislada con 2 de 2 usos para verificar filtro/estado y bloqueo de cancelación. QR, validación de entrada/salida y enlace público quedan pendientes.

### Verificación directa del servicio

En desarrollo, con Daniel autenticado, ejecutar en la consola del navegador:

```js
const { invitationsService } = await import('/src/services/invitationsService.ts')
await invitationsService.createInvitation({
  source: 'occasional', visitorName: 'Prueba de permisos', phone: '',
  vehicle: null, saveAsContact: false, validity: { kind: '24hours' },
  residenceId: 'house-12',
})
```

Debe rechazar con **No puedes generar invitaciones para otra residencia** y no añadir registros. El contrato TypeScript excluye `residenceId`; esta llamada JavaScript comprueba la defensa contra un dato manipulado. La residencia siempre se obtiene de la sesión. Para acceso por ID, usar `getInvitation(id)` o `cancelInvitation(id)` con el ID de una invitación de otra casa; ambos deben rechazar.

### Verificación automatizada

`npm test`: **69/69** pruebas correctas, incluidas 18 de invitaciones. Cubren los dos flujos, snapshots tras edición/eliminación, vigencias y estados, tokens, permisos por rol/casa/contacto/vehículo, cambios de principal, guardado opcional atómico, búsqueda, migración v4, corrupción de datos, fallos de guardado y reset. Se conservan las 51 pruebas de autenticación, comunidad, agenda y eliminación. `npm run build` comprueba TypeScript y genera el sitio sin dependencias nuevas.

### Recorridos verificados en navegador · 15 de septiembre de 2026

- Login de Daniel, navegación a agenda e invitaciones, creación, cancelación con confirmación, búsqueda combinada con estado y persistencia tras recarga.
- Contacto existente Laura Sánchez Ruiz: solo se ofreció su Honda Civic activo LRS-9002; el vehículo inactivo quedó fuera del selector. Su invitación de prueba quedó Cancelada. Carlos ya había sido eliminado del navegador: se respetó esa baja y su caso específico se comprobó con la semilla aislada de `npm test`.
- María González invitada sin vehículo; Pedro Ramírez invitado con otro vehículo, solo placas VIS-9002 y vigencia de 24 horas.
- Ocasional “Prueba fechas” sin vehículo, con inicio 16/09/2026 10:00 y fin 12:00; intervalo y aviso de visita programada correctos. Se corrigió la captura de `datetime-local` para conservar inmediatamente las fechas editadas y se verificó al alternar vigencias y generar.
- Ocasional “Prueba snapshot” guardado voluntariamente como contacto, Mazda 3 / SNP-9001. Después se cambió el contacto a “Prueba snapshot editada”, Toyota Tacoma / SNP-9999. La invitación siguió mostrando el nombre y Mazda originales.
- Ana no pudo consultar esa invitación de Casa 24. Mariana pudo listar invitaciones de su propia casa y la ruta de creación rechazó su condición de habitante adicional.
- Formulario personalizado y confirmación de cancelación revisados a 375 × 812; contenido sin desbordamiento horizontal. Foco inicial en Mantener invitación. Sin errores/advertencias de consola en la comprobación final.
- “Prueba expiración” pasó de Activa a Expirada al llegar al fin, sin recargar; desapareció Cancelar invitación y se encontró usando el filtro Expirada. Listado revisado a 375 × 812, 768 × 1024 y 1366 × 1000 sin desbordamiento horizontal. Build final correcto después de corregir las fechas.
- Los datos anteriores no se restauraron ni eliminaron. Se conservaron las invitaciones y el contacto de prueba. La primera invitación ocasional “Lucía Pérez · Prueba visita”, usada durante la corrección de fechas, quedó Cancelada.

## Eliminación de contactos y vehículos · Pruebas conservadas

Cuenta: Daniel, `residente@accesshome.demo` / `[contraseña histórica retirada]`. Para probar el borrado usa registros creados específicamente para la prueba: contacto **Prueba eliminación**, vehículos de contacto **BOR-1001** y **BOR-1002**, vehículo de residencia **BOR-2001** (Honda, Civic, Gris). Los registros se eliminan definitivamente al confirmar.

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| DEL-01 | Abrir el contacto de prueba, pulsar Eliminar contacto y después Cancelar. | Se explican contacto y vehículos afectados; Cancelar no modifica nada y devuelve el foco al botón original. |
| DEL-02 | En ese contacto, Eliminar vehículo BOR-1001 → Confirmar eliminación. Recargar. | Desaparece solo BOR-1001; contacto y BOR-1002 permanecen. |
| DEL-03 | Eliminar contacto → Confirmar eliminación. | Vuelve al listado con mensaje de éxito. Desaparecen el contacto y sus vehículos; su antigua URL muestra Contacto no disponible. |
| DEL-04 | Mi residencia → Ver detalle de BOR-2001 → Eliminar vehículo → Cancelar; repetir y confirmar. | Cancelar conserva el vehículo. Confirmar lo elimina; cierra el detalle y actualiza el listado. Al recargar no reaparece. |
| DEL-05 | Entrar como administrador y consultar Casa 24 y resumen. | Ve el registro permanente actualizado, sin acciones de eliminación cotidiana. Las casas y habitantes permanecen. |
| DEL-06 | Intentar borrar un vehículo de Casa 12 como Daniel, o un contacto de Daniel como Ana. Repetir con cuenta adicional o sin sesión. | Los servicios rechazan la operación sin escribir. También rechazan un ID de vehículo ajeno enviado con un contacto/casa propio. |
| DEL-07 | Abrir confirmaciones de las tres acciones en móvil, recorrer con teclado y cancelar. | Botones legibles, sin desbordamiento. El foco inicial está en Cancelar; no se elimina con el primer clic. |
| DEL-08 | Con almacenamiento bloqueado/sin espacio en una copia de prueba, confirmar una eliminación. | Error visible, registro conservado y sin mensaje de éxito. Puede cancelar o reintentar tras resolver el almacenamiento. |

Las funciones son `contactsService.deleteContact(id)`, `contactsService.deleteVehicle(contactId, vehicleId)` y `communityService.deleteVehicle(residenceId, vehicleId)`. Cada llamada vuelve a verificar la sesión, el principal actual, la pertenencia y el estado de la residencia. Cambiar el principal mientras una confirmación está abierta no mantiene permisos antiguos.

Resultados: `npm test` **51/51** pruebas correctas, incluidas seis nuevas pruebas de eliminación con almacenamiento aislado. Cubren cascada del contacto, conservación de registros no afectados, contadores, permisos, IDs cruzados, residencia inactiva, revocación de principal, fallos de escritura y restauración demo. Build correcto. En navegador se verificaron las tres confirmaciones y Cancelar; revisión móvil a 375 × 812 sin desbordamiento. No se borraron los registros existentes del navegador durante esta verificación.

## Etapa 4 · Contactos frecuentes (conservada)

El recorrido de Invitar de esta sección es histórico: la pantalla preparada fue sustituida por I5-01 a I5-18.

### Preparación y datos

- Daniel, principal de Casa 24: `residente@accesshome.demo` / `[contraseña histórica retirada]`.
- Ana, principal de Casa 12 y agenda independiente: `ana@accesshome.demo` / `[contraseña histórica retirada]`.
- Mariana, habitante adicional sin acceso a agenda: `mariana@accesshome.demo` / `[contraseña histórica retirada]`.
- Administrador: `admin@accesshome.demo` / `[contraseña histórica retirada]`; no consulta agendas privadas.
- Ruta del módulo: `/residente/contactos`. En móvil abrir el menú para acceder.
- Contactos demo de Daniel: Carlos López (3312345678, Mazda 3 / JKL-1234), María González (sin vehículo), Pedro Ramírez (Nissan Versa / HJK-7821).
- Para nuevas pruebas usa **Julia Herrera**, teléfono 3312345088 y placas **JHR-8001** / **JHR-8002**. Si ya existen dentro del contacto, utiliza otras.

La migración a esquema 4 conserva casas, principales, habitantes, vehículos permanentes y sesión. No es necesario restaurar el navegador. Restaurar desde el login descarta las modificaciones locales y recupera también los tres contactos y dos vehículos de contacto originales.

### Ocho casos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E4-01 | Como Daniel, abrir Contactos frecuentes → Nuevo contacto. Guardar solo el nombre Julia Herrera. | Abre el detalle del nuevo contacto activo, sin vehículos; teléfono, correo y notas no son obligatorios. |
| E4-02 | Editar contacto. Cambiar nombre a Julia Herrera Díaz, teléfono a 3312345088 y notas a Visita de prueba; guardar. | Muestra los datos actualizados y conserva el propietario. Recargar mantiene sesión y contacto. |
| E4-03 | Agregar vehículo con solo placas JHR-8001; guardar. Agregar otro con JHR-8002, Honda, Civic y sin color. | Dos vehículos del contacto; marca/modelo/color opcionales. Ninguno aparece en Mi residencia → Vehículos registrados. |
| E4-04 | Editar JHR-8001: añadir Mazda, modelo 3 y color Azul. Guardar y recargar. | Cambios persistidos en ese vehículo; el segundo vehículo permanece intacto. |
| E4-05 | Editar JHR-8001 y seleccionar Inactivo. Luego volver a editarlo y seleccionar Activo. | Baja reversible: aparece su estado y conserva sus datos. No cambia el estado del contacto ni del otro vehículo. |
| E4-06 | Volver a contactos. Buscar `maria`, `LÓPEZ`, `331234`, `JHR-8002` y un texto inexistente; limpiar búsqueda. | Filtra sin distinguir acentos/mayúsculas, incluye teléfono/correo/placas y muestra estado vacío cuando corresponde. |
| E4-07 | Copiar la URL del detalle de Julia. Cerrar sesión, entrar como Ana y abrir esa URL. Probar además la llamada directa indicada abajo. | Contacto no disponible, sin datos ni edición. Su agenda no incluye los contactos de Daniel. El servicio rechaza modificaciones ajenas. |
| E4-08 | Como Daniel, repetir listado, creación, edición y búsqueda a 375 px; revisar también a 768 px y escritorio. | Formularios en una columna, botones cómodos, Ver/Invitar claros, listado sin tabla ancha y sin desplazamiento horizontal. |

### E4-07 · Llamada directa al servicio

Con `npm run dev`, sesión de **Ana** y la consola de desarrollo abierta, ejecutar:

```js
const { contactsService } = await import('/src/services/contactsService.ts');
try {
  await contactsService.updateContact('contact-carlos', {
    name: 'Cambio no permitido', phone: '', email: '', notes: '', active: true,
  });
  console.error('FALLO: se permitió modificar un contacto ajeno');
} catch (error) {
  console.log(error.message);
}
```

Debe mostrar **Contacto no disponible. Solo puedes acceder a tus propios contactos.** Volver con Daniel y confirmar que Carlos López conserva sus datos. Este ejemplo funciona con Vite en desarrollo, no en `npm run preview`. Las pruebas automatizadas comprueban también lectura y todas las mutaciones de vehículos contra IDs ajenos, sin escribir cambios.

### Casos adicionales y regresión

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E4-09 | Editar contacto → Inactivo. Consultar sus vehículos y volver a activarlo. | No se borran datos ni cambian los estados individuales de sus vehículos. Invitar deshabilitado mientras el contacto está inactivo. |
| E4-10 | Pulsar Invitar desde un contacto activo, tanto en lista como en detalle; volver al contacto. | Ruta preparada con su nombre y aviso de próxima etapa. No crea invitación, QR ni autorización de acceso. |
| E4-11 | Intentar guardar nombre vacío, correo inválido, placas vacías o placas repetidas dentro del mismo contacto (también variando espacios/guiones/mayúsculas). | Validación legible; no duplica ni guarda parcialmente. Las placas de otro contacto o de una residencia no se mezclan con este registro. |
| E4-12 | Entrar como Mariana y abrir `/residente/contactos`; repetir como administrador. | Mariana no ve enlace y la ruta muestra Agenda no disponible. El administrador es redirigido a su inicio por la protección de roles. Los servicios también rechazan ambos perfiles. |
| E4-13 | En una copia de prueba, cambiar principal de Casa 24 a Mariana desde administración. Entrar con cada cuenta. Restaurar luego a Daniel como principal existente. | Daniel deja de acceder, Mariana tiene su propia agenda vacía y no hereda contactos de Daniel. Al recuperar la asignación, Daniel vuelve a ver los suyos. |
| E4-14 | Como administrador, desactivar una residencia y entrar con su principal. Después reactivarla. | La agenda conserva lectura privada pero bloquea creación/edición e Invitar mientras la casa está inactiva. |
| E4-15 | Crear/editar contactos y vehículos; recargar, salir y volver a entrar. Probar también dos pestañas del mismo origen. | Datos persistentes y cambios sincronizados. Se mantienen login, logout, rol y datos de comunidad. |
| E4-16 | Restaurar la demostración en un navegador destinado a pruebas. | Recupera los tres contactos/dos vehículos demo de Daniel y la comunidad original; cierra sesión. No modifica claves de otras aplicaciones. |

### Resultado de esta etapa

- `npm test`: **45/45** pruebas correctas: 32 de regresión y 13 de contactos. Cubren permisos por propietario/principal, asignación, estados, separación de vehículos, campos opcionales, duplicados, búsqueda, migración desde v3, corrupción, errores de escritura y restauración.
- `npm run build`: TypeScript y Vite correctos. `npm run dev` funciona en el puerto 5173; se reinició Vite para resolver una caché de importación CSS durante la integración.
- Navegador: E4-01 a E4-08 comprobados con **Laura Sánchez**, luego **Laura Sánchez Ruiz**, teléfono 3312345099, nota Visita habitual de demostración y dos vehículos: **LRS-9001** (creado solo con placas, luego Mazda 3 azul/inactivo) y **LRS-9002** (Honda Civic, sin color, activo). Los datos se conservaron para revisión. La reactivación del vehículo está cubierta por tests; el recorrido de navegador verificó su desactivación.
- Desactivación/reactivación del contacto comprobada; quedó activo. Invitar deshabilitado al desactivarlo y ruta preparada comprobada al reactivarlo. Búsqueda `maria` encontró María González; las variantes restantes están cubiertas por tests y disponibles en el recorrido manual.
- Como Ana: agenda vacía y detalle de Laura bloqueado. Como Mariana: menú sin contactos y ruta bloqueada. Llamadas directas de modificación ajena verificadas en tests de servicio; la guía incluye cómo reproducirlas manualmente.
- Vehículos de Casa 24 conservados y separados de LRS-9001/LRS-9002. No se reiniciaron datos anteriores del navegador.
- Lista y formularios inspeccionados a 375 × 812; lista a 768 × 1024 y escritorio a 1366 × 1000. Sin desbordamiento horizontal en las vistas medidas. Azul/amarillo, botones grandes y formularios de una columna conservados.
- No se añadieron dependencias ni se implementaron invitaciones completas. Sin commit ni push.

## Etapa 3 · Permisos y residencia propia (regresión)

Esta corrección sustituye los casos E3 antiguos que daban al administrador altas/edición cotidianas o limitaban al principal a consulta. La autenticación, navegación, búsqueda, 404 y pruebas de almacenamiento de etapas anteriores siguen aplicando.

### Datos

- Administrador: `admin@accesshome.demo` / `[contraseña histórica retirada]`.
- Daniel, principal de Casa 24: `residente@accesshome.demo` / `[contraseña histórica retirada]`.
- Mariana, cuenta adicional de consulta: `mariana@accesshome.demo` / `[contraseña histórica retirada]`.
- Casa 24 contiene Daniel, Mariana, Andrea y Carlos en la semilla. Andrea/Carlos no tienen cuenta. Mantiene sus dos vehículos demo.
- Para este recorrido: Casa **91**, Circuito Cedros; principal **Sofía Ramos**, `sofia91@accesshome.demo`; habitante **Elena Cuevas**; vehículo `DEMO-324`, Mazda 3 azul. Usa otros valores si ya existen.
- Los datos anteriores se migran sin reinicio. Solo usa Restaurar datos demo si deseas descartar las altas/ediciones y volver a la semilla exacta: cuatro casas, ocho habitantes y cinco vehículos.

### Nueve recorridos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| P3-01 | Como administrador, abrir Residencias → Agregar residencia. Guardar Casa 91, Circuito Cedros, Activa. | Nueva casa sin principal ni habitantes; aparece en la búsqueda y el resumen. |
| P3-02 | Abrir Casa 91 → Asignar residente principal. Registrar Sofía Ramos / `sofia91@accesshome.demo`. | Sofía figura como principal. Solo hay acciones de estructura/asignación y consulta; no Agregar habitante ni Registrar vehículo. |
| P3-03 | Cerrar sesión. Entrar con `sofia91@accesshome.demo` / `[contraseña histórica retirada]`. Después entrar como Daniel para los pasos siguientes. | Sofía gestiona Casa 91; Daniel gestiona Casa 24. Ninguno puede editar el número de casa, crear casas o asignarse otra. |
| P3-04 | Como Daniel, pulsar Agregar habitante. Nombre Elena, apellido Cuevas, relación Familiar; dejar teléfono/correo vacíos y guardar. | Habitante activo de Casa 24, sin crear cuenta de acceso. |
| P3-05 | Ver detalle de Elena → Editar habitante. Cambiar apellido a Cuevas Pérez y teléfono a `55 5550 2432`; guardar y volver a abrir el detalle. | Datos actualizados. El formulario permite desactivar y reactivar; no cambia casa ni asignación. |
| P3-06 | Registrar vehículo: `DEMO-324`, Mazda, 3, Azul, Activo, propietaria Elena Cuevas Pérez. | Vehículo de Casa 24, con propietaria de esa casa. El selector no incluye habitantes de otras casas. |
| P3-07 | Ver detalle del vehículo → Editar vehículo. Cambiar color a Azul oscuro y estado a Inactivo; guardar y recargar. | Se conservan sesión, casa, propietaria, color y estado. Se puede reactivar. |
| P3-08 | Como Daniel, abrir `/admin/residencias/house-12`. Ejecutar además la llamada directa de servicio indicada debajo. | La ruta vuelve a `/residente` con aviso. La llamada rechaza la modificación por pertenecer a otra casa. |
| P3-09 | Cerrar sesión, entrar como administrador y abrir Residencias → Casa 24. Abrir los detalles de Elena y del vehículo. | Ve habitantes/vehículos actualizados y sus datos; no puede editarlos desde el detalle. |

### P3-08: comprobar permisos en el servicio

Con `npm run dev`, sesión de Daniel y la consola de desarrollo del navegador abierta en `/residente`, ejecutar:

```js
const { communityService } = await import('/src/services/communityService.ts');
try {
  await communityService.updateVehicle('house-12', 'vehicle-12', {
    plates: 'DEMO-012', brand: 'Kia', model: 'Rio', color: 'Verde',
    active: true, ownerId: null,
  });
  console.error('FALLO: se permitió modificar otra casa');
} catch (error) {
  console.log(error.message);
}
```

Resultado: **Solo puedes acceder a tu propia residencia.** El administrador debe seguir viendo el Kia de Casa 12 azul, sin cambios. El ejemplo requiere el servidor de desarrollo de Vite; no funciona en `npm run preview` porque el código fuente no se sirve en el build. `npm test` también verifica las cuatro operaciones de habitantes/vehículos contra otra casa, además de IDs ajenos enviados junto al ID de Casa 24.

### Casos adicionales y regresión

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| P3-10 | Como Daniel, desactivar a Elena desde Editar habitante. Consultar su vehículo y reactivar a Elena. | Habitante inactivo identificado; vehículo y propietaria se conservan. La reactivación recupera el estado activo. |
| P3-11 | Abrir la edición de Daniel. | Estado deshabilitado: el principal no puede desactivarse hasta que el administrador lo reemplace. La misma acción directa se rechaza en el servicio. |
| P3-12 | Como administrador, editar Casa 91 y cambiarla a Inactiva. Entrar con Sofía. Luego reactivarla como administrador. | Sofía consulta pero no gestiona mientras esté inactiva; tras reactivación recupera la gestión. No se borran habitantes/vehículos. |
| P3-13 | Como Sofía, agregar a Tomás Ramos sin cuenta. Como administrador, cambiar principal de Casa 91 a Tomás, correo de acceso `tomas91@accesshome.demo`. | No duplica al habitante. Tomás puede entrar con [contraseña histórica retirada] y gestionar; Sofía queda en consulta. La casa de Daniel no cambia. |
| P3-14 | Como administrador, volver a elegir Sofía como principal existente. | Usa su cuenta previa; no exige crear otra ni cambia su contraseña. Tomás queda como habitante de consulta. |
| P3-15 | En Casa 91, intentar crear un nuevo principal usando `residente@accesshome.demo`. | Error de correo existente; no mueve a Daniel ni duplica habitantes/cuentas. |
| P3-16 | Entrar como Mariana y consultar Casa 24. | Tiene consulta y detalle, sin altas/ediciones ni permisos de gestión en servicios. |
| P3-17 | Como Daniel, editar correo de contacto de un habitante con cuenta. | Cambia el contacto, no su correo de acceso ni contraseña. Si desactiva una cuenta adicional, esta no puede iniciar sesión hasta reactivarse. |
| P3-18 | Intentar Casa 24 duplicada, principal con correo inválido/existente, placas `demo 012` o campos obligatorios en blanco. | Error legible; sin registros duplicados ni guardados parciales. Teléfono, contacto y relación de habitantes siguen siendo opcionales. |
| P3-19 | Repetir login incorrecto, ambos roles, logout, recarga, perfil, 404 y cambios entre pestañas. | Se conservan flujos anteriores. Los cambios de principal/estado se reflejan al recibir notificaciones y el servicio revalida cada operación. |
| P3-20 | Probar listas, detalles, formularios y menú a 375, 768 y 1366 px. Recorrer con teclado. | Sin desbordamiento horizontal; acciones visibles, foco identificable y tablas/listas legibles. |
| P3-21 | Restaurar desde el login en una copia de prueba. | Recupera Daniel como principal de Casa 24, ocho habitantes y cinco vehículos; cierra sesión y elimina las altas locales. |

### Verificación realizada en esta corrección

- `npm test`: **32/32** pruebas correctas: 11 de autenticación, 17 de comunidad/permisos y 4 de migración/integridad. Prueban permisos dentro de servicios, asignación/revocación, acceso anónimo e inactivo, rechazo entre condominios, propietarios, duplicados y errores de escritura. Se conserva la regresión de autenticación.
- `npm run build`: TypeScript y Vite correctos. Se reutilizó y comprobó el servidor `npm run dev` del puerto 5173.
- Navegador, P3-01 a P3-09: se usó Casa **90** y **Sofía Ramos** (`sofia90@accesshome.demo`), se comprobó su login; como Daniel se agregó **Lucía Cuevas**, luego **Lucía Cuevas Pérez** / `55 5550 2490`. Se registró `DEMO-224` Mazda 3, se editó a Azul oscuro/Inactivo y se comprobó recarga. El administrador ve los cambios sin botones cotidianos. P3-08: bloqueo de ruta probado en navegador; llamadas directas verificadas por tests de Node.
- Desactivación/reactivación de Lucía probada desde el móvil; quedó activa y sin cuenta. Se conservaron sus datos y su vehículo. La migración mantuvo la sesión previa de Laura, Casa 88 y Casa 25; no se reinició localStorage.
- Revisión visual de formularios a 375 × 812 y consulta administrativa a 1366 × 1000 y 768 × 1024. Sin desbordamiento horizontal en las vistas medidas. Se ajustó la posición del indicador Principal en tablet. Menú y logout móvil comprobados.
- El cambio de principal y la casa inactiva están cubiertos por pruebas automatizadas; P3-12 a P3-14 quedan disponibles como recorridos manuales adicionales sin alterar la asignación demo de Daniel.
- No se instalaron dependencias ni se realizaron commits/push. No se inició contactos frecuentes.

## Etapa 3 · Comunidad (registro histórico)

Los recorridos y resultados siguientes corresponden a la implementación previa. Sus permisos de edición administrativa y consulta exclusiva del residente fueron sustituidos por P3-01 a P3-21.

La autenticación sigue funcionando. `/admin` ahora abre el resumen del condominio y `/residente` abre la casa del residente. Los datos de perfil anteriores están en **Mi perfil**.

### Preparación y datos

- Administrador: `admin@accesshome.demo` / `[contraseña histórica retirada]`.
- Daniel Cuevas: `residente@accesshome.demo` / `[contraseña histórica retirada]`, asociado a Casa 24.
- Semilla nueva: Residencial Los Robles; Casa 12 (Ana López y Jorge Mendoza), Casa 24 (Daniel Cuevas y Mariana Torres), Casa 37 (Luis Herrera) y Casa 51 (Elena Ríos).
- Cinco vehículos permanentes, cuatro activos y uno inactivo en una semilla recién restaurada. Casa 24 tiene `DEMO-024` (Daniel, activo) y `DEMO-124` (Mariana, inactivo).
- Para las altas utiliza Casa `90`, `Circuito Cedros`, residente `Laura Pérez`, correo `laura90@accesshome.demo`, vehículo `DEMO-090`, `Honda`, `Civic`, `Negro`. Si existen, usa otro número, correo y placas.

La migración conserva los registros de la etapa 2, incluida Casa 25; añade lo que falte y conserva la sesión. Los vehículos anteriores reciben estado activo y propietario sin asignar. Por ello las cantidades iniciales pueden diferir de la semilla nueva. No hace falta borrar datos. Si se desea la semilla exacta, cerrar sesión y usar **Restaurar datos demo → Confirmar restauración**, que descarta las altas y ediciones locales.

### Crear una casa, agregar residente y registrar vehículo

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E3-01 | Ingresar como administrador y abrir Condominio. | Nombre, dirección y cantidades de residencias/residentes/vehículos calculadas desde datos reales. |
| E3-02 | Abrir Residencias y buscar `24`; luego `Casa 24` y un número inexistente. | Se filtra Casa 24 en los primeros casos y se muestra estado vacío para el inexistente. |
| E3-03 | Pulsar Agregar residencia, escribir número `90` y calle `Circuito Cedros`, guardar. | Aparece Casa 90; el filtro se limpia para que la nueva casa sea visible. |
| E3-04 | Abrir Casa 90 y pulsar Agregar residente demo. Guardar Laura Pérez / `laura90@accesshome.demo`. | Residente asociado a Casa 90 y contador actualizado. La cuenta usa `[contraseña histórica retirada]`. |
| E3-05 | Pulsar Agregar vehículo. Completar `DEMO-090`, Honda, Civic, Negro, Activo; elegir Laura Pérez como propietaria. | Vehículo asociado a la casa, con sus datos, estado y propietaria visibles. |
| E3-06 | Recargar y volver al listado/resumen. | Casa, residente y vehículo se conservan; cantidades actualizadas. |
| E3-07 | Cerrar sesión y entrar como `laura90@accesshome.demo` / `[contraseña histórica retirada]`. | Solo consulta Casa 90 y sus datos. No aparecen acciones de edición. |

### Edición, integridad y permisos

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E3-08 | Como administrador, editar calle/número de Casa 90. | Se actualiza la información sin perder residentes ni vehículos. |
| E3-09 | Editar nombre/correo de Laura. | Se actualiza la tabla y el nombre de propietaria en sus vehículos. Puede entrar con el nuevo correo y la misma contraseña. |
| E3-10 | Editar placas, marca, modelo, color y estado de un vehículo; seleccionar Sin asignar. | Cambios persistidos; estado Inactivo explícito y propietaria opcional. El resumen refleja los vehículos activos. |
| E3-11 | En Condominio, pulsar Editar información y modificar nombre/dirección. | Se reflejan en el resumen y en los detalles de las casas; Cancelar conserva los datos previos. |
| E3-12 | Intentar repetir Casa 24, un correo ya registrado o las placas `DEMO-024` (también `demo 024`). | Error legible; no duplica ni sobrescribe registros. |
| E3-13 | Dejar campos obligatorios vacíos o escribir una calle con solo espacios. | No guarda; muestra validación del formulario o servicio. |
| E3-14 | Revisar el selector de propietario en Casa 24. | Solo permite elegir residentes de Casa 24 o Sin asignar. El servicio también rechaza IDs de otra casa. |
| E3-15 | Como Daniel, consultar Mi residencia y luego intentar `/admin/residencias/house-12`. | Ve Casa 24 con Daniel/Mariana y sus vehículos; la ruta administrativa redirige a su inicio con aviso. |
| E3-16 | Abrir un ID de residencia inexistente como administrador. | Mensaje Residencia no disponible con enlace de regreso. |
| E3-17 | Probar login incorrecto, logout, recarga con sesión y Mi perfil para ambos roles. | Continúan funcionando los flujos de la etapa 2. |
| E3-18 | Probar formularios/listas a 375–430 px, 768 px y escritorio. | Tablas de escritorio; listas compactas en ancho reducido, campos y acciones accesibles, sin scroll horizontal. |
| E3-19 | Restaurar datos demo y volver a entrar. | Cuatro casas, seis residentes, cinco vehículos; se eliminan altas y ediciones de prueba. |

### Resultados de verificación de la etapa 3

- `npm test`: **25/25** pruebas correctas. Incluye regresión de autenticación, alta/edición, duplicados, relaciones, propietarios, acceso entre condominios, consultas del residente, migración, restauración y fallos de escritura.
- `npm run build`: TypeScript y Vite correctos.
- Navegador: migración conservó sesión y Casa 25, y mostró Los Robles con las nuevas casas y residentes.
- Se creó **Casa 88**, **Laura Méndez** (`laura@accesshome.demo`) y **DEMO-088**, Honda Civic. Se comprobó persistencia al recargar, se editó la calle a **Circuito Cedros Norte**, el nombre a **Laura Méndez Ruiz** y el vehículo a **Azul oscuro / Inactivo**. Estos registros de prueba se conservaron; no se restauraron los datos del navegador.
- E3-02 a E3-06 y edición de casa/residente/vehículo comprobados en la interfaz. El resto de validaciones de integridad y restricciones de servicio también está cubierto por tests automatizados.
- E3-07: la cuenta creada `laura@accesshome.demo` entró con `[contraseña histórica retirada]` y mostró exclusivamente Casa 88 con su vehículo inactivo. Se comprobó el formulario de edición del condominio guardando sus valores vigentes y el rechazo visual de Casa 24 duplicada.
- Vista de Daniel verificada sin acciones de edición; bloqueo de detalle administrativo de otra casa y persistencia al recargar comprobados.
- Revisión visual a 1366 × 1000, formulario de vehículo y consulta de residente a 375 × 812, y consulta a 768 × 1024. Ancho de contenido igual al área disponible en las vistas móviles/tablet inspeccionadas.
- Sin errores ni advertencias de consola observados.

## Etapa 2 · Autenticación simulada (regresión)

Las pruebas de esta sección sustituyen el acceso libre y el cambio directo de perfil de la etapa 1. Las verificaciones anteriores de apariencia, teclado y 404 siguen aplicando, pero las rutas de cada perfil requieren su sesión correspondiente.

### Datos de prueba

| Perfil | Nombre | Correo | Contraseña |
| --- | --- | --- | --- |
| Administrador | Administrador Demo | `admin@accesshome.demo` | `[contraseña histórica retirada]` |
| Residente | Daniel Cuevas | `residente@accesshome.demo` | `[contraseña histórica retirada]` |

En la etapa 2 el condominio se llamaba Los Encinos y la semilla tenía Casa 24 y Casa 25. La etapa 3 actualiza el nombre, amplía los datos e incorpora su gestión; las credenciales principales se conservan.

### Los seis recorridos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E2-01 | En `/login`, escribir `admin@accesshome.demo` y contraseña `incorrecta`. Pulsar Iniciar sesión. | Aviso **Correo o contraseña incorrectos**. Permanece en login sin crear sesión. |
| E2-02 | Cambiar contraseña a `[contraseña histórica retirada]` y enviar. | Abre `/admin`; muestra Administrador Demo, rol Administrador y el condominio. |
| E2-03 | Pulsar Cerrar sesión en el menú. En móvil, abrir primero el menú. | Abre `/login`. Abrir `/admin` o usar Atrás no recupera acceso. |
| E2-04 | Ingresar `residente@accesshome.demo` y `[contraseña histórica retirada]`. | Abre `/residente`; muestra Daniel Cuevas y Casa 24. |
| E2-05 | Con la sesión de residente, escribir `/admin` o `/admin/no-existe` en la dirección. | Regresa a `/residente` con aviso de acceso restringido. No muestra contenido del administrador. |
| E2-06 | Recargar `/residente`. Repetir luego con la sesión del administrador en `/admin`. | Conserva usuario, rol y ruta; recupera el contexto del perfil. |

### Regresión y casos adicionales

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E2-07 | Sin sesión, abrir `/admin`, `/residente` y subrutas de ambos. | Redirección al login. |
| E2-08 | Con sesión de administrador, abrir `/residente`. | Regresa a `/admin` con aviso. |
| E2-09 | Con cualquier sesión, abrir `/login` o `/`. | Redirección al inicio del rol actual. |
| E2-10 | Abrir `/no-existe`; después, con el rol adecuado, `/admin/no-existe` o `/residente/no-existe`. | 404 pública o dentro del layout autorizado; Volver al inicio funciona. |
| E2-11 | Abrir dos pestañas del mismo origen con la misma sesión. Cerrar sesión en una. | Ambas regresan al login sin recargar manualmente. |
| E2-12 | Desde el login, abrir Credenciales de demostración. | Correos y contraseñas legibles; el detalle puede cerrarse. |
| E2-13 | Pulsar Restaurar datos demo y Cancelar. | Conserva los datos. No aparece mensaje de restauración exitosa. |
| E2-14 | Pulsar Restaurar datos demo y Confirmar restauración. | Mensaje de éxito. Se restaura toda la semilla, se cierra la sesión y ambas credenciales originales funcionan. |
| E2-15 | Probar correo vacío, formato inválido y contraseña vacía; enviar con Enter. | Validación del formulario impide enviar campos inválidos. El envío válido funciona con teclado. |
| E2-16 | Revisar login con credenciales expandidas y perfil a 375–430 px, 768 px y 1280 px o más. | Sin desbordamiento horizontal; controles legibles, foco visible y logout accesible en el menú móvil. |

### Persistencia, restauración y errores

Toda la demostración reside bajo `accesshome.demo.v1`. No se usa `localStorage.clear()`. La función `demoService.resetDemoData()` reemplaza esa clave completa por la semilla original y notifica el cambio de sesión. Para restaurar desde la interfaz, cerrar sesión primero y usar el control del login.

Los tests automatizados verifican que restaurar elimina modificaciones de usuarios/residencias/vehículos, cierra sesión y conserva una clave de otra aplicación. También prueban JSON corrupto, versiones incompatibles, usuarios de sesión inexistentes y almacenamiento bloqueado o sin espacio. No se hace pasar un guardado fallido por exitoso ni se destruyen automáticamente datos corruptos.

Para reproducir datos corruptos manualmente en un perfil de navegador destinado a pruebas: en Herramientas de desarrollador → Almacenamiento local, cambia únicamente el valor de `accesshome.demo.v1` por `{incompleto` y recarga. Debe aparecer el login con un error que permite restaurar. Confirma la restauración y comprueba que puedes entrar otra vez.

La sesión no tiene caducidad automática. Persiste al recargar y se comparte entre pestañas del mismo origen; cambiar de hostname o puerto crea un almacenamiento independiente. Las restricciones son simuladas, no seguridad de producción.

### Ejecución automatizada

```sh
npm test
npm run build
```

`npm test` utiliza TypeScript y el ejecutor nativo de Node, sin nuevas dependencias. Sus 11 pruebas cubren los servicios; las restricciones visuales de rutas se comprueban en los recorridos del navegador.

## Registro de ejecución de la etapa 2

### Resultados de la etapa 2

- E2-01 a E2-06: los seis recorridos solicitados pasaron en el navegador integrado.
- E2-07: después del logout, el acceso directo a `/admin` y Atrás vuelven al login.
- E2-09: abrir `/login` con sesión residente vuelve a `/residente`.
- E2-10: 404 pública y del residente verificadas, incluido su enlace de regreso. La subruta `/admin/no-existe` se rechaza con el rol residente.
- E2-11: sesión recuperada en una segunda pestaña; logout propagado a ambas sin recarga manual.
- E2-12 y E2-14: credenciales desplegables y confirmación de restauración verificadas en UI.
- E2-15: envío válido con Enter comprobado.
- E2-16: revisión visual del login y logout móvil a 375 × 812, residente a 768 × 1024 y escritorio a 1366 × 1000. El contenido no desborda horizontalmente en las vistas revisadas.
- Consola del navegador sin errores ni advertencias observados.
- `npm test`: 11/11 pruebas correctas, incluidos fallos de almacenamiento, restauración íntegra y sesión inválida.
- `npm run build`: TypeScript y Vite correctos. Se conserva la guía manual para los casos adicionales y futuros controles de regresión.

## Etapa 1 · Registro histórico

### Datos de prueba originales de la etapa 1

En la entrega inicial se seleccionaban perfiles sin credenciales. Este comportamiento fue sustituido por los datos y las pruebas de la etapa 2 descritos arriba.

### Pruebas originales de infraestructura

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E1-01 | Abrir `/`. | Redirección a `/login`; marca y selección de perfil visibles. |
| E1-02 | Elegir Administrador. | URL `/admin`, encabezado Administrador, Inicio activo y contenido del perfil. |
| E1-03 | Pulsar Cambiar de perfil y elegir Residente. | Regreso a `/login` y después `/residente`, con layout de residente. |
| E1-04 | Pulsar Inicio, Volver al acceso temporal y la marca. | Los enlaces llevan al destino indicado sin pantalla vacía. |
| E1-05 | Abrir y recargar `/admin` y `/residente` directamente. | Se conserva la ruta y se renderiza el layout correcto. No se pide sesión. |
| E1-06 | Abrir `/no-existe`. | Página 404 pública con enlace al acceso temporal. |
| E1-07 | Abrir `/admin/no-existe` y `/residente/no-existe`. | 404 con navegación del perfil; Volver al inicio lleva al inicio de ese perfil. |
| E1-08 | Usar Atrás y Adelante del navegador tras cambiar de perfil. | Historial y contenido coherentes con la URL. |
| E1-09 | Reducir el ancho a 390 px y 320 px. | Sin desplazamiento horizontal; login apilado y botón Abrir menú en cada perfil. |
| E1-10 | En móvil, abrir/cerrar el menú y pulsar Inicio. | El menú alterna y se cierra al navegar. El contenido sigue accesible. |
| E1-11 | Ampliar a escritorio. | Menú lateral visible y contenido en una segunda columna. |
| E1-12 | Recorrer la interfaz con Tab, Shift+Tab y Enter. | Foco visible, enlaces operables y enlace Saltar al contenido al inicio. |
| E1-13 | Navegar entre páginas y revisar el título de pestaña. | El título refleja acceso temporal, perfil o página no encontrada. |
| E1-14 | Ejecutar `npm run build`. | TypeScript y Vite finalizan correctamente y generan `dist/`. |
| E1-15 | Ejecutar `npm run preview` y abrir http://127.0.0.1:4173. | El build permite recorrer las mismas rutas. |
| E1-16 | Revisar login y perfiles con la paleta actualizada. | Azul dominante en encabezados y acciones; amarillo limitado a indicadores de etapa, con texto oscuro legible. |
| E1-17 | Probar a 375 px, 430 px y 768 px. | Navegación operable, información legible y sin desbordamiento horizontal. |

## Registro de ejecución

### Etapa 1 · 14 de septiembre de 2026

Entorno: Windows, Node.js 24.11.0, npm 11.6.1 y navegador integrado de Codex.

| Verificación | Resultado |
| --- | --- |
| Instalación | Correcta; auditoría de npm sin vulnerabilidades reportadas. |
| E1-01 a E1-03 | Redirección inicial y cambio entre ambos perfiles comprobados. |
| E1-04 | Inicio y regreso mediante Cambiar de perfil comprobados; los restantes enlaces conservan destinos explícitos en el router. |
| E1-05 | Recarga de ambos perfiles comprobada en desarrollo; apertura directa también comprobada en el build. |
| E1-06 y E1-07 | 404 pública y de cada perfil comprobadas, incluido el enlace de regreso. |
| E1-08 | Atrás y Adelante conservan la ruta esperada. |
| E1-09 a E1-11 | Revisados escritorio a 1366 × 900 y móvil a 390 × 844 y 320 × 740; menú abre, cierra y se oculta al seleccionar Inicio. |
| E1-12 | Enter activa los enlaces y el menú; Shift+Tab recorre menú, marca y Saltar al contenido. Este último lleva el foco al contenido. |
| E1-13 | Títulos del acceso, administrador, residente y 404 comprobados. |
| E1-14 | Build correcto con comprobación de TypeScript. |
| E1-15 | Rutas `/`, `/admin`, `/residente` y las tres variantes 404 comprobadas en la vista previa del build. |
| Consola | Sin errores ni advertencias observados durante el recorrido. |

Se corrigió un desbordamiento causado por un ancho mínimo del body a 320 px. Tras el ajuste, el ancho del contenido coincide con el área útil del navegador en el login y el administrador. También se evitó que el foco automático desplazara la página al entrar.

El sandbox de ejecución bloqueó inicialmente la creación de procesos de Vite (`EPERM`). Build, desarrollo y vista previa funcionaron al ejecutarse con los permisos aprobados; no fue necesario alterar los comandos del proyecto.

Esta revisión cubre navegación y accesibilidad básica; no sustituye una auditoría con lectores de pantalla ni pruebas en teléfonos físicos.

### Ajuste de la etapa 1 al objetivo actualizado

- Actualizados los azules y añadidos acentos amarillos en los indicadores de etapa.
- `npm run build` completado correctamente después del ajuste.
- E1-16: revisados visualmente login, administrador y residente con la nueva paleta.
- E1-17: login y administrador revisados a 768 × 1024; residente a 375 × 812 y 430 × 932. Sin desbordamiento horizontal en el administrador y el residente; menú móvil abierto y cerrado al pulsar Inicio.
- Se reutilizó el servidor de desarrollo existente en el puerto 5173, comprobado desde el navegador. Si `npm run dev` indica que el puerto está ocupado, abrir la instancia existente antes de iniciar otra.
- Los datos de prueba siguen siendo los perfiles temporales Administrador y Residente, sin credenciales.


