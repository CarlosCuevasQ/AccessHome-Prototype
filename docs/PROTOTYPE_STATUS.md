## Etapa 12 · Escáner QR y movimientos compartidos

Implementada y verificada localmente. **Pendientes: aplicación remota de `20260918000100_guard_scanning.sql`, prueba con Auth/PostgREST reales y cámaras físicas.** Las diez migraciones anteriores permanecen intactas. No se modificó `.env.local`, no se ejecutó SQL remoto ni semilla remota, no hubo commit, push o despliegue.

- `/guardia/escanear` utiliza el panel, layout, guardService, AccessFeedback y motor de accesos existentes. Activar/Detener cámara por acción explícita, alternativa manual, resultado grande y Escanear siguiente. Stream cerrado tras lectura, al salir o esconder la página y ante permisos concedidos tardíamente después de detener.
- Lectura local con `qr@0.7.0`, sin dependencias transitivas y decodificador en carga diferida; conserva `qrcode.react` para mostrar invitaciones. No se guardan frames ni tokens, no se navega una URL escaneada.
- El mismo `validate_access` sirve a administración y guardia. Nueva firma para método QR/MANUAL, antigua firma compatible; autorización privada, RLS intacto y sin escrituras SQL de clientes. Verifica condominio, perfil/casa activos, vigencia, estado, usos y secuencia histórica.
- Registro de entrada/salida en la tabla compartida existente con operador Auth, nombre como snapshot, visitante, residencia, vehículo, fecha del servidor, método y resultado aprobado. No se altera historia ni se crea una segunda bitácora; rechazos no generan movimientos.
- Bloqueos transaccionales, comparación de usos antes/después de esperar y separación mínima de 3 segundos para guardia impiden consumir salida por una ráfaga. Idempotencia conserva el request_id ante respuesta perdida; la recuperación de la misma sesión Auth no lo elimina. Respuesta recuperada en amarillo sin autorizar un nuevo paso. React nunca envía `authorized=true`.
- Admin y residente consultan los nuevos movimientos con el historial existente. Caseta conserva refetch/polling y datos mínimos. Servicios y reportes de turno siguen como próximas etapas.

Pruebas: **`npm test` 182/182**, **`npm run test:concurrency` 17/17**, SQL/PGlite y PostgreSQL 17.10 temporal con conexiones independientes. Incluye salidas autorizadas tras cancelación/expiración con trazabilidad, entradas inválidas, cinco carreras entre guardias, bloqueo superior al intervalo de 3 segundos, idempotencia, rollback, dos salidas simultáneas, snapshot obsoleto y cancelación concurrente. `npm run build` y `npm run build:vercel` aprobados; revisión del artefacto sin secretos reconocibles/archivos privados. Persiste la advertencia de bundle principal >500 kB (~695 kB, ~196 kB gzip); decodificador separado ~35 kB (~14 kB gzip).

Navegador local con Auth simulado y SQL real desechable: residente crea visita; guardia en otro origen registra entrada manual; administrador consulta el registro; guardia registra salida, administrador ve exactamente dos registros; tercer intento rechazado. Activar/Detener comprobado mientras el permiso estaba pendiente, sin capturar cámara física. Resultado móvil verde/rojo verificado a 390 px, sin desbordamiento; ancho de página comprobado a 768 px. Sin errores de consola de guardia/administrador. Esto no equivale a dispositivos ni cuentas remotas reales.

