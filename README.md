# AccessHome

Prototipo universitario en React, Vite y TypeScript. Conserva las pantallas de administración, residencia, contactos, invitaciones/QR, historial y reportes.

El responsable confirmó Vercel, Supabase, las once migraciones y el flujo QR de entrada/salida en dispositivos reales. Esta mejora conserva el QR exclusivamente para salir de una visita abierta cancelada/vencida y añade **Registrar salida sin QR** para guardias. Requiere la nueva migración `20260918000200_open_visit_exits.sql`, todavía pendiente de aplicación remota. Guía: [OPEN_VISIT_EXITS.md](docs/OPEN_VISIT_EXITS.md).

## Ejecutar

Recomendado para desarrollo y pruebas: Node.js 24.11 o posterior.

```sh
npm install
npm run dev
```

[Aplicación](http://127.0.0.1:5173). Vite usa exactamente las dos variables de [.env.example](.env.example):

- Ambas vacías: modo local, sin autenticación real.
- Una o ambas presentes: modo compartido obligatorio. Si falta una, la app muestra un error; nunca vuelve silenciosamente a localStorage.
- En compartido, toda lectura/escritura de dominio usa Supabase mediante services/RPCs. Solo el SDK persiste su sesión Auth en el dispositivo.
- Los modos no importan ni sincronizan datos entre sí. El modo activo se identifica en la interfaz.

Para conservar una demo local aunque ya exista configuración de Supabase:

```sh
npm run dev:local
```

Este comando fuerza ambas variables vacías solo en su proceso y abre [la demo local aislada](http://127.0.0.1:5174). No cambia .env.local. Al usar otro puerto, tiene otro almacenamiento: los datos previos de 5173 permanecen allí.

## Cuentas y permisos

En modo local se entra por correo, sin contraseña: administrador `admin@accesshome.demo`, Daniel `residente@accesshome.demo`, Ana `ana@accesshome.demo`, Mariana `mariana@accesshome.demo`. Las antiguas contraseñas locales se retiran al leer una base válida; se conservan sus entidades, invitaciones y sesión. Los datos corruptos no se sobrescriben.

En modo compartido, cada persona usa su cuenta de Supabase Auth y una contraseña individual creada fuera del repositorio. Los correos reales pueden ser distintos de las etiquetas locales. El rol, condominio y residencia se obtienen de perfiles controlados; nunca de metadata editable del usuario.

| Perfil | Permisos compartidos |
| --- | --- |
| Administrador | Estructura y principales del propio condominio, consulta de habitantes/vehículos, control de acceso existente, historial y estados de reportes |
| Residente principal | Habitantes/vehículos de su casa activa, agenda privada, creación/cancelación de invitaciones, reportes propios |
| Residente adicional | Consulta de su casa, invitaciones e historial; reportes propios históricos |
| Guardia | Panel `/guardia`, historial mínimo, escáner `/guardia/escanear` y salida sin QR `/guardia/salidas`; movimientos solo mediante RPC autorizado del propio condominio. Sin gestión administrativa ni escrituras directas |
| Visitante | Solo proyección de su invitación mediante token; sin acceso general a tablas |

Las políticas RLS limitan lecturas; ningún cliente tiene INSERT/UPDATE/DELETE general. Los RPCs de escritura autorizan identidad y pertenencia, con transacciones. Un perfil inactivo o residente sin habitante activo queda bloqueado. La provisión inicial y vinculación de cuentas se ejecutan de forma controlada, fuera del frontend.

Los RPCs expuestos son SECURITY INVOKER. La lógica privilegiada está en accesshome_private, con autorización interna y EXECUTE específico; ese esquema permanece fuera de Data API.

## Configuración compartida

La configuración existente de `.env.local`, las once migraciones aplicadas y los datos se conservan. Esta mejora añade únicamente `20260918000200_open_visit_exits.sql`: proyección pública con `hasOpenEntry`, listado mínimo de pendientes y salida manual delegada al motor de accesos existente. El responsable debe revisar/aplicar solo esta versión nueva y publicar el frontend actualizado.

Seguir [OPEN_VISIT_EXITS.md](docs/OPEN_VISIT_EXITS.md) y [PROTOTYPE_TESTING.md](docs/PROTOTYPE_TESTING.md). No volver a ejecutar `seed_demo`. `npm run backend:check` indica las capacidades existentes y, para esta mejora, `publicInvitationVersion: 3` y `openVisitExitsVersion: 1`; no prueba login, cámara ni despliegue. No se ejecutó contra el proyecto en esta entrega.

Para instalaciones completamente nuevas, [SHARED_BACKEND_SETUP.md](docs/SHARED_BACKEND_SETUP.md) documenta la base inicial. Mantener expuesto `accesshome` y privado `accesshome_private`.

No poner secretos administrativos, claves service_role ni contraseñas en Vite. La configuración rechaza claves distintas de publishable antes de construir el bundle. No se incluye registro abierto, recuperación de contraseña ni provisión Auth desde las pantallas.

## Invitaciones y actualización

El servidor genera tokens públicos de 32 bytes con pgcrypto, separados del UUID interno. La creación conserva snapshots y puede guardar el contacto en la misma transacción. El detalle autorizado recupera el token; los listados no exponen tokens públicos de otras casas.

Un mismo contacto no puede tener invitaciones activas con periodos superpuestos en la misma residencia, incluso con altas concurrentes. Se permiten periodos consecutivos y reutilizar contactos de invitaciones canceladas, completadas o ya vencidas. No se compara por nombre ni se deduplican visitantes sin contacto.

El enlace del visitante consulta la misma base desde cualquier dispositivo con acceso al frontend. Nunca se importa la base local para resolver el QR. El endpoint público tiene una proyección limitada y control básico de frecuencia en SQL (256 buckets, 240 consultas por minuto y bucket); no abre tablas. No hay protección completa contra ataques distribuidos.

El detalle ofrece **Compartir invitación**, **Enviar por WhatsApp** y **Copiar enlace**. Usa Web Share cuando está disponible, copia alternativa y selección manual si el portapapeles falla. WhatsApp solo prepara el mensaje; el residente elige destinatario y envío. Enlace y QR usan el origen real del deployment, sin una nueva variable ni dominios inventados.

La vista pública no requiere cuenta: un cliente Supabase anónimo sin persistencia de sesión consulta visitante, casa/condominio, vigencia y estado. No muestra anfitrión, teléfono, correo, usos ni vehículo. Las invitaciones canceladas, expiradas o completadas conservan su estado visible y retiran el QR. **Actualizar estado** permite consultar inmediatamente; el refresco visible automático usa 10 segundos. La interfaz y el RPC público son de solo lectura: el parámetro `vehicle` se conserva por compatibilidad de firma, pero cualquier objeto no nulo se rechaza sin modificar la invitación. El residente debe definir el vehículo al crearla.

Las consultas refrescan al abrir la pantalla, recuperar foco o conexión y después de escrituras locales. Las pantallas que ya actualizaban automáticamente consultan cada 10 segundos en compartido, solo si están visibles. No se usa Realtime ni infraestructura adicional. Los dashboards agregan en SQL y devuelven solo cinco movimientos recientes.

El control administrativo y el escáner de guardia reutilizan un único motor `validate_access`, con autorización SQL, bloqueo, secuencia entrada/salida e idempotencia. `/guardia/escanear` solicita cámara solo al pulsar **Activar cámara**; permite detenerla o pegar el enlace/token manualmente. Cada lectura detiene el stream y conserva el resultado hasta **Escanear siguiente**. Un fallo de red ofrece reintentar la misma operación; no anuncia autorización. Las lecturas de guardia de una misma visita deben separarse al menos 3 segundos, además de la protección transaccional contra solicitudes simultáneas.

Los movimientos guardan la identidad del operador, snapshots del visitante/residencia/vehículo, fecha del servidor, método QR/MANUAL y resultado autorizado. Los rechazos no crean movimientos. Administración y residencia consultan el historial compartido existente. Caseta/historial de guardia refrescan cada 30 segundos visibles, al consultar o recuperar foco; historial de siete días y 50 registros por página. **Registrar servicio** y **Reportes de turno** conservan sus estados de próxima etapa.

En la demo local, los identificadores se generan con Web Crypto comprobando disponibilidad; se eliminó el fallback de Math.random/timestamp. Los tokens locales históricos no se publican ni migran automáticamente.

## Verificación y documentación

```sh
npm test
npm run test:concurrency
npm run build
npm run preview
```

Las pruebas incluyen regresión local, PostgreSQL/PGlite con pgcrypto, RLS, RPCs, snapshots, límites públicos y cliente Supabase con HTTP simulado. test:concurrency ejecuta además PostgreSQL nativo temporal con conexiones independientes, sin leer .env.local ni aceptar destinos remotos. No sustituyen las pruebas de Auth y PostgREST contra el proyecto remoto.

Para Vercel, Build Command **`npm run build:vercel`**, Output Directory **`dist`**, Node **24.x**, las mismas dos variables públicas del proyecto Supabase de ensayo. El build exige configuración compartida y ejecuta la revisión de secretos reconocibles en `dist` (`npm run deployment:check`). `vercel.json` prepara las rutas SPA, incluidos enlaces directos del visitante. El responsable importa el repositorio y autoriza el deployment siguiendo la guía; no se publica automáticamente desde esta tarea.

- [Compartir invitaciones y desplegar el ensayo en Vercel](docs/DEPLOYMENT.md)
- [Guardia: migración incremental y provisión segura](docs/GUARD_SETUP.md)
- [Escáner QR, entradas/salidas y pruebas con dispositivos](docs/GUARD_SCANNING.md)
- [Configuración base para instalaciones nuevas](docs/SHARED_BACKEND_SETUP.md)
- [Estado y límites de la entrega](docs/PROTOTYPE_STATUS.md)
- [Pruebas manuales y datos](docs/PROTOTYPE_TESTING.md)
- [Plan original y decisiones de integración](docs/SHARED_BACKEND_PLAN.md)
- [Migraciones y auditoría SQL](supabase/README.md)
- [Contratos de services](src/services/README.md)

Sin commit, push, importación automática de datos ni cambios remotos.

