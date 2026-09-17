# AccessHome

Prototipo universitario en React, Vite y TypeScript. Conserva las pantallas de administración, residencia, contactos, invitaciones/QR, historial y reportes.

La integración base con Supabase, las ocho migraciones iniciales y las cuentas reales ya funcionan en el proyecto de ensayo, según la confirmación del responsable. **La nueva etapa de Guardia está implementada y probada localmente; su migración incremental todavía no se aplicó al proyecto remoto.** Consulta [GUARD_SETUP.md](docs/GUARD_SETUP.md) para activarla y vincular una cuenta Auth sin repetir la semilla ni modificar datos existentes.

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
| Guardia | Panel `/guardia` e historial mínimo del propio condominio; sin gestión administrativa, escrituras ni validación de accesos en esta etapa |
| Visitante | Solo proyección de su invitación mediante token; sin acceso general a tablas |

Las políticas RLS limitan lecturas; ningún cliente tiene INSERT/UPDATE/DELETE general. Los RPCs de escritura autorizan identidad y pertenencia, con transacciones. Un perfil inactivo o residente sin habitante activo queda bloqueado. La provisión inicial y vinculación de cuentas se ejecutan de forma controlada, fuera del frontend.

Los RPCs expuestos son SECURITY INVOKER. La lógica privilegiada está en accesshome_private, con autorización interna y EXECUTE específico; ese esquema permanece fuera de Data API.

## Configuración compartida

La configuración existente de `.env.local`, las ocho migraciones y los datos se conservan. Para esta etapa el responsable debe aplicar únicamente `20260917000600_guard_workspace.sql`, crear o reutilizar una cuenta Auth individual y vincularla mediante `accesshome_private.provision_guard`. La activación/desactivación usa `set_guard_active`; ambos procedimientos son exclusivos del propietario de migraciones, no del administrador de la aplicación.

Seguir [GUARD_SETUP.md](docs/GUARD_SETUP.md) y el recorrido G-01–G-11 de [PROTOTYPE_TESTING.md](docs/PROTOTYPE_TESTING.md). No volver a ejecutar `seed_demo`. `npm run backend:check` conserva el chequeo base e indica si detecta `guardWorkspaceVersion: 1`; no prueba el login.

Para instalaciones completamente nuevas, [SHARED_BACKEND_SETUP.md](docs/SHARED_BACKEND_SETUP.md) documenta la base inicial. Mantener expuesto `accesshome` y privado `accesshome_private`.

No poner secretos administrativos, claves service_role ni contraseñas en Vite. La configuración rechaza claves distintas de publishable antes de construir el bundle. No se incluye registro abierto, recuperación de contraseña ni provisión Auth desde las pantallas.

## Invitaciones y actualización

El servidor genera tokens públicos de 32 bytes con pgcrypto, separados del UUID interno. La creación conserva snapshots y puede guardar el contacto en la misma transacción. El detalle autorizado recupera el token; los listados no exponen tokens públicos de otras casas.

Un mismo contacto no puede tener invitaciones activas con periodos superpuestos en la misma residencia, incluso con altas concurrentes. Se permiten periodos consecutivos y reutilizar contactos de invitaciones canceladas, completadas o ya vencidas. No se compara por nombre ni se deduplican visitantes sin contacto.

El enlace del visitante consulta la misma base desde cualquier dispositivo con acceso al frontend. Nunca se importa la base local para resolver el QR. El endpoint público tiene una proyección limitada y control básico de frecuencia en SQL (256 buckets, 240 consultas por minuto y bucket); no abre tablas. No hay protección completa contra ataques distribuidos.

Las consultas refrescan al abrir la pantalla, recuperar foco o conexión y después de escrituras locales. Las pantallas que ya actualizaban automáticamente consultan cada 10 segundos en compartido, solo si están visibles. No se usa Realtime ni infraestructura adicional. Los dashboards agregan en SQL y devuelven solo cinco movimientos recientes.

El control administrativo existente registra entrada/salida transaccionalmente, con bloqueo e idempotencia de reintentos. El guardia consulta esos movimientos, con actualización cada 30 segundos mientras el panel/historial esté visible. Muestra nombre, condominio, hora del servidor, accesos de hoy, entradas, salidas y pendientes. El historial abarca siete días y 50 registros por página. **Escanear acceso**, **Registrar servicio** y **Reportes de turno** llevan a estados explícitos de próxima etapa; todavía no registran datos ni solicitan cámara.

En la demo local, los identificadores se generan con Web Crypto comprobando disponibilidad; se eliminó el fallback de Math.random/timestamp. Los tokens locales históricos no se publican ni migran automáticamente.

## Verificación y documentación

```sh
npm test
npm run test:concurrency
npm run build
npm run preview
```

Las pruebas incluyen regresión local, PostgreSQL/PGlite con pgcrypto, RLS, RPCs, snapshots, límites públicos y cliente Supabase con HTTP simulado. test:concurrency ejecuta además PostgreSQL nativo temporal con conexiones independientes, sin leer .env.local ni aceptar destinos remotos. No sustituyen las pruebas de Auth y PostgREST contra el proyecto remoto.

- [Guardia: migración incremental y provisión segura](docs/GUARD_SETUP.md)
- [Configuración base para instalaciones nuevas](docs/SHARED_BACKEND_SETUP.md)
- [Estado y límites de la entrega](docs/PROTOTYPE_STATUS.md)
- [Pruebas manuales y datos](docs/PROTOTYPE_TESTING.md)
- [Plan original y decisiones de integración](docs/SHARED_BACKEND_PLAN.md)
- [Migraciones y auditoría SQL](supabase/README.md)
- [Contratos de services](src/services/README.md)

Sin commit, push, importación automática de datos ni cambios remotos.

