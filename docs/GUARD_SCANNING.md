# Escáner de guardia y movimientos compartidos

Etapa implementada localmente. **La migración de escaneo no se aplicó al proyecto remoto y las cámaras físicas no se probaron.** No hubo commit, push, despliegue, modificación de `.env.local` ni operaciones sobre datos remotos.

## Preparar el proyecto de ensayo

1. El responsable debe seleccionar el mismo Supabase de ensayo y revisar su historial de migraciones. Las ocho iniciales ya están aplicadas según su confirmación. Verificar las incrementales `20260917000600_guard_workspace.sql` y `20260917000700_public_invitation_sharing.sql`; aplicar solo las que falten, en orden, siguiendo [GUARD_SETUP.md](GUARD_SETUP.md) y [DEPLOYMENT.md](DEPLOYMENT.md).
2. Revisar y aplicar **únicamente la nueva versión pendiente** [`20260918000100_guard_scanning.sql`](../supabase/migrations/20260918000100_guard_scanning.sql) completa como propietario controlado. Puede usarse SQL Editor o el procedimiento CLI con historial reconciliado, revisión de `supabase migration list` y `supabase db push --dry-run` antes de autorizar la aplicación. Son instrucciones para el responsable: no se ejecutaron contra su proyecto. No repetir archivos aplicados, `seed_demo`, provisión existente ni reset.
3. Ejecutar la auditoría de solo lectura [`security_baseline.sql`](../supabase/tests/security_baseline.sql), ahora correspondiente a las once migraciones. Debe terminar sin excepciones. Mantener `accesshome` expuesto y `accesshome_private` fuera de Data API/Extra search path.
4. Ejecutar `npm run backend:check`: esperar esquema base 9, `guardWorkspaceVersion: 1`, `publicInvitationVersion: 2` y **`guardScanningVersion: 1`**. La versión base no es un contador de migraciones. Este chequeo no demuestra permisos con Auth ni funcionamiento de la cámara. Si falta la nueva versión, detener la prueba de escaneo y resolver la migración; no conceder permisos generales ni recurrir al almacenamiento local.
5. Reutilizar la cuenta Auth individual y el perfil `guard` del condominio. Si aún no existen, el responsable sigue el procedimiento controlado de [GUARD_SETUP.md](GUARD_SETUP.md); la aplicación no crea cuentas ni asigna roles. No cambiar perfiles de residentes/administradores ni guardar contraseñas en código.
6. Compilar/publicar el frontend solo cuando lo autorice el responsable. No hay variables nuevas: siguen siendo exactamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de `.env.example`, del mismo proyecto de ensayo. Para teléfonos usar la dirección HTTPS real del deployment; abrir HTTP por IP LAN no habilita cámara. Ver [requisitos de getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

La nueva migración no crea tablas ni reescribe filas anteriores. Amplía el CHECK de `access_records.method` para `MANUAL` y añade `validator_name` nullable; los registros previos mantienen sus valores y el nuevo campo nulo, sin backfill. Reemplaza la implementación de validación por un solo motor y conserva la firma anterior. El cambio requiere un bloqueo breve de esquema sobre `access_records`; aplicarlo en una ventana de ensayo sin operaciones de caseta en curso.

## Operación en caseta

Abrir `/guardia/escanear` desde la acción principal de caseta. Muestra guardia y condominio del perfil autenticado.

- **Activar cámara** solicita únicamente video, preferentemente cámara trasera. La pantalla no pide permisos al entrar. **Detener cámara** también funciona si todavía se espera respuesta al permiso; si llega un stream después, se cierra inmediatamente.
- Enfocar el QR de la página del visitante. El lector procesa imágenes en el dispositivo, extrae el token y llama al service compartido. No abre el enlace escaneado, guarda imágenes ni envía video a un tercero.
- Sin cámara o con permiso denegado, pegar el enlace completo o el token en **Enlace o código de invitación** y pulsar **Validar código manual**. Es la misma validación SQL, con método `MANUAL`.
- Un resultado verde muestra **ENTRADA** o **SALIDA**, visitante, casa, vehículo si existe, hora y nombre del operador. Verificar identidad y placas antes de permitir el paso. El frontend no hace reconocimiento de identidad.
- Después de cualquier código leído se detiene el stream. El resultado permanece hasta **Escanear siguiente**; para usar la cámara otra vez, pulsar **Activar cámara**. No se autoriza una segunda operación por mantener el QR enfocado.
- Rojo significa rechazo. Amarillo significa respuesta incierta, lectura demasiado próxima/concurrente o recuperación de una operación previa; no autoriza un nuevo paso. Repetir una petición con el mismo identificador devuelve el movimiento existente y muestra **Movimiento ya registrado**.
- Ante pérdida de respuesta usar **Reintentar misma operación**. Se conserva el identificador en memoria y no aparece Siguiente hasta obtener respuesta. Consultar historial si hay duda. Una recarga completa, cierre o cambio de cuenta pierde ese estado en memoria: verificar lo registrado antes de iniciar otra lectura.

El stream se libera al detectar un QR, detener, salir de ruta, cerrar sesión o esconder la página. Volver a la pantalla no enciende la cámara automáticamente. Los errores de permisos/hardware ofrecen entrada manual; los errores no incluyen tokens.

## Un solo motor de validación

`guardService.validateToken` y el control administrativo reutilizan `validateSharedAccess` → `accesshome.validate_access`. La nueva sobrecarga añade `scan_method`; la firma anterior de dos argumentos delega al mismo motor con método QR. No hay otro contador, otra tabla de accesos ni base local para guardia.

El RPC expuesto es `SECURITY INVOKER`. Solo `authenticated` tiene EXECUTE, y la implementación `SECURITY DEFINER` está en `accesshome_private` con `search_path` vacío y autorización interna. `guard` se obtiene del perfil SQL activo, nunca de metadata o parámetros enviados por React. Mantiene las políticas RLS anteriores: no habilita INSERT/UPDATE/DELETE directos, acceso a tablas privadas ni funciones administrativas. Consultar [seguridad de funciones Supabase](https://supabase.com/docs/guides/database/functions).

Dentro de la transacción se comprueban actor activo, mismo condominio, token, estado, fechas del servidor, casa activa y usos. Se conserva el orden de bloqueos residencia → invitación, compatible con cancelaciones. La secuencia se coteja con los movimientos existentes: cero registros permite entrada, una entrada permite salida y dos usos completan la invitación. Una secuencia inconsistente se rechaza para revisión, sin reparar/borrar historia automáticamente.

Dos solicitudes concurrentes no consumen entrada y salida: la segunda relee la fila bloqueada y compara los usos con los observados antes de esperar. También se rechaza una nueva lectura del guardia durante los 3 segundos siguientes al último movimiento, incluso usando la firma antigua. Este intervalo protege ráfagas; no sustituye la validación de identidad ni el control de Siguiente. Pasado ese intervalo, una nueva lectura deliberada registra la salida si corresponde. El simulador administrativo conserva su secuencia existente.

El `request_id` único hace idempotente un reintento de la misma operación, actor, invitación y método. Un ID reutilizado con otro actor, invitación o método se rechaza. En aislamiento `REPEATABLE READ`, un snapshot obsoleto puede recibir `40001`; no se concede acceso por ese error. Los constraints únicos de invitación/dirección continúan vigentes.

Una entrada autorizada deja una visita abierta aunque después se cancele la invitación o llegue su expiración. En ese caso el mismo motor permite únicamente a un guardia activo del condominio registrar la **salida** correspondiente: debe existir exactamente una entrada, ningún movimiento de salida, uso `1/2` y la invitación queda `completada` al cerrar. El movimiento guarda `invitation_status_before` y `invitation_effective_status_before`, por lo que una cancelación o expiración queda visible en la trazabilidad. No se habilita una nueva entrada, no se permite una salida sin entrada y administración/residentes no pueden usar esta excepción. Una residencia inactiva, una invitación futura o una secuencia inconsistente siguen rechazando la operación.

## Registro y actualización

Cada movimiento aprobado guarda en `access_records`: invitación, residencia y condominio, visitante/vehículo como snapshots, `validated_by` (UID Auth), `validator_name` (snapshot), dirección, `occurred_at` del servidor, método QR/MANUAL, `request_id` y resultado `authorized=true` controlado por SQL. **React solo envía token, ID de petición y método.** No puede escribir la autorización ni modificar un movimiento histórico.

Se conserva el modelo existente: una validación rechazada devuelve motivo y mensaje, sin consumir usos ni insertar un movimiento. Esta etapa no añade una bitácora de intentos fallidos. La proyección devuelta al guardia contiene solo ID del movimiento, visitante, casa, vehículo, dirección, fecha, método, nombre del operador y, cuando corresponde, el estado de invitación anterior; omite teléfono, correo, notas, anfitrión, tokens e IDs privados de cuentas/invitaciones/residencias.

Administrador y residente consultan el historial compartido existente. Caseta/historial guard refrescan al abrir, al recuperar foco y cada 30 segundos visibles, además de Actualizar. Las otras pantallas conservan su refresco de 10 segundos. No requiere Realtime. Cancelar o vencer una visita bloquea nuevas entradas; si ya había una entrada, un guardia activo del mismo condominio puede registrar la salida controlada descrita arriba, conservando el estado previo y completando la invitación.

## Lector y límites

Se añadió [`qr` 0.7.0](https://github.com/paulmillr/qr), sin dependencias transitivas. Solo el decodificador se carga al activar cámara, en un chunk separado (~34.83 kB, ~14.29 kB gzip). `qrcode.react` sigue generando los QR existentes. El procesamiento limita el lado mayor de la imagen a 640 px, toma aproximadamente cinco frames por segundo e impone un límite de trabajo por intento de decodificación. Enfoque, luz, distancia y rendimiento deben comprobarse con los teléfonos reales del ensayo.

Los enlaces/token se tratan como credenciales de acceso: no se añaden logs, analítica ni grabación de frames. El token viaja al RPC en cuerpo POST. No compartir capturas de códigos reales ni exportar peticiones con encabezados Auth. HTTPS y permiso del usuario son requisitos de cámara; el navegador integrado de WhatsApp puede requerir abrir el enlace en Safari/Chrome.

Pruebas ejecutadas, matriz de trece pasos y resultados esperados en [PROTOTYPE_TESTING.md, etapa 12](PROTOTYPE_TESTING.md#etapa-12--escáner-qr-y-movimientos-compartidos). Servicios y reportes de turno siguen pendientes; no forman parte de esta entrega.
