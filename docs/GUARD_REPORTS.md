# Reportes de caseta y cierre de turno · Prompt 14

## Mejora vigente · Prompt 14.5: detalle y CSV tabular

El resumen y sus métricas se conservan primero, seguidos de observaciones/incidencias, **Detalle del turno** y Exportar CSV. No se hizo el rediseño del Prompt 15. El detalle nuevo está probado localmente; requiere aplicar por el responsable la incremental `20261007000200_guard_report_log.sql` después de la 14. No se modificó ninguna migración anterior ni se ejecutó SQL remoto.

### Proyección autorizada y auditoría

Se eligió reutilizar referencias a fuentes existentes, sin crear tablas ni copiar personas/vehículos. `access_records` contiene snapshots de identidad, casa, vehículo, método y operador. `service_events` conserva decisiones/movimientos con autor y motivo; los datos capturados en `service_visits` no se editan mediante RPC (solo cambia su estado). La proyección usa el resultado del **evento**, nunca el estado vivo del servicio.

La incremental conserva el cálculo original como helper privado `shift_snapshot_v1` y amplía `shift_snapshot` con referencias auxiliares privadas de contexto y cancelaciones. Los totales no cambian. Una sola instantánea SQL captura las referencias de eventos y su contexto de llegada/entrada/salida. Así, un evento posterior o una transacción que confirme después no aparece retrospectivamente. No se reescriben reportes históricos ni se crean salidas al cerrar.

`accesshome.guard_report_log(report_id, kind, page, newest_first)` es un wrapper invoker de una implementación privada con autorización SQL. El guardia activo lee únicamente sus reportes; el admin activo los de su condominio. Condominio y pertenencia se derivan del perfil, no de parámetros. Solo acepta ID de reporte, tipo all/visitor/service, página y orden. Devuelve **50 filas por página**, total, hasMore, zona y aviso legacy. No concede SELECT directo a guard_shift_reports ni a helpers; conserva RLS y el esquema privado fuera de Data API.

La salida es un DTO explícito sin tokens, teléfonos, correos, IDs de usuarios/eventos, source_ids, request_id o command_input. Incluye fecha/hora del evento, tipo/movimiento, nombre, empresa/categoría si aplica, casa, vehículo/placas, método, resultado, horas relacionadas verificadas, operador y observación/motivo operativo. Si el snapshot antiguo no tiene nombre del operador, se indica no registrado; no se sustituye por el nombre actual del perfil.

Por defecto se muestra todo, del más antiguo al más reciente; filtros Visitantes/Servicios y orden inverso no cambian el resumen. Una fila representa un evento, incluidos llegada, rechazo y cancelación de servicios (ninguno es entrada). Horas relacionadas describen la situación **al generar el cierre**, no necesariamente la situación al ocurrir esa fila. Ejemplo: la fila de entrada de un visitante que salió antes del cierre puede mostrar ambas horas.

Las entradas pendientes al cierre que ocurrieron fuera del periodo también aparecen, rotuladas **Pendiente fuera del periodo**, sin duplicar las que ya pertenecen al turno. No deben contarse como entradas del periodo al sumar el CSV. La marca **Pendiente de salida al generar el reporte** corresponde al snapshot, incluso después de una salida posterior. Las horas inexistentes quedan vacías; no se calculan ni se inventan.

**Reportes previos a esta incremental:** se conservan sin backfill y muestran solo lo verificable en sus referencias guardadas. Pueden faltar horas de entrada/salida fuera del periodo y cancelaciones, porque antes no se guardaban esas referencias. La UI avisa esta limitación. No se reconstruyen con estados actuales ni se declara una salida inexistente. Para detalle completo utilizar cierres generados tras la incremental. Las fuentes deben conservarse: las cuentas cliente no pueden editarlas/borrarlas; cambios manuales del propietario SQL podrían afectar una proyección basada en referencias.

### CSV detallado

Una sola tabla, UTF-8 con BOM, comas como separador y CRLF. Todas las celdas van entre comillas, se duplican las comillas internas y se preservan saltos/acentos; los prefijos de fórmulas se neutralizan. No hay JSON, métricas intercaladas, IDs ni encabezados narrativos. El resumen sigue disponible en la interfaz.

