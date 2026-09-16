# Servicios

Las pantallas consumen contratos asíncronos. Solo `demoStorage.ts` lee/escribe localStorage; una futura API puede sustituir la implementación de estos contratos.

## Preparación del backend compartido

La implementación de servicios sigue siendo local. El [plan de Supabase](../../docs/SHARED_BACKEND_PLAN.md) identifica qué sustituir detrás de estos contratos y qué autorización pasará a la base. El [SQL versionado](../../supabase/README.md) está preparado sin aplicar; `.env.example` no activa ningún adaptador.

La integración mantendrá DTOs independientes del SDK y convertirá nombres/campos dentro de `services`. Auth real sustituirá `DemoAccount.password` y la sesión local. Asignaciones, snapshots, usos, movimientos y cambios de estado requerirán RPCs autorizados; no se traducirá la escritura de todo `DemoDatabase` a un `upsert` remoto. Los helpers actuales continúan útiles como validación de UI, pero no protegerán el backend.

La demo y el modo integrado deberán tener proveedores separados, sin fallback silencioso ante fallo remoto. `resetDemoData()` permanece exclusivo de la demo; el futuro SDK y los tipos de filas SQL no se importarán desde las pantallas. Los eventos actuales de `communityService.subscribe` deberán desacoplarse al incorporar suscripciones del proveedor. La futura API Django podrá implementar los mismos contratos de dominio.

## Servicios actuales

| Servicio | Responsabilidad |
| --- | --- |
| `authService` | Login, logout, sesión pública sin contraseña y suscripción a cambios. Rechaza cuentas de habitantes inactivos. |
| `demoService` | Ayuda de credenciales, contexto propio y restauración de la semilla completa. |
| `demoStorage` | Clave `accesshome.demo.v1`, lectura validada, escritura y notificaciones locales/entre pestañas. |
| `demoValidation` / `demoMigration` | Valida esquema 7 y relaciones; migra versiones 1–6 conservando datos y sesión. |
| `accessHistoryService` | Historial autorizado, búsqueda y filtros por residencia, movimiento y día local. |
| `reportsService` | Creación y consulta privada de reportes; avance de estado administrativo. |
| `dashboardService` | Indicadores y actividad reciente calculados desde los datos permitidos a la sesión. |
| `communityService` | Resumen/listado administrativo, detalle autorizado y operaciones de estructura. Expone las operaciones de los dos servicios siguientes. |
| `principalService` | Asignación administrativa de principal existente de esa casa o creación de principal con cuenta demo. |
| `householdService` | Alta/edición de habitantes y vehículos por el principal de su propia casa activa. Las bajas son cambios de estado reversibles. |
| `communityRules` | Resuelve usuario desde sesión, valida rol, pertenencia, principal, actividad, campos y duplicados. |

## Permisos

Ninguna operación recibe el usuario que concede autorización desde un componente. Cada operación lee la sesión persistida y vuelve a verificar permisos. Un ID de residencia enviado por la pantalla no concede acceso.

- Administrador: estructura y asignación dentro de su condominio; consulta todas sus casas. Los métodos cotidianos rechazan su rol.
- Principal activo: gestión cotidiana solo si la residencia coincide con `user.residenceId`, `residence.principalUserId` coincide con su ID y la casa está activa.
- Cuenta adicional activa: consulta exclusivamente su casa. Una casa inactiva también queda en consulta.
- Cuenta de habitante inactivo: no obtiene sesión ni accede a consultas protegidas.
- Actualizar un habitante/vehículo comprueba tanto la casa autorizada como la pertenencia del registro. Se copian únicamente campos editables; IDs, rol, cuenta y casa no se cambian desde formularios cotidianos.

## Integridad

`Residence.principalUserId` referencia una cuenta residente; `Inhabitant.userId` es opcional y permite conservar cuentas anteriores sin exigir autenticación para nuevos habitantes. `Vehicle.ownerId` referencia un habitante de su misma residencia, no una cuenta.

