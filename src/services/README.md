# Servicios

Las pantallas consumen contratos asíncronos. Solo `demoStorage.ts` lee/escribe localStorage; una futura API puede sustituir la implementación de estos contratos.

| Servicio | Responsabilidad |
| --- | --- |
| `authService` | Login, logout, sesión pública sin contraseña y suscripción a cambios. Rechaza cuentas de habitantes inactivos. |
| `demoService` | Ayuda de credenciales, contexto propio y restauración de la semilla completa. |
| `demoStorage` | Clave `accesshome.demo.v1`, lectura validada, escritura y notificaciones locales/entre pestañas. |
| `demoValidation` / `demoMigration` | Valida esquema 4 y relaciones; migra versiones 1/2/3 conservando datos y sesión. |
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

La migración convierte usuarios residentes anteriores en habitantes, conserva propietarios y asigna un principal a cada casa con residentes. Los vehículos sin propietario permanecen sin asignar. El esquema 4 mantiene la clave histórica y conserva la migración previa de comunidad. Las cuentas y la sesión se conservan.

`resetDemoData()` reemplaza todos los datos propios, incluidas asignaciones, habitantes y estados, por una copia de la semilla. Cierra sesión y conserva claves de otras aplicaciones; nunca llama `localStorage.clear()`.

`AuthProvider` y `useCommunityQuery` escuchan notificaciones. La implementación es una simulación local, no una barrera frente a la manipulación directa del navegador; la futura API deberá aplicar estos permisos en el servidor.

## Contactos frecuentes · Etapa 4

- `contactsService`: `getAccess`, `listContacts`, `getContact`, `createContact`, `updateContact`, `createVehicle` y `updateVehicle`. Usa los mismos eventos de persistencia que la comunidad.
- `contactRules`: valida sesión, condición de principal, propietario, actividad de residencia y campos. Todas las operaciones por ID verifican `contact.ownerUserId === session.userId`; actualizar un vehículo comprueba también su pertenencia al contacto.
- `contactValidation`: valida las agendas persistidas, cuentas propietarias, campos, IDs y placas únicas por contacto. La cuenta propietaria puede dejar de ser principal sin invalidar sus datos conservados.
- `types/contacts.ts`: contactos y vehículos de contacto separados del vehículo permanente. `DemoDatabase.contacts` contiene agendas; cada contacto contiene sus propios vehículos.

No se recibe el propietario desde el formulario. Crear o editar un contacto no crea cuentas, habitantes, vehículos permanentes ni autorizaciones. Marca, modelo y color son opcionales; las placas son obligatorias y se normalizan para evitar duplicados dentro del mismo contacto. Contactos y vehículos se desactivan y reactivan mediante edición del estado, con eliminación definitiva adicional disponible mediante los métodos de borrado.

El administrador y las cuentas adicionales no acceden a estas consultas. Un principal de casa inactiva solo puede consultar su agenda. Cambiar de principal revoca el acceso del anterior y no transfiere sus contactos al nuevo principal. La UI refleja estas reglas, pero los servicios las revalidan siempre.

El esquema 4 añade los contactos demo al migrar desde el esquema 3 sin modificar la comunidad previa; mantiene la clave histórica. La restauración incluye toda la agenda. La ruta `contactos/:contactId/invitar` consulta un contacto propio y solo muestra una pantalla informativa de la próxima etapa.

## Eliminación definitiva

`contactsService.deleteContact(id)` valida al propietario principal y elimina el contacto completo, incluidos sus vehículos anidados. `contactsService.deleteVehicle(contactId, id)` elimina solo el vehículo de ese contacto. `householdService.deleteVehicle(residenceId, id)`, expuesto por `communityService`, elimina solo un vehículo permanente de la casa autorizada. Los tres requieren residencia activa y rechazan registros inexistentes/ajenos, administrador, cuentas adicionales y sesiones no válidas.

La escritura y notificación mantienen el comportamiento existente: si falla `setItem`, los datos anteriores permanecen y no se notifica éxito. No cambia el esquema. No se crean funciones para eliminar casas ni habitantes. `DeleteAction` confirma la operación en la interfaz y permite cancelar; el servicio no depende de la visibilidad de ese control para autorizar la acción.