Columnas, en orden: **Fecha, Hora, Tipo, Movimiento, Nombre, Empresa, Categoría, Residencia, Vehículo, Placas, Método, Resultado, Hora llegada, Hora entrada, Hora salida, Guardia, Observaciones, Pendiente de salida, Ámbito, Zona horaria**. Las tres horas relacionadas incluyen fecha `YYYY-MM-DD HH:mm:ss` para turnos que cruzan medianoche. Todo usa la zona guardada del condominio, no la del equipo. Resultado es el del evento; Pendiente de salida indica su condición al cierre. Campos no aplicables quedan vacíos.

Nombre: `accesshome-reporte-caseta-YYYY-MM-DD.csv`, según fecha local de inicio. Exporta todos los tipos y páginas en orden antiguo→reciente, independientemente del filtro visual. Se descarga solo después de completar y verificar el número de filas. Límite explícito de **10 000 filas**; errores, desconexión o exceso no generan CSV parcial. Al salir de la pantalla se cancela la exportación restante. Sin dependencias nuevas.

### Aplicación y aceptación manual pendientes

1. Revisar el historial real del proyecto de ensayo: debe existir `20261007000100_guard_reports.sql` con la corrección sin SELECT directo. No editar/repetir migraciones aplicadas. Si falta esa versión, revisar y resolver ese requisito antes de esta mejora.
2. El responsable ejecuta únicamente `supabase/migrations/20261007000200_guard_report_log.sql` completo como propietario controlado. Registrar su versión según el procedimiento SQL Editor/CLI del proyecto. Sin seed_demo ni reset. Esta tarea no ejecutó db push.
3. Ejecutar auditoría `supabase/tests/security_baseline.sql` (solo lectura). Ejecutar manualmente `npm run backend:check`: esperar `guardReportLogVersion: 1`, junto a guardReportsVersion 1 y schemaVersion 9. Mantener accesshome_private fuera de Data API. Publicar el frontend solo mediante autorización/proceso del responsable.
4. Celular guardia: crear varios movimientos de prueba, visita con QR entrada/salida, salida manual, visita abierta vencida/cancelada, servicio finalizado, rechazado con motivo y servicio abierto. Incluir vehículo/placas cuando existan. Registrar otra llegada sin entrada y una cancelación de servicio.
5. Seleccionar periodo terminado que incluya esas fechas (fin exclusivo), revisar preview y generar. Comprobar que el resumen original sigue primero y sus cifras coinciden con los eventos reales; llegada/rechazo/cancelación no suman entradas.
6. Abrir detalle como guardia y como admin en computadora. Esperar mismas filas, orden cronológico, identidad/casa/vehículo, QR/MANUAL y responsable. Comprobar filtros y paginación. Revisar una salida cuya entrada fue anterior al periodo: solo la salida cuenta como movimiento del turno, con hora de entrada contextual.
7. Registrar después la salida de un pendiente: la bitácora del cierre sigue marcándolo pendiente al generar; el historial vivo muestra la salida nueva. Abrir también un cierre antiguo: aviso de contexto limitado, sin inventar datos.
8. Exportar CSV y abrir en Excel. Esperar 20 columnas y una fila por evento, con acentos, comas/comillas y notas multilínea intactas, sin secretos/IDs. En configuraciones regionales que no separen comas automáticamente, importar mediante Datos → Desde texto/CSV, UTF-8 y delimitador coma. La apertura física en Excel queda pendiente.
9. Verificar que otra cuenta guardia, otro condominio, residente, visitante público e inactivo no acceden a un reporte no autorizado ni por RPC. SELECT directo debe fallar aun para guard/admin autorizado. Probar móvil/tablet a 390/768 px: campos/listado/botones legibles, sin desbordamiento ni edición histórica.

### Pruebas locales y archivos

Pruebas del detalle cubren múltiples visitantes/servicios, horarios/contexto, snapshots de vehículo y guardia, pendientes antiguos, filtros/orden, paginación, cancelaciones/motivo de rechazo, autorización y DTO sin campos internos. CSV se analiza con un parser independiente para comprobar filas/columnas, celdas multilínea, UTF-8 y ausencia de secretos incluso si un objeto extra los contiene. SDK prueba exportación completa, límite, error sin descarga parcial y cancelación. PostgreSQL nativo comprueba salida concurrente no confirmada frente al snapshot. Las regresiones anteriores de servicios/QR/salida manual y cierres siguen incluidas.