Asignar un habitante sin cuenta crea la cuenta necesaria con correo único y la contraseña demo centralizada. Elegir uno con cuenta la conserva. El principal anterior permanece en su casa con consulta; nunca se trasladan usuarios entre casas. El principal no puede desactivarse antes de ser reemplazado por el administrador.

El correo del habitante es de contacto y no cambia credenciales. El nombre de una cuenta vinculada se actualiza al editar el nombre del habitante. Desactivar un habitante conserva su relación con los vehículos; la interfaz identifica a propietarios inactivos.

Número de casa único por condominio; correo de acceso único entre cuentas; placas únicas por condominio ignorando mayúsculas, espacios y guiones. Se validan campos y estado antes de escribir.

## Persistencia

La escritura completa se hace con un único `setItem`; el servicio solo notifica después de guardar. Si falla, devuelve error y conserva los datos almacenados. No hay escrituras parciales de principal, cuenta y habitante.

La migración convierte usuarios residentes anteriores en habitantes, conserva propietarios y asigna un principal a cada casa con residentes. Los vehículos sin propietario permanecen sin asignar. El esquema 7 conserva la clave histórica y las migraciones anteriores; desde v4 se añaden invitaciones, desde v5 movimientos vacíos y desde v6 reportes vacíos. Cuentas, comunidad, agenda, bajas, invitaciones, movimientos y sesión se conservan. No se inventan accesos históricos para usos que ya existieran en v5.

`resetDemoData()` reemplaza todos los datos propios, incluidas asignaciones, habitantes y estados, por una copia de la semilla. Cierra sesión y conserva claves de otras aplicaciones; nunca llama `localStorage.clear()`.

`AuthProvider` y `useCommunityQuery` escuchan notificaciones. La implementación es una simulación local, no una barrera frente a la manipulación directa del navegador; la futura API deberá aplicar estos permisos en el servidor.

## Contactos frecuentes · Etapa 4

- `contactsService`: `getAccess`, `listContacts`, `getContact`, `createContact`, `updateContact`, `createVehicle` y `updateVehicle`. Usa los mismos eventos de persistencia que la comunidad.
- `contactRules`: valida sesión, condición de principal, propietario, actividad de residencia y campos. Todas las operaciones por ID verifican `contact.ownerUserId === session.userId`; actualizar un vehículo comprueba también su pertenencia al contacto.
- `contactValidation`: valida las agendas persistidas, cuentas propietarias, campos, IDs y placas únicas por contacto. La cuenta propietaria puede dejar de ser principal sin invalidar sus datos conservados.
- `types/contacts.ts`: contactos y vehículos de contacto separados del vehículo permanente. `DemoDatabase.contacts` contiene agendas; cada contacto contiene sus propios vehículos.

No se recibe el propietario desde el formulario. Crear o editar un contacto no crea cuentas, habitantes, vehículos permanentes ni autorizaciones. Marca, modelo y color son opcionales; las placas son obligatorias y se normalizan para evitar duplicados dentro del mismo contacto. Contactos y vehículos se desactivan y reactivan mediante edición del estado, con eliminación definitiva adicional disponible mediante los métodos de borrado.

El administrador y las cuentas adicionales no acceden a estas consultas. Un principal de casa inactiva solo puede consultar su agenda. Cambiar de principal revoca el acceso del anterior y no transfiere sus contactos al nuevo principal. La UI refleja estas reglas, pero los servicios las revalidan siempre.

El paso de esquema 3 a 4 añade contactos demo sin modificar la comunidad previa; después se migra hasta v7. La restauración incluye toda la agenda. La ruta `contactos/:contactId/invitar` utiliza el formulario funcional de invitaciones.

## Invitaciones · Etapa 5

`invitationsService` expone `getContext`, `listInvitations(search, status)`, `getInvitation(id)`, `createInvitation(input)` y `cancelInvitation(id)`. No hay edición general ni eliminación de invitaciones. La incorporación pública de vehículo y el consumo de usos tienen contratos específicos descritos en la etapa 6.

