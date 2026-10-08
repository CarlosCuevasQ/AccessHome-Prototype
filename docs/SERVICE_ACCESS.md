# Servicios y repartidores · Prompt 13

Implementado y probado localmente. Las doce versiones anteriores están aplicadas según el responsable. **La migración 13 y la aceptación remota de este módulo siguen pendientes.** No se ejecutó SQL remoto, `db push`, `db reset`, semilla remota, commit, push ni despliegue. No se modificó `.env.local` ni ninguna de las doce migraciones aplicadas.

## Operación

El guardia inicia sesión con su cuenta real existente y abre `/guardia/servicios`. Selecciona residencia activa de su condominio (solo identificación de casa), categoría y empresa opcional; puede indicar nombre, placas y observaciones breves. Mantenimiento y Otro servicio requieren nombre. No se capturan documentos personales ni se crean cuentas para repartidores.

Categorías: Paquetería, Entrega de comida, Transporte, Mantenimiento y Otro servicio. Empresas sugeridas: Amazon, Estafeta, Uber, DiDi, Uber Eats y Otra; se admite texto libre limitado. Elegir una empresa nunca concede acceso permanente ni automático.

**Registrar llegada** conserva el registro y muestra sus datos. Todavía no existe entrada. **Permitir entrada** abre una confirmación con destino/datos y exige marcar «Confirmo que verifiqué este servicio y autorizo su entrada. Se registrará una entrada real». **Rechazar acceso** admite motivo opcional; **Cancelar registro** conserva la llegada sin movimiento. En **Servicios dentro del condominio**, el guardia selecciona el registro y confirma su salida, viendo identidad/destino/hora de entrada.

Administración abre `/admin/servicios` (Historial de servicios) para consultar cada llegada, decisión, responsables, horas, rechazo y movimientos. Es independiente del historial de invitaciones residenciales. El panel residencial no cambia, no hay solicitudes/notificaciones de aprobación y ninguna sesión residencial es necesaria.

## Estados y vigencia

| Estado previo | Acción | Estado final | Movimiento físico |
| --- | --- | --- | --- |
| Ninguno | Registrar llegada | registrado | Ninguno |
| registrado | Permitir entrada, vigente y casa activa | en_sitio | ENTRADA / MANUAL |
| registrado | Rechazar acceso | rechazado | Ninguno |
| registrado | Cancelar registro | cancelado | Ninguno |
| en_sitio | Registrar salida | finalizado | SALIDA / MANUAL |

El servidor fija una vigencia de **30 minutos desde la llegada**. Un registro vencido sin entrada permanece Registrado con aviso de vencimiento; solo se puede rechazar/cancelar, nunca admitir. Una nueva llegada requiere otro registro. No se usa una tarea programada ni se añade un sexto estado.

El servicio que ya ingresó puede salir después de vencer o de desactivarse su residencia. El guardia debe seguir activo y pertenecer al mismo condominio. La salida no extiende la vigencia, no reactiva el registro y no permite otra entrada. No hay salida sin entrada ni segunda salida.

## Modelo y seguridad

Nueva migración: [`20260919000100_service_access.sql`](../supabase/migrations/20260919000100_service_access.sql).

- `accesshome.service_visits`: destino y snapshot de casa, categoría/empresa/nombre/placas/notas, estado, autor/hora de llegada y vencimiento del servidor.
- `accesshome.service_events`: historial conservado de `register`, `allow`, `reject`, `cancel`, `exit`; autor SQL y nombre como snapshot, hora, motivo de rechazo y método. Solo `allow`/`exit` son movimientos y tienen método MANUAL. No hay movimientos ficticios para llegadas/rechazos.
- `service_context()`: residencias activas mínimas para guardia. `list_services(status_filter, page)`: lista del condominio con filtros, 50 filas por página, contadores y zona horaria. `service_command(operation, target, input, request_id)`: operación transaccional para guardia.
- Los wrappers en `accesshome` son SECURITY INVOKER. Las implementaciones privilegiadas están en `accesshome_private`, con `search_path` vacío, autorización interna y grants específicos. **No exponer `accesshome_private` por Data API**, ni añadirlo a Extra search path.
- `require_guard` deriva rol/condominio del perfil SQL activo y mantiene su bloqueo existente. Ni metadata Auth ni parámetros del navegador asignan autoridad. Cada fila/autor está vinculado por FK al mismo condominio.
- RLS de tablas nuevas: administrador activo puede leer su condominio; guardia usa proyecciones RPC. No hay INSERT/UPDATE/DELETE directo para clientes, función de editar historia, reasignación de autores ni acceso público/residencial. Admin puede consultar pero no ejecutar operaciones de caseta de este módulo.
- Bloqueo por `request_id` protege incluso altas simultáneas antes de existir una fila; bloqueo de residencia y registro serializa decisiones/salidas. La hora se comprueba después de esperar. Índices únicos impiden repetir eventos y tomar dos decisiones distintas. Estado/evento se confirman o revierten juntos.
- Reintentar el mismo `request_id` requiere mismo actor, condominio, operación, destino y contenido. Devuelve el estado actual con `replayed: true`, sin nuevo movimiento ni permiso para repetir el paso. IDs con contenido/actor distinto se rechazan.