Archivos de esta mejora: nueva migración; `src/components/GuardReportLog.tsx`; página `GuardReportsPage.tsx`; service `guardReportsService.ts`; tipos `guardReports.ts`; `utils/shiftCsv.ts`; `styles/guard-reports.css`; `scripts/check-backend.mjs`; auditoría SQL; pruebas guard-reports/guard-report-csv/shared-client/guard-backend/concurrency y fixtures shared-sql/invitation-preview; README, estado, pruebas, guía SQL y contrato de services.

Resultados: `npm test` **222/222**, `test:concurrency` **37/37**, `build:vercel` aprobado con TypeScript (chunk ~730 kB / 204 kB gzip, advertencia previa >500 kB). Pruebas visuales, Excel real, Supabase Auth/PostgREST y dispositivos físicos quedan pendientes. No hubo cambios remotos, `.env.local`, commits, push ni despliegue.

`deployment:check` y `git diff --check` también aprobados; la revisión de secretos reconocibles del artefacto no equivale a una auditoría exhaustiva.

## Implementación original del Prompt 14 (registro histórico)

Las trece migraciones anteriores y los flujos de visitas/servicios están confirmados en producción de ensayo por el responsable. Esta entrega implementa el módulo **localmente**; la migración 14, publicación y aceptación con cuentas/dispositivos reales están pendientes. No se cambió ninguna migración aplicada, `.env.local`, datos remotos ni cuentas. No se ejecutó `db push`, `db reset`, semilla remota, commit, push ni despliegue.

## Modelo y alcance

`accesshome.reports` es una incidencia residencial: exige casa/autor residente y permite avanzar su estado. Mezclar ahí cierres inmutables de caseta rompería ese contrato. La nueva `accesshome.guard_shift_reports` guarda cierres finalizados con el patrón existente de RLS, perfiles SQL, RPC privado y wrapper mínimo.

Cada cierre guarda UUID, condominio/guardia derivados del perfil, snapshots de sus nombres y zona horaria, inicio/fin, hora de generación SQL, métricas, observaciones e incidencias (2000 caracteres por campo), estado `finalizado`, versión de métricas 1 y datos de idempotencia. Guarda además IDs de los registros fuente de cada métrica para auditoría controlada. El DTO visible omite request_id, input original e IDs fuente; no incluye visitantes, teléfonos, tokens, placas ni historia privada.

**Los totales son un snapshot persistido, no cálculos dinámicos al consultar.** Preview y generación consultan SQL por separado; confirmar recalcula. Una consulta SQL/MVCC obtiene conjuntamente métricas y referencias de auditoría desde registros confirmados visibles en ese instante. Las transacciones que confirmen después no cambian el reporte. No se bloquea toda la caseta para generar ni se modifica/cierra ningún registro fuente. Las salidas posteriores seguirán existiendo en el historial, sin cambiar el snapshot previo.

No hay borradores, edición de totales/textos, borrado ni versionado. El administrador consulta, no modifica. Una incidencia escrita por el guardia es una declaración, no un evento de acceso ni un contador automático.

## Definición de las métricas

Todas abarcan el **condominio completo**, incluidos movimientos registrados por otros operadores; el guardia del reporte es quien cierra, no un filtro de autor de movimientos. El periodo usa **inicio incluido y fin excluido** `[inicio, fin)`.

| Campo | Fuente y significado |
| --- | --- |
| visitorEntries | access_records, dirección entrada, occurred_at dentro del periodo |
| visitorExits | access_records, dirección salida, occurred_at dentro del periodo |
| serviceArrivals | service_events, operación register dentro del periodo; NO son entradas |
| serviceEntries | service_events, operación allow dentro del periodo |
| serviceExits | service_events, operación exit dentro del periodo; servicios finalizados en ese periodo |
| serviceRejections | service_events, operación reject dentro del periodo |
| openVisits | Entradas reales sin salida correspondiente visibles al generar, de cualquier periodo; incluye invitaciones vencidas/canceladas |
| openServices | Eventos allow sin exit correspondiente visibles al generar, de cualquier periodo |
| visitorRejections | **null / No disponible**: access_records solo conserva movimientos autorizados; no existe registro verificable de rechazos QR. No se inventa cero ni se interpreta como rechazo una invitación cancelada |

Una llegada rechazada suma llegada + rechazo, nunca entrada. Una llegada, entrada y salida en el periodo suma uno en cada categoría. Los eventos fuera del periodo no se arrastran hacia adentro por el estado actual: una entrada anterior con salida en el turno suma solo salida. Los pendientes son actuales al generar, **no pendientes históricos a la hora de fin**; se etiquetan así en pantalla y CSV. No sumar los pendientes de reportes diferentes.