- Cada operación resuelve la sesión y limita la consulta a `user.residenceId`. Crear/cancelar exige principal vigente y residencia activa; una cuenta adicional activa puede consultar su casa.
- `InvitationInput` no recibe residencia, invitador, token, estado ni usos. El servicio fija esos campos; rechaza explícitamente una residencia ajena añadida a una llamada manipulada. El token se genera con `generateId()` y se verifica que no se repita. La utilidad prioriza UUID nativo, UUID v4 con `getRandomValues` y finalmente timestamp/contador/aleatorio para el prototipo. Las entidades también usan esta utilidad; ninguna invoca directamente `randomUUID`.
- Desde contacto, se valida propietario/estado y vehículo activo perteneciente a ese contacto. `invitationSnapshot` copia nombre, teléfono y todos los campos del vehículo elegido a un objeto nuevo. `contactId` queda como origen opcional, sin usarlo para reconstruir la historia ni exigir que siga existiendo. No se copian notas/correo privados del contacto.
- También se copian nombre del invitador y nombre de la casa. Los permisos usan IDs actuales; los nombres históricos no cambian al editar la comunidad.
- Para ocasionales se validan nombre y vehículo opcional. Placas obligatorias si hay vehículo, marca/modelo/color opcionales. Guardar contacto opcional e invitación se hace en una sola escritura; no crea cuenta, habitante ni vehículo permanente.
- `startsAt`, `expiresAt`, `createdAt` son ISO; `vehicle` es nulo o contiene `plates`, `brand`, `model`, `color`. `maxUses = 2`, `usedUses = 0` al crear.
- `invitationRules` calcula vigencia local Hoy / duración de 24 horas / rango personalizado. Estado efectivo: respeta canceladas/completadas/expiradas; para una activa, primero completa si agotó usos y después expira si alcanzó el fin. La consulta no reescribe datos. Las pantallas vuelven a consultar cada segundo; cancelación revalida el tiempo actual aunque la pantalla estuviera desactualizada.
- Una invitación futura permanece Activa, con inicio programado. `accessService` también comprueba `startsAt`; el QR visual no autoriza por sí solo.

`invitationValidation` valida la colección persistida, IDs/tokens únicos, referencias, fechas, usos y campos. El reset vacía las invitaciones junto con la restauración completa de los datos demo.

## Vista pública y accesos · Etapa 6

`publicInvitationService.getInvitation(token)` no exige sesión. Devuelve explícitamente token, nombre del visitante, nombres de casa/anfitrión, vigencia, vehículo, estado, usos y `canAddVehicle`. No expone teléfono, correo, IDs de cuentas/casas/contactos, habitantes ni notas. Conocer un token es la capacidad conceptual para consultar esa invitación, por lo que no hay un listado público.

`addVehicle(token, vehicle)` es la única modificación pública: requiere invitación activa, casa activa, `vehicle === null` y `usedUses === 0`. Valida placas y copia solo los cuatro campos del vehículo. Permite prepararlo antes del inicio programado. No permite sustituir un vehículo existente ni cambiarlo tras entrada, cancelación, expiración o finalización. El vehículo se incorpora a la copia de la invitación, nunca a la agenda/comunidad.

`accessService` ofrece `listActiveInvitations`, `listAccessRecords` y `validateToken`. Las tres operaciones exigen administrador y filtran por su condominio. Un token de otro condominio se trata como inexistente, sin exponer sus datos. El selector incluye activas futuras; seleccionar no autoriza ni consume usos.

Validar vuelve a leer datos y tiempo actual. Rechaza tokens inexistentes, canceladas, completadas/usos agotados, expiradas, inicio futuro y residencia inactiva. El intervalo es `startsAt <= ahora < expiresAt`. No registra rechazos. En un éxito genera un `AccessRecord` independiente, marca entrada con uso previo 0 o salida con 1, incrementa usos y completa tras el segundo. Record y contador se guardan con el mismo `setItem`; solo después se notifica y devuelve autorización. No hay esperas entre lectura y escritura de una validación local.

El registro contiene ID propio, ID de invitación, visitante, ID/nombre de casa, ID/nombre de anfitrión, vehículo/placas opcional, tipo, método `QR`, fecha ISO y `authorized: true`. `accessValidation` valida forma/referencias, fechas, IDs, método/autorización y movimientos duplicados. El historial no reconstruye datos desde contactos. La migración v5→v6 no modifica tokens ni invitaciones y el reset también vacía los movimientos.

