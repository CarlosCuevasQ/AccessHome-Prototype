# AccessHome

Prototipo universitario en React, Vite y TypeScript. Conserva las pantallas de administración, residencia, contactos, invitaciones/QR, historial y reportes.

La integración con Supabase está implementada y probada localmente. **No se han aplicado migraciones ni probado cuentas contra tu proyecto remoto.** Las ocho migraciones pendientes ya incluyen la [revisión de seguridad y concurrencia](docs/SQL_MIGRATION_REVIEW.md). La activación requiere la configuración y verificación descritas en [SHARED_BACKEND_SETUP.md](docs/SHARED_BACKEND_SETUP.md).

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
| Guardia | Reservado: sin sesión operativa ni RPCs de gestión en esta etapa |
| Visitante | Solo proyección de su invitación mediante token; sin acceso general a tablas |

Las políticas RLS limitan lecturas; ningún cliente tiene INSERT/UPDATE/DELETE general. Los RPCs de escritura autorizan identidad y pertenencia, con transacciones. Un perfil inactivo o residente sin habitante activo queda bloqueado. La provisión inicial y vinculación de cuentas se ejecutan de forma controlada, fuera del frontend.

Los RPCs expuestos son SECURITY INVOKER. La lógica privilegiada está en accesshome_private, con autorización interna y EXECUTE específico; ese esquema permanece fuera de Data API.

## Configuración compartida

1. Preparar el proyecto de ensayo y completar .env.local con URL y clave **sb_publishable_** reales.
2. Aplicar las ocho migraciones, en orden, **solo cuando se autorice esa fase remota**.
3. Exponer el esquema `accesshome`; nunca `accesshome_private` ni `auth`.
4. Crear usuarios Auth con contraseñas individuales y sembrar/vincular sus UUID mediante el procedimiento controlado.
5. Reiniciar Vite. Después de las migraciones, `npm run backend:check` verifica conectividad y versión del esquema sin modificar datos.
6. Ejecutar el recorrido de dos navegadores de [PROTOTYPE_TESTING.md](docs/PROTOTYPE_TESTING.md).

No poner secretos administrativos, claves service_role ni contraseñas en Vite. La configuración rechaza claves distintas de publishable antes de construir el bundle. No se incluye registro abierto, recuperación de contraseña ni provisión Auth desde las pantallas.

## Invitaciones y actualización

El servidor genera tokens públicos de 32 bytes con pgcrypto, separados del UUID interno. La creación conserva snapshots y puede guardar el contacto en la misma transacción. El detalle autorizado recupera el token; los listados no exponen tokens públicos de otras casas.

Un mismo contacto no puede tener invitaciones activas con periodos superpuestos en la misma residencia, incluso con altas concurrentes. Se permiten periodos consecutivos y reutilizar contactos de invitaciones canceladas, completadas o ya vencidas. No se compara por nombre ni se deduplican visitantes sin contacto.

El enlace del visitante consulta la misma base desde cualquier dispositivo con acceso al frontend. Nunca se importa la base local para resolver el QR. El endpoint público tiene una proyección limitada y control básico de frecuencia en SQL (256 buckets, 240 consultas por minuto y bucket); no abre tablas. No hay protección completa contra ataques distribuidos.

Las consultas refrescan al abrir la pantalla, recuperar foco o conexión y después de escrituras locales. Las pantallas que ya actualizaban automáticamente consultan cada 10 segundos en compartido, solo si están visibles. No se usa Realtime ni infraestructura adicional. Los dashboards agregan en SQL y devuelven solo cinco movimientos recientes.

El control administrativo existente registra entrada/salida transaccionalmente, con bloqueo e idempotencia de reintentos. No se implementó el módulo del guardia.

En la demo local, los identificadores se generan con Web Crypto comprobando disponibilidad; se eliminó el fallback de Math.random/timestamp. Los tokens locales históricos no se publican ni migran automáticamente.

## Verificación y documentación

```sh
npm test
npm run test:concurrency
npm run build
npm run preview
```

Las pruebas incluyen regresión local, PostgreSQL/PGlite con pgcrypto, RLS, RPCs, snapshots, límites públicos y cliente Supabase con HTTP simulado. test:concurrency ejecuta además PostgreSQL nativo temporal con conexiones independientes, sin leer .env.local ni aceptar destinos remotos. No sustituyen las pruebas de Auth y PostgREST contra el proyecto remoto.

- [Configuración y usuarios seguros](docs/SHARED_BACKEND_SETUP.md)
- [Estado y límites de la entrega](docs/PROTOTYPE_STATUS.md)
- [Pruebas manuales y datos](docs/PROTOTYPE_TESTING.md)
- [Plan original y decisiones de integración](docs/SHARED_BACKEND_PLAN.md)
- [Migraciones y auditoría SQL](supabase/README.md)
- [Contratos de services](src/services/README.md)

Sin commit, push, importación automática de datos ni cambios remotos.