## Periodo y zona horaria

El guardia introduce inicio y fin a precisión de minuto en la zona del condominio indicada junto al formulario. El contexto propone las últimas ocho horas desde reloj SQL. El navegador envía texto `YYYY-MM-DDTHH:mm`, sin aplicar offsets ni usar su zona para convertirlo. PostgreSQL convierte con `AT TIME ZONE` y guarda `timestamptz`; la presentación usa el helper existente `formatDate(..., time_zone)`/Intl. CSV conserva ISO con offset y la zona guardada.

SQL exige inicio anterior al fin, **fin no futuro** y duración máxima de siete días. Es una regla deliberadamente más estricta que prohibir solo periodos completamente futuros: un cierre no afirma actividad futura. Permite turnos nocturnos y periodos pasados. Los filtros administrativos usan fecha de inicio, inclusiva en ambos extremos, en la zona guardada de cada reporte (no la hora del equipo).

Horas inexistentes durante un salto de horario estacional se rechazan mediante conversión de ida/vuelta. Las horas repetidas utilizan la interpretación posterior al retroceso de PostgreSQL (normalmente hora estándar); no existe selector de primera/segunda ocurrencia en este prototipo. Revisar el preview antes de confirmar en condominios con ese cambio. Esta regla se prueba con America/New_York. Referencia: [tratamiento oficial de timestamps ambiguos](https://www.postgresql.org/docs/17/datetime-invalid-input.html).

## Permisos y concurrencia

`accesshome.guard_reports(operation, input, request_id)` es SECURITY INVOKER. Delega a `accesshome_private.guard_reports`, SECURITY DEFINER con `search_path` vacío, perfil SQL activo y whitelist de operaciones/campos. Los helpers internos no tienen EXECUTE cliente. **No exponer accesshome_private por Data API ni añadirlo a Extra search path.**

| Actor | Permisos |
| --- | --- |
| Guardia activo | Contexto, preview/generación para su condominio; listar/consultar solo sus propios cierres |
| Admin activo | Contexto de filtros y lectura de todos los cierres de su condominio; no generar ni editar |
| Guardia/admin de otro condominio | Solo su propio alcance; ID ajeno rechazado |
| Residente, público, perfil inactivo/ausente | Sin acceso a reportes de caseta ni generación |

La tabla conserva RLS como defensa adicional, pero ningún cliente tiene SELECT directo de tabla ni de columnas, ni puede insertar, editar o borrar directamente. Guardia/admin leen exclusivamente mediante el RPC autorizado y `guard_report_dto`, que omite source_ids, request_id y command_input. Las pruebas verifican privilegios de catálogo, rechazo SQL directo incluso para el dueño del cierre/admin autorizado y conservación de list/detail por RPC. SQL rechaza campos inesperados como metrics, guard_user_id, condominium_id, generated_at o status, incluso al invocar la función privada. React envía solo periodo/textos/request_id. Los textos rechazan etiquetas (`<`/`>`) y se renderizan como texto escapado; CSV neutraliza prefijos de fórmulas y escapa comillas/saltos.

Reglas de cierre:

- Una combinación exacta `(condominio, guardia, inicio UTC, fin UTC)` solo admite un cierre. Índice único y bloqueo transaccional del periodo impiden duplicados con IDs diferentes.
- Mismo request_id + mismo guardia/condominio/contenido devuelve el mismo snapshot con `replayed: true`. Cambiar contenido/autor se rechaza. Un lock por request_id evita carreras antes de existir la fila.
- Otro request_id para ese periodo se rechaza y solicita consultar el reporte ya guardado, aunque el texto sea distinto. No sobrescribe nada.
- Periodos diferentes (incluidos adyacentes o superpuestos) y guardias distintos pueden tener cierres propios. **No sumarlos como periodos disjuntos**: cada uno resume la actividad del condominio; el responsable debe elegir los turnos correctos.
- El formulario bloquea doble clic; al perder la respuesta conserva periodo/texto y el ID en memoria para reintentar. Un fallo del refresco de contexto no borra el formulario. Cerrar/cambiar sesión limpia los IDs. Tras recargar o abandonar el formulario, consultar la lista antes de generar otra vez: la unicidad SQL seguirá impidiendo duplicar ese periodo.

## Pantallas y CSV

- `/guardia/reportes`: cierres propios, filtros por fecha, botón Generar reporte de turno, periodo/textos, preview backend y confirmación. Lista de 50 filas y refresco cada 30 segundos visibles.
- `/guardia/reportes/:reportId`: snapshot de solo lectura y Exportar CSV.
- `/admin/reportes-caseta`: sección separada de incidencias residenciales; filtros por fecha de inicio y guardia histórico del mismo condominio.
- `/admin/reportes-caseta/:reportId`: mismo snapshot autorizado, textos y CSV.

CSV se genera desde datos ya autorizados, sin librerías nuevas ni petición externa. No se implementa PDF ni rediseño general. Se conservan estilos azul/amarillo y formulario en una columna en móvil. La revisión visual/física en móvil y tablet está pendiente; no se declara aprobada por compilar CSS.

## Migración manual por el responsable

1. Seleccionar el proyecto Supabase de ensayo correcto. Comprobar las **13 versiones aplicadas hasta `20260919000100_service_access.sql`** y conservar respaldo según el proceso del proyecto. Si hay discrepancia, resolverla antes de aplicar.
2. Revisar y ejecutar **solo** [`20261007000100_guard_reports.sql`](../supabase/migrations/20261007000100_guard_reports.sql), completo, en SQL Editor como propietario controlado. Tiene `begin/commit`; no repetir versiones anteriores ni seed_demo. Si falla, revisar la causa; no conceder permisos generales para evitarla.
3. Registrar la versión aplicada. SQL Editor no actualiza automáticamente el historial CLI; si se usa CLI, reconciliar únicamente versiones comprobadas siguiendo [supabase/README.md](../supabase/README.md), antes de cualquier futura aplicación. No aplicar el mismo archivo otra vez.
4. Ejecutar [`security_baseline.sql`](../supabase/tests/security_baseline.sql), auditoría de solo lectura que termina con rollback. Debe finalizar sin excepciones. Mantener privado `accesshome_private`.
5. Ejecutar manualmente `npm run backend:check` con la configuración pública existente. Esperado: `guardReportsVersion: 1`, `serviceAccessVersion: 1` y `schemaVersion: 9`. No se agregan variables, secretos ni cuentas. Este chequeo no prueba autorización de usuarios.
6. Publicar el frontend mediante el proceso autorizado del responsable y realizar la aceptación siguiente. Codex no aplicó la migración ni desplegó. Hasta completar esos pasos, este módulo no está confirmado remotamente.

## Recorrido posterior en Vercel: celular guardia / computadora administrador

No requiere sesión activa del residente para servicios ni reportes; para visitas utilizar invitaciones de ensayo ya creadas. En un condominio compartido, anotar el periodo y consultar también los movimientos de otros operadores para comparar los totales completos.

1. Guardia inicia sesión real desde celular, registra una visita con entrada/salida y otra entrada que queda abierta. Conservar además una abierta vencida/cancelada para comprobar pendientes.
2. Registrar servicio Amazon a Casa 24, confirmar entrada y salida. Registrar otro y rechazarlo; otro con entrada abierta; otro solo con llegada. No confundir llegada con entrada.
3. Abrir `/guardia/reportes`, pulsar Generar reporte y seleccionar inicio/fin en la zona mostrada. Como el fin tiene precisión de minuto y es exclusivo, esperar al siguiente minuto para incluir los últimos movimientos; no seleccionar un fin futuro.
4. Escribir observaciones/incidencias y Calcular vista previa. Comparar cifras con historial de accesos y de servicios. Los pendientes incluyen entradas anteriores al inicio todavía abiertas. Rechazos QR debe decir No disponible.
5. Generar reporte. Esperado: detalle Finalizado con guardia, condominio, periodo, generación SQL y cifras recalculadas. Doble clic no duplica. Si hubo otro movimiento entre preview/cierre, el snapshot puede diferir justificadamente.
6. Admin inicia sesión en computadora, abre Reportes de caseta, filtra fecha/guardia y abre el reporte. Esperado: mismo identificador, cifras, generación y textos que el guardia; sin editar/borrar.
7. Comparar con fuentes. Si no existía ninguna otra actividad y se incluyeron los cuatro servicios descritos: 4 llegadas, 2 entradas, 1 finalizado, 1 rechazado y 1 dentro. Ajustar lo esperado a los registros reales, nunca sobrescribir datos para hacer coincidir cifras.
8. Verificar que la visita y el servicio abiertos siguen en sus colas. Registrar después sus salidas normalmente. Actualizar el reporte: **permanece igual**, mientras los historiales sí muestran las salidas nuevas.
9. Exportar CSV; verificar acentos, fechas ISO/zona, totales, observaciones y saltos de línea. No subir el CSV con datos operativos a servicios externos.
10. Probar en teléfono/tablet (390/768 px), navegación directa y recarga del detalle, lectura de métricas/textos, botones y campos sin desbordamiento. Comprobar guardia ajeno/residente/inactivo con cuentas de ensayo, sin desactivar cuentas operativas.

## Pruebas y cobertura

`tests/guard-reports.test.mjs`: casos 1–17 y 20–28 del prompt: flujos reales SQL, métricas exactas, cierre recalculado, mismo snapshot guardia/admin después de nuevas salidas, permisos de tabla/RPC y función privada, campos manipulados, metadata falsa, periodo/HTML/límites, datos fuente intactos, pendientes vencidos/cancelados, fronteras de fechas, filtros y DST. `tests/guard-backend.test.mjs` compara cada fila previa al aplicar la incremental sobre una base poblada.

`tests/concurrency/invitations.test.mjs`: casos 18–20 en PostgreSQL 17.10 temporal, conexiones independientes y comprobación de bloqueo: mismo ID, diferente ID/mismo guardia/periodo, rollback, turnos adyacentes y distinto guardia. No se sustituye concurrencia SQL por Promises sobre una sola conexión.

`tests/shared-client.test.mjs`: service omite totales/autor/condominio/hora incluso con objeto manipulado, recupera mismo request_id y lo limpia al cerrar sesión. `tests/guard-report-csv.test.mjs`: CSV frente a fórmulas/comillas/saltos y presentación con zona explícita.

La suite existente cubre regresiones de servicios (29), QR (30) y salida manual (31). La interacción visual, doble clic físico, responsive (32), Auth/PostgREST de Supabase real y dos dispositivos siguen **pendientes**. Los tests locales usan Auth simulado y bases SQL desechables, nunca el proyecto remoto. El fixture `node tests/helpers/invitation-preview.mjs` admite el nuevo RPC para revisión local opcional; no publicarlo ni tratarlo como Auth real.

Resultados finales se registran también en [PROTOTYPE_TESTING.md](PROTOTYPE_TESTING.md). No existe script lint/typecheck independiente: `npm test` compila tipos de services/tests y `build:vercel` ejecuta `tsc --noEmit` para toda la app.

Ejecutados: `npm test` **214/214**, `npm run test:concurrency` **36/36**, `npm run build:vercel`, `npm run deployment:check` y `git diff --check` aprobados. Una corrida intermedia tuvo un EBUSY de Windows al limpiar un temporal de la prueba existente de configuración; la repetición completa aprobó. Persiste advertencia de chunk principal >500 kB (~724 kB / ~203 kB gzip). La revisión de dist identifica secretos reconocibles/archivos privados, no constituye una auditoría exhaustiva.

## Archivos de esta etapa

- SQL: migración nueva y `supabase/tests/security_baseline.sql`.
- Frontend nuevo: `src/types/guardReports.ts`, `src/services/guardReportsService.ts`, `src/components/GuardReportForm.tsx`, `src/components/GuardReportSummary.tsx`, `src/pages/GuardReportsPage.tsx`, `src/utils/shiftCsv.ts`, `src/styles/guard-reports.css`.
- Integración: `src/router.tsx`, `src/data/navigation.ts`, `src/pages/GuardDashboardPage.tsx`, `src/services/shared/adapters.ts`, `src/styles/global.css`, `scripts/check-backend.mjs`.
- Pruebas: `tests/guard-reports.test.mjs`, `tests/guard-report-csv.test.mjs`, `tests/shared-client.test.mjs`, `tests/guard-backend.test.mjs`, `tests/concurrency/invitations.test.mjs`, `tests/helpers/shared-sql-fixture.mjs`, `tests/helpers/invitation-preview.mjs`, `tests/tsconfig.json`.
- Documentación: este archivo, `README.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`, `supabase/README.md`, `src/services/README.md`.

Limitaciones: no auditoría de rechazos QR, máximo siete días, ambigüedad DST con regla documentada, snapshots de todo el condominio que no deben sumarse si se superponen, sin búsqueda avanzada/edición/PDF. La advertencia conocida del bundle >500 kB se conserva. El esquema deja listas referencias auditables; no altera los módulos previos ni implementa Prompt 15.