El cliente conserva IDs de reintento independientes en memoria durante errores de red; se limpian al resolver la operación o cambiar/cerrar sesión. Después de recargar, consultar la lista antes de registrar otra llegada si se perdió la respuesta. Una nueva solicitud con otro ID es una nueva llegada: no se deduplican personas por nombre o empresa. La autorización SQL sigue protegiendo cada entrada/salida.

La UI consulta de nuevo cada 15 segundos visibles, al recuperar foco/conexión y después de una operación. No necesita Realtime. Los services exigen Supabase; no mezclan datos de demo local. El registro de eventos permite reportes futuros; **Prompt 14 no está implementado**.

## Aplicación manual por el responsable

1. Seleccionar el proyecto Supabase de ensayo correcto y comprobar el historial: deben existir las doce versiones hasta `20260918000200_open_visit_exits.sql`. Conservar los datos y cuentas actuales. Si difiere el historial, detener la aplicación y revisar la diferencia.
2. Revisar el archivo incremental completo. En SQL Editor del proyecto seleccionado, como propietario controlado, ejecutar **solo** `20260919000100_service_access.sql`. Incluye `begin/commit`; no repetir migraciones anteriores ni `seed_demo`, no reiniciar la base. No ejecutarlo una segunda vez si ya se confirmó.
3. Registrar la versión aplicada. Si se usa CLI para gestionar migraciones, elegir una sola vía: revisar primero el historial y que la única pendiente sea esta versión. SQL Editor no actualiza automáticamente el historial CLI; reconciliar versiones verificadas según el procedimiento de [supabase/README.md](../supabase/README.md) antes de cualquier futura aplicación CLI. Nunca marcar una versión que no corresponda al esquema real.
4. Ejecutar la auditoría de solo lectura [`security_baseline.sql`](../supabase/tests/security_baseline.sql): debe terminar sin excepciones y hace rollback. Verificar que Data API expone `accesshome`, nunca `accesshome_private`.
5. Ejecutar manualmente `npm run backend:check` con la configuración pública existente: debe mostrar `serviceAccessVersion: 1` junto con las capacidades anteriores. Esto comprueba conexión/capacidad; no sustituye probar roles con cuentas Auth reales. No se necesitan nuevas variables ni claves privilegiadas.
6. Publicar el frontend actualizado únicamente mediante el proceso autorizado por el responsable. Mientras falta la migración, el módulo no es operativo remotamente; muestra error al consultar, sin fallback local ni autorización aparente.
7. Ejecutar el recorrido siguiente con las cuentas existentes. No crear una sesión del residente.

## Recorrido real pendiente: celular guardia y computadora administrador

1. En celular/tablet, iniciar sesión como guardia activo y abrir Registrar servicio. En computadora, iniciar como admin del mismo condominio y abrir Historial de servicios.
2. Guardia registra Paquetería / Amazon / Casa 24. Esperado: Registrado, datos capturados para revisión y **ninguna entrada**. Admin actualiza: solo llegada con nombre del guardia/hora.
3. Guardia pulsa Permitir entrada. Verificar destino; sin marcar confirmación no se puede enviar. Marcar y confirmar. Esperado: En sitio y una ENTRADA MANUAL con guardia/hora del servidor. Admin actualiza y ve esa entrada.
4. Guardia abre Servicios dentro del condominio, selecciona Amazon/Casa 24 y confirma Registrar salida. Esperado: Finalizado, desaparece de pendientes de salida; admin ve exactamente una entrada y una salida, ambas MANUAL y con responsables.
5. Registrar otra llegada y rechazarla con motivo breve. Esperado: Rechazado, motivo y autor/hora visibles al admin, sin entrada/salida. Una nueva llegada de la misma empresa requiere otro registro.
6. Repetir en teléfono a 390 px y tablet a 768 px: campos/botones legibles, sin desbordamiento, estados en texto además de color, controles táctiles accesibles, confirmación completa. Esta comprobación visual/física está pendiente.