Guía de aplicación y límites en [GUARD_SCANNING.md](GUARD_SCANNING.md); aceptación remota de trece pasos en [PROTOTYPE_TESTING.md](PROTOTYPE_TESTING.md#etapa-12--escáner-qr-y-movimientos-compartidos). La migración está preparada para revisión/aplicación por el responsable después de comprobar el historial. No se declara operativo el escaneo remoto.

Las secciones siguientes conservan el registro histórico de las etapas anteriores; sus estados pendientes de escaneo quedan sustituidos por esta etapa.

## Etapa 11 · Compartir invitaciones y preparar Vercel

Entrega implementada y comprobada localmente. **No desplegada ni validada contra Supabase remoto.** Las ocho migraciones base siguen intactas, al igual que la novena de Guardia. Se añade únicamente `20260917000700_public_invitation_sharing.sql`, pendiente de aplicación por el responsable. No se modificó `.env.local`, no se repitió semilla, no hubo commit, push ni cambios remotos.

- Detalle existente con Compartir invitación mediante Web Share, Enviar por WhatsApp y Copiar enlace. Copia alternativa/manual cuando el navegador lo necesita; cancelar el menú no envía ni copia. WhatsApp solo prepara el mensaje y el enlace.
- QR y todas las acciones usan el origen real del deployment. El build `shared` exige URL pública HTTPS al compartir; no hay dominio inventado ni una nueva variable de entorno. Desarrollo/demo local conserva una advertencia de alcance.
- Consulta pública mediante cliente Supabase anónimo separado, sin persistencia o dependencia de la sesión del residente. Proyección mínima de visitante, destino, vigencia, estado y token; sin anfitrión, teléfono, correo, usos o vehículo. SQL conserva la firma y el rate limit, pero el parámetro `vehicle` se rechaza como solo lectura y no modifica filas; el residente define el vehículo al crear la invitación.
- Activa, Cancelada, Expirada y Completada determinadas por el servidor. QR retirado para estados no activos; refetch al abrir, enfocar/recuperar conexión, cada 10 s visible y con Actualizar estado. Un error de consulta retira los datos.
- `vercel.json`: rutas SPA directas, encabezados sin referrer/índice/caché pública. `build:vercel`: configuración compartida obligatoria y revisión de `dist` sin revelar valores. Solo las dos variables existentes de `.env.example`; no claves privilegiadas ni analítica.
- Se corrigió durante la prueba de navegador una colisión de claves React entre compartir y cancelar que duplicaba el bloque al refrescar el detalle.

Validación: **`npm test` 161/161**, **`npm run test:concurrency` 10/10** con PostgreSQL 17.10 temporal, **`npm run build`** y **`npm run build:vercel`** correctos. El último también aprobó la inspección de secretos reconocibles/archivos privados en el artefacto. Persiste la advertencia previa de bundle superior a 500 kB (~686 kB, ~193 kB gzip). El primer intento del build Vercel recibió `spawn EPERM` del sandbox; la repetición local autorizada terminó correctamente.

SQL/PGlite: diez migraciones, grants/RLS y proyección mínima, estados actuales anónimos, no-store y conservación exacta de filas al aplicar incrementales sobre una base poblada. SDK: POST público sin sesión, sin token en URL del RPC ni almacenamiento local de dominio. Compartir: Web Share, cancelación, errores genéricos, WhatsApp/copia y fallback. Build: rechazo de configuración ausente, secreta o HTTP, y separación de demo/metadatos Vercel.

Navegador local sobre PGlite desechable con Auth simulado: crear visita, copiar exactamente su enlace, verificar mensaje WhatsApp sin enviarlo, abrir visitante en otro origen sin sesión, visualizar QR, cancelar, actualizar y recargar la ruta pública; Cancelada y sin QR. Detalle y visitante a 390 px sin desbordamiento horizontal. Consola del visitante sin errores. La prueba no utiliza datos del proyecto remoto ni equivale a dos equipos físicos.

Pendiente del responsable: aplicar solo versiones faltantes, confirmar `publicInvitationVersion: 2`, importar/publicar en Vercel y ejecutar I-01–I-12 de [PROTOTYPE_TESTING.md](PROTOTYPE_TESTING.md). Comprobar teléfono real, cámara QR, Web Share nativo, WhatsApp real, dominio accesible sin protección Vercel que exija login y F5 sin 404. Guía: [DEPLOYMENT.md](DEPLOYMENT.md). La revisión de secretos no detecta todas las contraseñas arbitrarias ni controla logs de proveedores externos.

Archivos principales: `InvitationPage`, `PublicInvitationPage`, `InvitationShare`, `InvitationQr`, `invitationLinks`, `invitationSharingService`, cliente/transporte/adaptadores compartidos, DTO público y CSS; incremental 20260917000700; `vite.config.ts`, `vercel.json`, `package.json`, revisión de artefacto/salud; suites SQL/SDK/compartir/despliegue y fixture visual; README y guías de deployment/status/testing/services/SQL.

Commit sugerido, sin ejecutar: `feat: compartir invitaciones y preparar despliegue de pruebas en Vercel`.

## Etapa 10 · Guardia y caseta (entrega anterior)

Estado actual: las ocho migraciones iniciales, semilla y cuentas base ya están activas remotamente según el responsable. Esta entrega añade **una sola migración incremental pendiente**, `20260917000600_guard_workspace.sql`. No se editaron las ocho aplicadas, no se ejecutaron migraciones remotas ni semilla, no se modificó `.env.local` y no se hizo commit/push.

- Rol SQL existente `guard`, reconocido en `session_profile`, Auth y rutas. No es administrador; `/admin` devuelve a `/guardia` con aviso.
- Panel independiente con layout y componentes existentes: guardia/condominio, reloj en zona del condominio, accesos de hoy, cinco entradas y salidas recientes, total de pendientes y diez pendientes más antiguos.
- Historial de consulta: siete días de calendario, filtro de movimiento y paginación de 50 filas. Services consultan Supabase; no hay datos locales de guardia ni fallback.
- Escanear es la acción principal. Escaneo, servicios y reportes de turno tienen rutas explícitas de próxima etapa, sin botones ficticios ni escritura habilitada.
- Provisión y activación/desactivación exclusivamente mediante funciones privadas del propietario; cuenta Auth creada por el responsable. No convierte roles, traslada cuentas ni reactiva silenciosamente. Sin contraseñas en el repositorio.
- RPCs expuestos invoker; autorización y proyección mínima en esquema privado. RLS existente conservado. Guardia sin gestión de residencias, principales, habitantes, vehículos, usuarios, roles, invitaciones o accesos históricos; tampoco ve reportes privados.
- Refetch al abrir, enfocar o recuperar conexión; cada 30 s visible y botón Actualizar en panel. Datos retirados ante error. Desactivación comprobada en backend con JWT vigente.

Validación local: `npm test` **149/149**; `npm run test:concurrency` **10/10** en PostgreSQL **17.10** con conexiones independientes; `npm run build` correcto, con advertencia previa de bundle superior a 500 kB. La migración se aplicó también sobre las ocho versiones pobladas en PGlite y se compararon todas las filas antes/después: sin cambios. Concurrencia adicional: provisión idempotente y desactivación que rechaza una consulta en espera.

Navegador con HTTP/Auth simulado, aislado en puerto 5175: login, nombre/condominio, redirección desde `/admin`, filtro de historial, estados pendientes, menú móvil, logout y retorno a login al abrir `/guardia` sin sesión. Móvil de 375 y 390 px y tablet de 768 px, sin desbordamiento horizontal medido ni errores de consola. Esto no prueba Auth/PostgREST reales.

Pendiente: aplicar la incremental, vincular la cuenta y ejecutar G-01–G-11 con Auth real. **No se declara funcionamiento remoto del rol guardia.** Guía exacta en [GUARD_SETUP.md](GUARD_SETUP.md). El escaneo operativo, registro de servicios y reportes de turno pertenecen a etapas posteriores.

Archivos principales: migración incremental; `src/services/guardService.ts`, `src/types/guard.ts`, páginas `GuardDashboardPage`, `GuardHistoryPage`, `GuardUpcomingPage`, CSS de caseta; Auth/rutas/navegación/layout y componentes de accesos reutilizados; chequeo de salud, auditoría y pruebas SQL/cliente/concurrencia; README y guías de setup/status/testing.

Commit sugerido, sin ejecutar: `feat: agregar rol guard y panel de caseta con permisos limitados`.

## Revisión SQL previa a aplicar · 17 de septiembre de 2026 (histórico)

Estado de aquella entrega: las ocho migraciones estaban revisadas y listas para aplicar al proyecto de ensayo; la validación remota seguía pendiente. Posteriormente el responsable confirmó su aplicación. Se conserva esta sección como registro histórico.

- Prevención PostgreSQL de periodos superpuestos para el mismo contacto y residencia. Intervalos consecutivos permitidos; canceladas, completadas o realmente vencidas no bloquean. No se compara por nombre.
- Bloqueo transaccional de residencia y versión MVCC para impedir duplicados también con snapshots antiguos. Índice parcial de búsqueda; rechazo claro de superposición.
- Doce funciones SECURITY DEFINER trasladadas a `accesshome_private`, interfaces SECURITY INVOKER, search_path vacío y EXECUTE específico. Revocación explícita de grants implícitos, incluidos service_role. Esquema privado fuera de Data API.
- Auditoría SQL ampliada: cero definers expuestos, grants mínimos, helpers/provisión restringidos y pruebas de llamadas directas privadas.
- `npm test`: **139/139**. `npm run test:concurrency`: **9/9**, PostgreSQL **17.10** temporal, tres conexiones TCP independientes y bloqueo observado con pg_blocking_pids. `npm run build`: correcto, con advertencia de tamaño del bundle ya existente.
- Carreras verificadas: altas idénticas y parcialmente superpuestas, adyacentes, rollback, REPEATABLE READ/SERIALIZABLE, cancelación y expiración durante la espera. No se atribuye concurrencia real a PGlite.
- Pendientes remotos: migraciones/auditoría en Supabase, esquemas expuestos, Auth/JWT/PostgREST y pruebas SB-01–SB-08. No se modificó `.env.local` ni se mostraron credenciales. Sin migraciones remotas, commit, push ni módulo de guardia.

Archivos de esta revisión: las ocho migraciones, `supabase/tests/security_baseline.sql`, `tests/shared-backend.test.mjs`, `tests/helpers/shared-sql-fixture.mjs`, `tests/concurrency/invitations.test.mjs`, `package.json`, `package-lock.json`, README y las guías SQL/setup/plan/status/testing. Inventario por migración, razonamiento y límites en [SQL_MIGRATION_REVIEW.md](SQL_MIGRATION_REVIEW.md).

Commit sugerido, sin realizar: `fix: impedir invitaciones superpuestas y aislar funciones privilegiadas`.

## Etapa 9 · Integración compartida implementada, activación remota pendiente (entrega anterior)

Entrega del 16 de septiembre de 2026. Se conservan rutas, formularios y diseño. No se ejecutaron migraciones remotas, no se crearon cuentas externas, no se modificó .env.local y no se hizo commit/push. El usuario preparará un proyecto exclusivo de pruebas y autorizará después la fase remota.

- SDK Supabase y autenticación email/contraseña individual, con perfil/rol obtenido desde SQL.
- Los once services y la asignación de principal seleccionan un único proveedor para todo el proceso.
- Ambas variables vacías: demo local por correo sin contraseñas. Una o ambas presentes: compartido obligatorio, sin fallback.
- dev:local permite seguir usando la demostración aislada en 5174 aunque haya configuración compartida.
- Community, household, contactos, invitaciones, visitante, accesos administrativos, historial, reportes y dashboards tienen adaptador compartido.
- Cinco migraciones nuevas sobre las tres existentes: RPCs autorizados, snapshots, tokens CSPRNG de 32 bytes, transacciones, provisión controlada y chequeo de salud.
- RLS en todas las tablas, cero escrituras genéricas de clientes y cero SELECT anónimo. Los RPCs públicos se limitan a salud y proyección por token.
- Guardia reservado y bloqueado en los RPCs operativos; no se desarrolló su módulo.
- Semilla de un condominio, cuatro casas, Casa 24/Daniel, ocho habitantes, cinco vehículos permanentes y contactos privados. Requiere UUID Auth existentes, no contiene contraseñas y rechaza bases con datos.
- Asignación de principal auditada y provisión de nuevas cuentas mediante procedimiento solo del propietario de migraciones.
- Refetch al consultar, enfocar o recuperar conexión; polling de 10 s solo en vistas que ya lo necesitaban. Dashboards agregados en servidor; sin Realtime.
- Eliminadas contraseñas demo de fuente/documentación. Una base local válida retira los campos antiguos sin borrar sus entidades. Sin importación automática hacia Supabase.

### Verificación

- 134 pruebas correctas: 114 de regresión local adaptada, 16 de SQL/RLS/operaciones compartidas y 4 del SDK/adaptadores con HTTP simulado.
- Las ocho migraciones y la auditoría de catálogo se ejecutaron en PGlite/PostgreSQL local con pgcrypto real.
- UI local: login de Daniel sin contraseña, contactos, generación de Carlos López y enlace/QR de visitante a 390 px. Sin errores de consola ni desbordamiento horizontal en el detalle medido.
- Vite/TypeScript compilados correctamente. La incorporación del SDK aumenta el bundle y Vite advierte del chunk superior a 500 kB; no impide el build.
- La pantalla de login compartida carga con la configuración del usuario, pero no se envió un login ni una consulta remota de verificación.

**No comprobado todavía:** Supabase Auth y PostgREST reales, las dos sesiones independientes en dispositivos, expiración/renovación real de JWT y carreras de transacciones en múltiples conexiones. PGlite usa una sola conexión y simula el contexto auth; no se presenta esa prueba como verificación remota.

### Cómo continuar

Seguir [SHARED_BACKEND_SETUP.md](SHARED_BACKEND_SETUP.md) para configurar Auth, aplicar SQL cuando se autorice y provisionar UUID/roles. Después ejecutar backend:check y el recorrido [SB-01–SB-08](PROTOTYPE_TESTING.md). Por ahora el trabajo se detiene antes de operaciones remotas y antes del módulo del guardia.

Archivos principales: src/services/shared/, fachadas services existentes, hooks de sesión/refetch, login/avisos de modo, supabase/migrations/20260917000*, supabase/tests/security_baseline.sql, tests/shared-*.test.mjs, scripts/check-backend.mjs, scripts/dev-local.mjs, vite.config.ts y documentación.

Commit sugerido, sin realizarlo: `feat: integrar Supabase con permisos por residencia y demo local aislada`.

## Historial de etapas anteriores

Las secciones siguientes describen entregas históricas locales. Sus referencias a autenticación simulada con contraseña o fallback aleatorio ya no describen la entrega actual.

# Estado del prototipo AccessHome

## Etapa 8 · Preparación del backend compartido (histórico)

- [x] Inspección de estructura, Auth demo, modelos, services, invitaciones/accesos, localStorage, documentación y Git (`main`, `aee05be`, limpio al comenzar).
- [x] `docs/SHARED_BACKEND_PLAN.md`: inventario, tablas/relaciones, permisos, Auth, adaptación de servicios, datos demo/importación, pruebas y limitaciones.
- [x] Tres migraciones SQL versionadas y aditivas: comunidad, visitas/reportes y políticas de lectura. Diez tablas de dominio, tokens privados, FK, índices y tres roles.
- [x] RLS y privilegios explícitos, sin lectura anónima de tablas ni escritura directa de clientes. Funciones auxiliares privadas; RPC público/operativo pendiente.
- [x] Guardia preparado como rol de backend. Accesos de servicios y reportes de guardia documentados como entidades compartidas futuras; contratos/tablas pendientes de su alcance.
- [x] `.env.example` con URL/clave publishable vacías, sin valores inventados ni secretos de servidor.
- [x] Guía de reproducción SQL y auditoría de catálogo preparada; configuración manual antes del Prompt 9 documentada.
- [x] Aplicación local, datos, servicios y rutas conservados. Sin dependencias nuevas, migraciones remotas, importación, reset, commit ni push.
- [x] `npm run build` correcto; las 115 pruebas locales pasan. Revisión de cambios sin errores de whitespace; `.env.local` y metadatos temporales de la CLI ignorados por Git.
- [ ] Ejecutar las migraciones y pruebas RLS/Auth en un proyecto Supabase de ensayo configurado. No hay credenciales/proyecto vinculado ni motor SQL disponible; la auditoría SQL todavía no se ha ejecutado.
- [ ] Implementar adaptadores, Auth real, RPCs transaccionales y pruebas entre dispositivos en las siguientes etapas. El prototipo aún no comparte datos.

Archivos de esta preparación: `.env.example`, `.gitignore`, `docs/SHARED_BACKEND_PLAN.md`, `supabase/README.md`, las tres migraciones de `supabase/migrations/`, `supabase/tests/security_baseline.sql`, README, STATUS, TESTING y contratos de servicios. No se modificó código funcional de `src/`.

## Etapa 7 · Historial, reportes y dashboards (conservada)

- [x] Historial administrativo del condominio y consulta residente limitada a su casa/invitaciones.
- [x] Visitante, casa, anfitrión, placas, entrada/salida, fecha/hora, método y autorización; búsqueda y filtros combinables por casa, movimiento y días locales.
- [x] Tabla de escritorio y filas con etiquetas en móvil, sin desplazamiento horizontal excesivo.
- [x] Principal crea reportes con título, categoría y descripción; autor/casa y estado Pendiente establecidos desde la sesión.
- [x] Consulta de reportes limitada al autor; administrador consulta y avanza Pendiente → En proceso → Completado dentro de su condominio.
- [x] Dashboard administrador con seis indicadores reales y cinco movimientos recientes.
- [x] Dashboard residente con indicadores de su casa, reportes propios y cinco acciones rápidas; Nueva invitación prioritaria en móvil.
- [x] Mi residencia conserva toda su gestión en `/residente/mi-residencia`; accesos rápidos abren el formulario de habitante o vehículo.
- [x] Esquema 7 y migración v6 que conserva sesión, comunidad, agenda, tokens, usos e historial; reportes iniciales vacíos y reset actualizado.
- [x] Validación de permisos en servicios, fallos de escritura y regresión: 115 pruebas correctas.
- [x] Build y documentación acumulativa. Sin nuevas dependencias, reset de datos, commit ni push.

Verificación de navegador: creación y procesamiento completo de **Lámpara de acceso apagada · Prueba**; entrada/salida de **Visita historial · Prueba**; filtros combinados y persistencia; indicadores actualizados, accesos rápidos y vistas de 375 y 1366 px. Los datos de prueba quedaron guardados. La guía de pruebas detalla el recorrido y distingue verificaciones automatizadas y de navegador.

Archivos principales modificados/creados:

- Servicios: `accessHistoryService.ts`, `accessHistoryRules.ts`, `reportsService.ts`, `reportRules.ts`, `reportValidation.ts`, `dashboardService.ts`, `demoMigration.ts`, `demoValidation.ts` y `src/services/README.md`.
- Modelos/semilla: `src/types/reports.ts`, `access.ts`, `demo.ts` y `src/data/demo.ts`.
- Páginas: `AccessHistoryPage.tsx`, `ReportsPage.tsx`, `NewReportPage.tsx`, `ReportPage.tsx`, `ResidentDashboardPage.tsx`, `CondominiumPage.tsx` y `ResidencePage.tsx`.
- Componentes/integración: `AccessHistory.tsx`, `RecentAccess.tsx`, `ReportStatusLabel.tsx`, `ResidenceContent.tsx`, router, navegación, layout público, `dashboard.css` y estilos globales.
- Pruebas: `tests/dashboard-history.test.mjs`, `tests/reports.test.mjs` y expectativas de versión en cinco archivos de regresión. README y ambas guías actualizados.

Commit sugerido: `feat: agregar historial de accesos, reportes y dashboards con datos reales`.

## Corrección conservada · Compatibilidad de IDs

- [x] `generateId()` compartido por las 12 altas/generaciones que dependían directamente de `crypto.randomUUID()`.
- [x] Prioridad: UUID nativo, UUID v4 con `getRandomValues`, timestamp + contador + aleatorio como último recurso del prototipo.
- [x] Disponibilidad comprobada con `typeof`; contempla objeto Crypto ausente y métodos no invocables.
- [x] Revisión adicional: seis llamadas a `structuredClone` en semilla/migraciones sustituidas por `cloneJsonData`, con alternativa JSON.
- [x] Reglas de entidades, permisos, vigencias, snapshots y usos conservadas; no se cambian IDs/tokens guardados ni esquema.
- [x] 99 pruebas correctas: las 90 anteriores y nueve de compatibilidad. Incluyen todas las altas, invitación, vista pública y entrada/salida sin UUID nativo y sin Crypto.
- [x] Build correcto; documentación de repetición de la prueba actualizada. Sin dependencias nuevas, restauración de datos, commit ni push.

Se revisaron llamadas directas de APIs del navegador y utilidades modernas en `src/`. Además de Crypto, se corrigió la dependencia no protegida de `structuredClone`. No se encontró uso de `showModal`, portapapeles, cámara, `toSorted`, `toReversed` ni `replaceAll` que requiriera otro ajuste en este alcance. La ausencia de APIs se simula en pruebas aisladas de Node; no se afirma haber probado todas las versiones de navegadores móviles.

Archivos de esta corrección: `src/utils/id.ts`, `src/utils/clone.ts`; `src/services/invitationsService.ts`, `accessService.ts`, `communityService.ts`, `contactsService.ts`, `householdService.ts`, `principalService.ts`, `demoMigration.ts`; `src/data/demo.ts`; `tests/compatibility.test.mjs`; README, ambas guías y documentación de servicios/utilidades.

Commit sugerido: `fix: generar identificadores compatibles sin crypto.randomUUID`.

## Etapa 6 · QR, visitante y control de acceso (conservada)

- [x] QR local en el detalle y vista pública; representa la URL absoluta `/invitacion/{token}` del origen actual.
- [x] Ruta pública sin sesión, con visitante, casa, anfitrión, vigencia, vehículo, placas, estado y QR de 288 px adaptable.
- [x] Proyección pública explícita: sin teléfonos, correos, habitantes, notas ni identificadores internos.
- [x] Visitante puede añadir un vehículo una sola vez a una invitación sin vehículo y antes del primer uso; placas obligatorias, demás datos opcionales.
- [x] Vehículo guardado exclusivamente en la invitación; contactos y vehículos permanentes permanecen separados.
- [x] Control administrativo con selección de invitación activa o token manual y validación explícita.
- [x] Servicio valida rol/condominio, existencia, estado, periodo, residencia activa y usos; no confía en la imagen QR.
- [x] Primera validación registra Entrada; segunda, Salida y Completada; tercera rechazada sin nuevos registros.
- [x] Resultados de autorización en verde y rechazo en rojo con motivo legible.
- [x] Historial administrativo con snapshots de visita, anfitrión, residencia, vehículo, método QR y fecha/hora.
- [x] Uso y registro persistidos en una sola escritura; fallo de almacenamiento no autoriza ni consume usos.
- [x] Esquema 6: migración desde v5 conserva datos, sesión, tokens y usos; añade historial vacío. Restauración incluye movimientos.
- [x] Única dependencia nueva: `qrcode.react` 4.2.0; sin servicios externos, cámara ni hardware.
- [x] 90 pruebas automatizadas correctas: 21 nuevas y 69 de regresión.
- [x] Documentación acumulativa y verificación de navegador, móvil y build.

### Verificación y datos conservados

Recorrido completo con **Visita QR demostración**, invitada por Daniel a Casa 24: consulta pública sin sesión, incorporación de solo placas **QR-9001**, recarga, entrada, salida y tercer rechazo. Quedó Completada con exactamente dos movimientos. También se verificaron tokens inexistentes, cancelados, expirados y de inicio futuro, además de un enlace público inválido. No se restauraron ni borraron datos anteriores ni se consumieron usos de otras invitaciones.

Build final correcto (`tsc --noEmit` y Vite); 90 pruebas de servicios correctas. Revisión a 375, 768 y 1366 px sin desbordamiento en las vistas medidas; consola final sin errores ni advertencias. Servidor de desarrollo disponible en http://127.0.0.1:5173. Sin commit ni push.

El QR y los enlaces funcionan con los datos del mismo navegador, perfil y origen. localStorage no sincroniza otro teléfono ni otro navegador. Para presentar el flujo público, cerrar sesión y abrir el enlace en ese mismo origen, o usar otra pestaña y emulación móvil. No se realizó escaneo con una cámara física.

Archivos principales:

- Servicios: `src/services/publicInvitationService.ts`, `accessService.ts`, `accessRules.ts`, `accessValidation.ts`, migración/validación de datos y contratos de servicios.
- Modelos/semilla: `src/types/access.ts`, `invitations.ts`, `demo.ts`, `src/data/demo.ts`.
- Interfaz: `src/pages/PublicInvitationPage.tsx`, `AccessControlPage.tsx`, `InvitationPage.tsx`, `src/components/access/`, `src/components/invitations/InvitationQr.tsx`, `VisitorVehicleForm.tsx`.
- Integración: `src/router.tsx`, `src/data/navigation.ts`, `src/layouts/PublicLayout.tsx`, `src/utils/invitationLinks.ts`, estilos de acceso/invitaciones/globales y archivos de dependencias.
- Pruebas/documentación: `tests/access.test.mjs`, `tests/public-invitation.test.mjs`, expectativas de migración existentes, README y ambas guías.

Commit sugerido: `feat: agregar QR, vista pública y control de acceso simulado`.

## Etapa 5 · Invitaciones (conservada)

Registro histórico: el espacio pendiente de QR, enlace público y consumo de usos de esta etapa fue sustituido por la implementación funcional de la etapa 6.

- [x] Dos flujos: contacto frecuente con vehículo guardado/ninguno/otro y visitante ocasional.
- [x] Guardado opcional como contacto desmarcado, sin exigir cuenta ni datos extra.
- [x] Hoy, 24 horas y rango personalizado, con validación de fechas y captura en hora local.
- [x] Destino e invitador definidos desde sesión; token único y usos iniciales 0 de 2.
- [x] Snapshot de visitante, teléfono y vehículo; historial conservado tras editar/eliminar contactos.
- [x] Listado compacto, búsqueda, filtros de cuatro estados, detalle y cancelación confirmada de activas.
- [x] Datos principales inmutables; espacio informativo para QR sin implementarlo.
- [x] Servicios validan residencia, principal, estado y pertenencia del contacto/vehículo.
- [x] Consulta de la propia casa para cuentas adicionales; gestión exclusiva del principal activo.
- [x] Esquema 5: migración desde v4 conserva todos sus datos y añade invitaciones vacías. Reset actualizado.
- [x] 69 pruebas automatizadas correctas; build de TypeScript/Vite correcto.
- [x] Documentación acumulativa con los ocho recorridos solicitados y casos adicionales.

El estado Completada ya se reconoce al alcanzar los usos máximos; aún no hay interfaz para consumirlos. El QR, enlace público y simulador de accesos siguen pendientes. No se instalaron dependencias ni se realizaron commits/push.

Navegador: probados contacto con vehículo activo, contacto sin vehículo, otro vehículo, ocasional, guardado opcional, fechas personalizadas, cancelación, búsqueda/filtro y persistencia. Snapshot conservado tras cambiar nombre y vehículo del contacto de prueba; acceso ajeno rechazado y cuenta adicional en consulta. Se corrigió y verificó la captura inmediata de fecha/hora. Se conservaron datos anteriores y registros de prueba; detalle en la guía acumulativa.

Expiración automática observada sin recargar, con cancelación bloqueada y filtro correcto. Revisión responsive a 375, 768 y 1366 px sin desbordamientos; consola sin errores/advertencias. Build final correcto. Servidor de desarrollo disponible en http://127.0.0.1:5173.

Archivos principales: `src/types/invitations.ts`, `src/services/invitationsService.ts`, `invitationRules.ts`, `invitationSnapshot.ts`, `invitationValidation.ts`, migración/validación/semilla, `src/components/invitations/`, `src/pages/InvitationsPage.tsx`, `NewInvitationPage.tsx`, `InvitationPage.tsx`, router/navegación, `src/styles/invitations.css`, `src/utils/dates.ts`, `tests/invitations.test.mjs` y documentación.

Commit sugerido: `feat: implementar invitaciones con snapshots y permisos por residencia`.

## Ajuste conservado · Eliminación de contactos y vehículos

- [x] Eliminar un contacto propio y sus vehículos asociados.
- [x] Eliminar un vehículo de un contacto sin eliminar el contacto ni sus otros vehículos.
- [x] Eliminar un vehículo permanente de la propia casa sin afectar habitantes, casa ni agenda.
- [x] Confirmación explícita con descripción del registro, Cancelar y errores de guardado visibles.
- [x] Permisos revalidados en servicios: propietario/principal, pertenencia y residencia activa.
- [x] Cambios persistentes; resumen y listados se actualizan mediante las notificaciones existentes.
- [x] 51 pruebas automatizadas correctas, build correcto y revisión de confirmaciones/cancelación a 375 px.
- [x] README y guía acumulativa actualizados. Sin cambios de esquema, dependencias, commit ni push.

El borrado es definitivo. Continúa la desactivación reversible como alternativa. No se añadió eliminación de casas ni habitantes. Las confirmaciones se revisaron en el navegador sin borrar registros guardados; las eliminaciones se ejecutaron en pruebas automatizadas con almacenamiento aislado.

Archivos principales: `src/components/DeleteAction.tsx`, `src/services/contactsService.ts`, `src/services/householdService.ts`, `src/components/contacts/ContactDetail.tsx`, `src/components/community/HouseholdDetail.tsx`, `ResidenceContent.tsx`, `src/pages/ContactsPage.tsx`, estilos de comunidad/contactos y `tests/deletion.test.mjs`.

Commit sugerido: `feat: permitir eliminar contactos y vehículos propios`.

## Etapa 4 · Contactos frecuentes (conservada)

El botón Invitar descrito en el registro de esta etapa fue sustituido por el flujo funcional de la etapa 5.

- [x] Agenda privada vinculada al residente propietario, independiente de la residencia y de sus habitantes.
- [x] Solo el principal consulta o modifica su agenda; validación en cada operación del servicio.
- [x] Cambio de principal no transfiere contactos; administrador y cuentas adicionales sin acceso.
- [x] Nombre obligatorio, teléfono/correo/notas opcionales y estado activo/inactivo.
- [x] Cero, uno o varios vehículos por contacto; placas obligatorias y resto de datos opcionales.
- [x] Vehículos de contactos separados de los vehículos permanentes, sin alterar los contadores de comunidad.
- [x] Listado compacto, búsqueda por nombre/teléfono/correo/placas, detalle, creación y edición.
- [x] Desactivación y reactivación de contactos/vehículos conservando sus datos.
- [x] Formularios en una columna, botones de al menos 48 px y navegación responsive.
- [x] Invitar visible, con ruta preparada que informa que no se ha generado autorización.
- [x] Datos demo de Carlos López, María González y Pedro Ramírez para Daniel.
- [x] Esquema 4 y migración de versiones 1/2/3 sin reinicio de comunidad ni sesión.
- [x] Restauración de datos incluye contactos y vehículos de contactos.
- [x] README y guía acumulativa con los ocho casos manuales solicitados.
- [x] `npm run build` correcto; `npm test` con 45 pruebas correctas, incluidas las 32 de etapas anteriores.
- [x] Verificación de navegador: alta, edición, varios vehículos, desactivación/reactivación, búsqueda, persistencia, privacidad y ruta Invitar.

### Verificación y datos conservados

Se creó para Daniel el contacto Laura Sánchez Ruiz, teléfono ficticio 3312345099, nota “Visita habitual de demostración”. Tiene LRS-9001 (Mazda 3 azul, inactivo) y LRS-9002 (Honda Civic, activo); contacto activo. Se comprobó que esos vehículos no aparecen en el registro permanente de Casa 24. La cuenta de Ana no puede abrir este contacto y la cuenta adicional de Mariana no accede a la agenda.

Interfaz revisada a 375 × 812, 768 × 1024 y 1366 × 1000, sin desbordamiento horizontal en las vistas medidas. El servidor Vite se reinició para resolver una caché de importación de la nueva hoja CSS y funciona en http://127.0.0.1:5173. Se conservaron los datos y asignaciones de etapas anteriores.

Archivos principales: `src/types/contacts.ts`, `src/data/contacts.ts`, `src/services/contactsService.ts`, `contactRules.ts`, `contactValidation.ts`, `demoMigration.ts`, `demoValidation.ts`, `src/components/contacts/`, `src/components/PrincipalRoute.tsx`, `src/pages/ContactsPage.tsx`, `ContactPage.tsx`, navegación/layouts, `src/router.tsx`, `src/styles/contacts.css` y `tests/contacts.test.mjs`.

No se añadieron dependencias ni se implementó la creación de invitaciones. No se realizó commit ni push.

Mensaje de commit sugerido: `feat: agregar agenda privada de contactos frecuentes`.

## Etapa 3 · Corrección de responsabilidades (conservada)

Esta sección sustituye el modelo de permisos de la implementación inicial. Las secciones históricas se conservan como registro de entregas, no como requisitos actuales.

- [x] Residencia con estado activo/inactivo y referencia explícita al residente principal.
- [x] Administrador: crear y editar estructura/estado, asignar o cambiar principal y consultar habitantes/vehículos.
- [x] Habitantes separados de cuentas de acceso: nombre, apellido, teléfono/correo/relación opcionales y estado.
- [x] Daniel principal de Casa 24; Mariana conservada y Andrea/Carlos como habitantes sin cuenta.
- [x] Principal: alta, detalle, edición, desactivación y reactivación de habitantes y vehículos propios.
- [x] Vehículos vinculados a la casa y propietario opcional entre sus habitantes.
- [x] Administrador sin mutaciones cotidianas de habitantes/vehículos, también en servicios.
- [x] Residente sin acceso a estructura, asignación o registros de otras casas, también en servicios.
- [x] Cambio de principal revoca permisos anteriores; una cuenta adicional queda en consulta.
- [x] Casa inactiva bloquea la gestión cotidiana y permite consulta; principal actual protegido contra desactivación.
- [x] Migración de esquemas 1/2 a 3 sin reiniciar datos; restauración actualizada.
- [x] Autenticación, roles, persistencia, navegación y diseño azul/amarillo conservados.
- [x] README y guía acumulativa con los nueve recorridos solicitados y prueba directa de permisos.
- [x] 32 pruebas automatizadas correctas y build de TypeScript/Vite correcto.
- [x] Recorridos de navegador: asignación, habitantes, vehículos, estados, persistencia y bloqueo por rol; revisión a 375, 768 y 1366 px.

### Datos conservados de la verificación

- Casa 90, Circuito Cedros, principal Sofía Ramos; `sofia90@accesshome.demo` / `[contraseña histórica retirada]`.
- Casa 24 mantiene a Daniel como principal. Se agregó Lucía Cuevas Pérez, teléfono ficticio `55 5550 2490`, sin cuenta; se verificó desactivación/reactivación y quedó activa.
- Vehículo de prueba `DEMO-224`, Mazda 3 azul oscuro, propietaria Lucía, inactivo.
- Se conservaron Casa 25, Casa 88 y los registros anteriores del navegador. La semilla restaurada sigue teniendo cuatro casas, ocho habitantes y cinco vehículos.

### Archivos principales de esta corrección

- Modelos/semilla: `src/types/demo.ts`, `src/types/community.ts`, `src/data/demo.ts`, `src/utils/people.ts`.
- Servicios: `communityService.ts`, `communityRules.ts`, `householdService.ts`, `principalService.ts`, autenticación, validación, migración y almacenamiento en `src/services/`.
- Interfaz: `src/components/community/`, `src/pages/ResidencePage.tsx`, `ResidencesPage.tsx`, `CondominiumPage.tsx`, `src/router.tsx`, `src/styles/community.css`.
- Pruebas/documentación: `tests/community.test.mjs`, `tests/migration.test.mjs`, `package.json`, README y ambas guías.

No se añadieron dependencias ni se avanzó a contactos frecuentes. No se realizó commit ni push.

Mensaje de commit sugerido: `fix: separar permisos de administrador y residente principal`.

## Etapa 3 · Implementación inicial (histórico)

- [x] Semilla de Residencial Los Robles: casas 12, 24, 37 y 51, seis residentes y cinco vehículos coherentes.
- [x] Daniel Cuevas asociado a Casa 24 junto con Mariana Torres.
- [x] Varios residentes/vehículos por casa; propietario principal opcional y estado activo/inactivo.
- [x] Resumen de condominio con cantidades reales y edición de nombre/dirección.
- [x] Listado y búsqueda de residencias por número, con estados vacíos.
- [x] Detalle de residencia con residentes y vehículos.
- [x] Alta y edición básica de casas, residentes y vehículos.
- [x] Consulta del residente limitada a su propia casa, sin controles de modificación.
- [x] Validaciones de duplicados, campos, propietarios y permisos en servicios.
- [x] Persistencia local y migración del esquema anterior sin reiniciar los datos.
- [x] Tablas de escritorio adaptadas a listas compactas en móvil/tablet.
- [x] 25 pruebas automatizadas correctas; build y pruebas de navegador.
- [x] Documentación de alta de casa, residente y vehículo.

No se implementaron invitaciones ni funciones de etapas posteriores.

### Verificación y archivos de la etapa 3

- 25 pruebas automatizadas correctas, incluidas las 11 de autenticación y 14 de comunidad/migración.
- En navegador: creación de Casa 88, alta de Laura Méndez, registro de DEMO-088 con propietaria, recarga y edición de casa/residente/vehículo. Se conservó el ejemplo de prueba (Laura Méndez Ruiz, Circuito Cedros Norte, vehículo azul oscuro e inactivo).
- Login de la nueva residente comprobado: solo ve Casa 88. Daniel sigue viendo Casa 24 y la navegación administrativa está bloqueada.
- Resumen, búsqueda, formulario de condominio, rechazo de número de casa duplicado y vistas a 375, 768 y 1366 px comprobados.
- Migración conserva sesión, Casa 25 y modificaciones anteriores; una restauración recupera la nueva semilla exacta.
- No se instalaron dependencias, no se borraron archivos y no se realizaron commits o push.

Archivos principales: `src/types/demo.ts`, `src/types/community.ts`, `src/data/demo.ts`, `src/services/communityService.ts`, `src/services/communityRules.ts`, `src/services/demoMigration.ts`, validación/persistencia, `src/hooks/useCommunityQuery.ts`, `src/pages/CondominiumPage.tsx`, `ResidencesPage.tsx`, `ResidencePage.tsx`, `src/components/community/`, router/navegación y `src/styles/community.css`. Pruebas en `tests/community.test.mjs`; documentación en README y las dos guías del prototipo.

Mensaje de commit sugerido (sin ejecutarlo): `feat: gestionar condominio, residencias, residentes y vehículos`.

## Etapa 2 · Autenticación simulada (histórico)

- [x] Login por correo y contraseña con errores legibles.
- [x] Administrador Demo y Daniel Cuevas con los correos y contraseña solicitados.
- [x] Semilla centralizada: condominio, dos residencias y dos vehículos de Casa 24.
- [x] Sesión persistente y logout desde el menú de ambos perfiles.
- [x] Protección de rutas, incluidas subrutas y 404 internas.
- [x] Redirección por rol con aviso al intentar entrar al área de otro perfil.
- [x] Credenciales de ayuda y restauración completa desde el login con confirmación.
- [x] localStorage encapsulado en servicios, sin lógica de credenciales en componentes.
- [x] Gestión de datos corruptos y fallos de almacenamiento.
- [x] Sincronización de sesión entre pestañas del mismo origen.
- [x] 11 pruebas automatizadas de servicios y build correcto.
- [x] Los seis recorridos solicitados comprobados en navegador.

## Etapa 1 · Infraestructura del frontend (histórico)

La entrega vigente es la etapa 6. Los resultados siguientes conservan el historial de la infraestructura inicial.

- [x] React, Vite y TypeScript con comprobación estricta.
- [x] Router principal con redirección inicial.
- [x] Layout público.
- [x] Layout de administrador.
- [x] Layout de residente.
- [x] Acceso temporal mediante selección de perfil, sustituido por login en la etapa 2.
- [x] Página 404 global y dentro de cada perfil.
- [x] Navegación lateral en escritorio y desplegable en móvil.
- [x] Identidad azul con acentos amarillos, estilos globales y accesibilidad básica.
- [x] Carpetas modulares, incluido el límite de servicios.
- [x] README y guía acumulativa de pruebas.
- [x] Verificación final de build y servidor de desarrollo.
- [x] Verificación de navegación en navegador.

## Fases previstas

El objetivo general actualizado define las funciones finales. Esta división organiza su implementación; se debe detener el trabajo al terminar cada etapa y esperar la indicación de continuar. Las fases 1 a 7 están implementadas en local. La etapa 8 prepara la integración compartida; la presentación final se conserva como trabajo posterior.

- [x] **Fase 1 — Infraestructura:** implementación y verificación completadas.
- [x] **Fase 2 — Datos, servicios y perfiles:** modelos tipados, datos demo, sesión simulada por rol y localStorage encapsulado en servicios sustituibles por API.
  - [x] Relaciones tipadas entre condominio, usuarios, residencias y vehículos; semilla inicial del prototipo.
  - [x] Casa 24 como residencia del recorrido de presentación.
- [x] **Fase 3 — Comunidad y permisos:** el administrador gestiona estructura, estado y principal de cada casa; el principal administra habitantes y vehículos propios. Consulta administrativa y restricciones en servicios verificadas.
- [x] **Fase 4 — Contactos frecuentes:** agenda privada del principal, alta, búsqueda, detalle, edición y desactivación/reactivación de contactos y sus vehículos.
  - [x] Nombre obligatorio, teléfono/correo/notas opcionales y varios vehículos con placas obligatorias y marca/modelo/color opcionales.
  - [x] Un contacto guardado no concede autorización permanente de entrada; Invitar abre el formulario de visita.
- [x] **Fase 5 — Invitaciones:** creación desde contacto o para visitante ocasional sin guardar contacto.
  - [x] Visitante ocasional: nombre, vehículo sí/no y placas cuando corresponda; demás datos opcionales.
  - [x] Residente, residencia destino, copia de visitante/vehículo, vigencia, usos, estado y token único simulado.
  - [x] Editar o eliminar un contacto no modifica invitaciones históricas.
  - [x] Consulta, búsqueda, estados, cancelación y confirmación responsive.
- [x] **Fase 5B — QR y visitante:** QR y enlace público con destino, vigencia, vehículo y estado; visitante sin cuenta ni instalación, con vehículo opcional posterior.
- [x] **Fase 6 — Accesos:** simulador del administrador que valida QR/token, registra entrada, registra salida y completa la invitación según sus usos.
  - [x] Historial administrativo con validaciones de vigencia, estado, condominio y usos.
  - [x] Consulta detallada de movimientos desde el residente, búsqueda y filtros responsive.
- [x] **Fase 7 — Reportes y dashboards:** principal crea y consulta sus reportes; administrador los consulta y cambia su estado. Indicadores y actividad reciente con datos reales y permisos por residencia.
- [x] **Fase 8 — Preparación del backend compartido:** inspección, plan, SQL versionado, RLS base y configuración manual; aplicación local conservada.
- [ ] **Prompt 9 y siguientes — Integración:** Supabase Auth, cuentas y perfiles, adaptadores por módulo, RPCs, visitante público, concurrencia y pruebas entre dispositivos; contratos de servicio/guardia cuando se soliciten.
- [ ] **Presentación final:** recorrido completo, regresión, pruebas a 375–430 px, 768 px y 1280 px o más; adaptación de formularios/tablas/listas y revisión de accesibilidad.
  - [ ] Crear `docs/PRESENTATION_DEMO.md` con datos y guion reproducible del recorrido final.

La integración con Supabase será para el prototipo compartido. Una versión de producción o sustitución por API Django conserva su alcance posterior.

## Límites actuales

- Las rutas están protegidas en el frontend; es una simulación que no ofrece seguridad frente a la manipulación del navegador o del código.
- La sesión y los datos demo se guardan en `accesshome.demo.v1`; no hay backend ni cuentas reales.
- Las contraseñas demo están en la semilla local. No se devuelven en los objetos de sesión.
- Invitaciones, QR/enlace público, control administrativo, historial por rol, reportes y dashboards implementados. La preparación final de presentación sigue pendiente.
- El QR contiene una URL con token; no lleva los datos ni los sincroniza entre dispositivos. Otro navegador/perfil/origen no tendrá la invitación. No hay lector de cámara ni hardware de acceso.
- El simulador representa un puesto local. Una API futura deberá validar permisos y aplicar transacciones para varios puestos simultáneos; localStorage no ofrece seguridad ni transacciones entre dispositivos.
- Contactos y vehículos admiten eliminación definitiva o desactivación reversible. Los habitantes solo se desactivan. No hay traslado entre casas ni cambio de contraseñas. Las cuentas adicionales consultan su casa; solo el principal de una casa activa puede gestionarla.
- La migración conserva Casa 25 y otros registros anteriores; restaurar recupera exactamente las cuatro casas de la nueva semilla.
- La sesión no tiene vencimiento automático y se comparte entre pestañas del mismo origen.
- La secuencia de fases futuras puede ajustarse sin omitir los requisitos del objetivo final.

## Verificación de entrega · Etapa 1 · 14 de septiembre de 2026

- `npm install`: instalación correcta, auditoría de npm sin vulnerabilidades reportadas.
- `npm run build`: TypeScript y Vite completados; salida en `dist/`.
- `npm run dev`: servidor disponible en http://127.0.0.1:5173.
- `npm run preview`: build comprobado en http://127.0.0.1:4173.
- Navegación entre perfiles, recarga, historial y páginas 404 comprobados en navegador.
- Revisión visual en escritorio (1366 × 900) y móvil (390 × 844 y 320 × 740).
- Corregido el desbordamiento horizontal a 320 px y verificado el foco de teclado.
- Sin errores ni advertencias en la consola del navegador durante el recorrido.
- No se realizaron commits ni push.

## Archivos principales de la etapa 1

Ajuste al objetivo actualizado: paleta azul/amarilla y checklist del alcance final. Build correcto; revisión adicional en tablet a 768 px y móvil a 375/430 px. Este ajuste conserva el alcance de infraestructura y no inicia una nueva fase funcional.

Archivos de este ajuste: `src/styles/global.css`, `index.html`, `README.md`, `docs/PROTOTYPE_STATUS.md` y `docs/PROTOTYPE_TESTING.md`.

Mensaje de commit sugerido (sin ejecutarlo): `feat: crear infraestructura frontend de AccessHome`.

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`.
- `src/main.tsx`, `src/router.tsx`.
- `src/layouts/`, `src/pages/`, `src/components/`.
- `src/data/navigation.ts`, `src/types/navigation.ts`, `src/hooks/usePageTitle.ts`.
- `src/styles/`, `src/services/README.md`, `src/utils/README.md`.
- `README.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`.

## Verificación y archivos principales de la etapa 2

- Los seis casos pedidos se comprobaron en navegador: error de login, administrador, logout, residente, bloqueo de administración y recarga con sesión.
- Comprobados logout entre pestañas, Atrás después de logout, 404 pública/residente y restricción de una subruta de administrador.
- Revisados login y menú a 375 px, perfil a 768 px y escritorio a 1366 px. Sin desbordamiento en las vistas revisadas ni errores/advertencias de consola.
- Restauración confirmada desde el login; los tests verifican el reemplazo completo y la conservación de datos de otras aplicaciones.
- `npm test`: 11 pruebas correctas. `npm run build`: correcto. Servidor Vite existente comprobado en `http://127.0.0.1:5173`.
- No se instalaron dependencias ni se realizaron commits o push.

Archivos principales:

- `src/data/demo.ts`, `src/types/auth.ts`, `src/types/demo.ts`: cuentas y datos iniciales tipados.
- `src/services/authService.ts`, `demoService.ts`, `demoStorage.ts`, `demoValidation.ts`: autenticación, restauración y persistencia.
- `src/hooks/useAuth.tsx`, `src/components/ProtectedRoute.tsx`, `src/router.tsx`, `src/main.tsx`: estado de sesión y rutas protegidas.
- `src/pages/LoginPage.tsx`, `src/pages/WorkspacePage.tsx`, `src/layouts/WorkspaceLayout.tsx`, `src/components/DemoTools.tsx`: login, perfil, logout y restauración.
- `src/styles/auth.css`, estilos existentes, marca y layout público: integración visual.
- `tests/auth.test.mjs`, `tests/tsconfig.json`, `package.json`, `.gitignore`: ejecución de pruebas sin nuevas dependencias.
- `README.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`: documentación actualizada.

Mensaje de commit sugerido (sin ejecutarlo): `feat: agregar autenticación simulada y sesión persistente`.