La generación del QR es presentación: `InvitationQr` usa la URL construida por `utils/invitationLinks.ts` y `qrcode.react`, sin llamadas externas. Los datos del QR no son una fuente de autorizaciones ni incluyen datos personales: solo la URL con token. La vista pública escucha cambios locales/entre pestañas; no sincroniza dispositivos. La persistencia y los permisos siguen siendo simulados; una API deberá aplicar validación y transacciones de servidor para múltiples puestos simultáneos.

## Historial, reportes e indicadores · Etapa 7

`accessHistoryService.getContext()` entrega únicamente los IDs/nombres de casas permitidas; `listRecords(filters)` vuelve a resolver la sesión y restringe registros antes de aplicar filtros. El administrador consulta su condominio y el residente exclusivamente su casa y las invitaciones dirigidas a ella, incluidos movimientos anteriores a un cambio de principal. Una residencia ajena enviada como filtro se rechaza. El servicio administrativo de validación de tokens conserva sus permisos originales.

`accessHistoryRules` comparte este alcance con los dashboards. Busca sin distinguir acentos o mayúsculas en visitante, nombre de casa, anfitrión y placas. Los filtros se combinan con AND. `from` y `to` son días locales YYYY-MM-DD, ambos incluidos; límites inválidos o invertidos se rechazan. Se leen snapshots de movimientos autorizados, sin reconstruirlos desde la agenda ni cambiar el estado histórico por una cancelación posterior.

`reportsService` ofrece `getContext`, `listReports`, `getReport`, `createReport` y `updateStatus`. `reportRules` limita por condominio y, para residentes, por casa y autor. Crear exige principal actual y casa activa, como el resto de la gestión cotidiana; las cuentas adicionales conservan consulta. El input contiene solo título (1–120), categoría y descripción (1–3000). El servicio fija autor, destino, fechas y Pendiente, y rechaza una residencia ajena inyectada. Los nombres se copian al crear; los permisos usan IDs. Las categorías se centralizan en `types/reports.ts`.

Actualizar estado exige administrador del mismo condominio y el siguiente paso exacto: `pendiente → en_proceso → completado`. No hay edición de contenido ni reapertura. Cada operación escribe una sola vez y solo anuncia éxito después de persistir. `reportValidation` comprueba campos, fechas, estados, IDs únicos y relaciones. Migrar v6 conserva el historial existente y añade `reports: []`; reset vacía también reportes.

`dashboardService.getAdminDashboard()` calcula seis indicadores en el condominio y los últimos cinco movimientos. `getResidentDashboard()` aplica el alcance de su casa y la privacidad por autor en reportes. Vehículos significa permanentes activos/inactivos, sin agenda; habitantes activos solo se filtran en el dashboard admin. Accesos de hoy cuenta entrada y salida en el día local; visitas recientes cuenta entradas en siete días naturales, incluido hoy. Pendientes excluye En proceso y Completado. Invitaciones activas usa `invitationStatus` y admite futuras. No se guardan totales precalculados. Las pantallas escuchan cambios y los dashboards revisan vigencias cada segundo.

## Eliminación definitiva

`contactsService.deleteContact(id)` valida al propietario principal y elimina el contacto completo, incluidos sus vehículos anidados. `contactsService.deleteVehicle(contactId, id)` elimina solo el vehículo de ese contacto. `householdService.deleteVehicle(residenceId, id)`, expuesto por `communityService`, elimina solo un vehículo permanente de la casa autorizada. Los tres requieren residencia activa y rechazan registros inexistentes/ajenos, administrador, cuentas adicionales y sesiones no válidas.

La escritura y notificación mantienen el comportamiento existente: si falla `setItem`, los datos anteriores permanecen y no se notifica éxito. No cambia el esquema. No se crean funciones para eliminar casas ni habitantes. `DeleteAction` confirma la operación en la interfaz y permite cancelar; el servicio no depende de la visibilidad de ese control para autorizar la acción.