No anotar contraseñas, tokens ni datos privados en evidencias. Registrar caso, hora y resultado; no hace falta una cuenta Supabase para el repartidor.

## Matriz de aceptación

Las pruebas negativas de RPC deben usar JWTs de usuarios de ensayo con clave publishable, desde un cliente de prueba; SQL Editor como propietario no simula RLS. No editar tablas ni desactivar cuentas reales para probar. Para vencimiento remoto, esperar 30 minutos en registros de ensayo. Para pruebas simultáneas usar dos sesiones de guardia activo del mismo condominio.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| 1–6 | Recorrido Amazon/Casa 24 anterior | Llegada sin entrada; confirmación, entrada y salida; historial admin completo |
| 7–8 | Rechazar otra llegada e intentar `allow` por RPC | Rechazo conservado; entrada denegada |
| 9 | Cancelar registro e intentar `allow` | Cancelado, sin entrada |
| 10 | Esperar vencimiento de un registrado e intentar entrada | Rechazo; vigencia sin cambios |
| 11 | Permitir otra entrada, esperar vencimiento y salir | Una salida autorizada sin prorrogar |
| 12–14 | Repetir entrada/salida con ID nuevo; salir de un registrado | Operaciones rechazadas sin eventos extra |
| 15–16 | Dos guardias confirman entrada o salida simultáneamente | Solo un movimiento de cada tipo; segundo error de estado |
| 17 | Reintentar mismo request_id y contenido | Replay informativo, no nueva operación; cambiar contenido/actor rechaza |
| 18 | Guardia de otro condominio lista o usa ID ajeno | Solo registros propios; comando ajeno rechazado |
| 19 | Cuenta de ensayo con perfil inactivo | Consulta/operación denegada |
| 20–21 | Residente, anon y visitante ejecutan RPCs | Acceso denegado; no creación ni decisión |
| 22 | Elegir empresa y registrar llegada | Ninguna autorización/entrada automática |
| 23 | Registrar y decidir con guardias distintos del mismo condominio | Cada evento conserva su responsable y hora |
| 24 | Consultar historial administrativo | Servicios separados de invitaciones; llegada no cuenta como entrada |
| 25 | Flujo normal QR/residente y salida manual de visitante | Siguen operando con las mismas tablas/RPCs existentes |
| 26 | Formulario/confirmaciones en móvil/tablet | Usable sin scroll horizontal ni estados solo por color |

## Validación local y límites

- `npm test`: **203/203 aprobadas**, incluyendo SQL/PGlite, grants/RLS, incremento sobre datos poblados intactos, permisos, estados, vigencia, rollback, reintentos del SDK y regresiones QR/salida manual.
- `npm run test:concurrency`: **31/31 aprobadas** en PostgreSQL 17.10 temporal con conexiones TCP independientes. Nueve casos nuevos: entradas/salidas simultáneas, entrada frente a rechazo/cancelación, tres reintentos concurrentes con el mismo ID, rollback y vencimiento mientras espera el bloqueo.
- `npm run build:vercel`: aprobado; conserva advertencia de chunk principal >500 kB. No se añadieron dependencias. Revisión del artefacto incluida sin claves privilegiadas reconocibles ni archivos privados; no constituye una auditoría exhaustiva de secretos.
- `npm run deployment:check`: aprobado sobre el artefacto generado. `git diff --check`: aprobado; Git solo informó la normalización habitual LF/CRLF de Windows.
- Prueba visual no completada: el control del navegador fue detenido por la herramienta al no poder determinar con seguridad la URL de la ventana de Windows. No se registran móvil ni recorrido visual como aprobados.
- Pendientes: aplicar migración/publicar mediante responsable, Auth/PostgREST/RLS en Supabase real, dos dispositivos, prueba física móvil/tablet y regresión QR remota. Los datos anteriores confirmados por el usuario no equivalen a validar remotamente este módulo nuevo.

Fixture opcional de revisión local: `node tests/helpers/invitation-preview.mjs`; abrir `http://127.0.0.1:5176/login` como `guard@fixture.invalid` y `http://localhost:5176/login` como `admin@fixture.invalid`. Acepta texto efímero no vacío como contraseña únicamente en Auth simulado; ambos orígenes comparten SQL PGlite desechable. No utiliza ni cambia datos remotos. Detener con Ctrl+C; no publicarlo.
