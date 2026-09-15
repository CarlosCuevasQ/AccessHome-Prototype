# AccessHome

Prototipo funcional para una presentación universitaria sobre seguridad residencial. React, Vite, TypeScript y React Router, con persistencia local y sin backend ni servicios externos.

## Estado actual

Etapa 4: contactos frecuentes privados, conservando el modelo de responsabilidades de la comunidad:

- **Administrador:** crea residencias, edita número/calle y estado, asigna o cambia al principal y consulta habitantes y vehículos.
- **Residente principal:** administra habitantes y vehículos de su casa, además de su agenda privada de contactos frecuentes. Puede crear, consultar, editar, desactivar y reactivar registros.
- **Habitante adicional:** puede existir sin cuenta. Las cuentas adicionales conservadas de etapas anteriores solo consultan su casa hasta que el administrador las designe como principal.

Los permisos se verifican en las pantallas y en cada operación del servicio. Se mantienen autenticación, roles, navegación, sesión persistente, restauración y diseño responsive azul con acentos amarillos.

La autenticación es simulada: las contraseñas demo están en el frontend y los datos locales se pueden manipular desde el navegador. Utiliza datos ficticios. No hay seguridad de servidor.

## Ejecutar

Requisito: Node.js `^20.19.0` o `>=22.12.0` y npm. Entorno verificado: Node.js 24.11.0 y npm 11.6.1.

```sh
npm install
npm run dev
```

Abre [AccessHome local](http://127.0.0.1:5173). El puerto es fijo; si ya hay una instancia activa, abre esa instancia.

```sh
npm run build
npm test
npm run preview
```

Build comprueba TypeScript y genera `dist/`. Preview sirve el build en [http://127.0.0.1:4173](http://127.0.0.1:4173). Estos comandos no publican el sitio.

## Rutas

| Ruta | Función |
| --- | --- |
| `/`, `/login` | Login; con sesión redirige al inicio del rol |
| `/admin` | Resumen y datos básicos del condominio |
| `/admin/residencias` | Listado, búsqueda y alta de casas |
| `/admin/residencias/:residenceId` | Estructura, estado, asignación del principal y consulta de habitantes/vehículos |
| `/residente` | Mi residencia; gestión si el usuario es su principal y la casa está activa |
| `/residente/contactos` | Agenda privada: listado, buscador y alta de contactos |
| `/residente/contactos/:contactId` | Detalle y edición del contacto y sus vehículos |
| `/residente/contactos/:contactId/invitar` | Pantalla preparada; no crea invitaciones ni autoriza accesos |
| `/admin/perfil`, `/residente/perfil` | Perfil del usuario autenticado |
| Ruta desconocida | Página 404, dentro del layout cuando corresponde |

Sin sesión se redirige al login; un rol incompatible vuelve a su inicio con aviso.

## Datos de prueba

| Perfil | Correo | Contraseña |
| --- | --- | --- |
| Administrador Demo | `admin@accesshome.demo` | `Access123` |
| Daniel Cuevas, principal de Casa 24 | `residente@accesshome.demo` | `Access123` |
| Mariana Torres, habitante con cuenta de consulta | `mariana@accesshome.demo` | `Access123` |

Semilla de **Residencial Los Robles**: cuatro casas activas, ocho habitantes y cinco vehículos (cuatro activos).

| Casa | Principal | Otros habitantes | Vehículos |
| --- | --- | --- | --- |
| 12 | Ana López | Jorge Mendoza | `DEMO-012`, Kia Rio azul |
| 24 | Daniel Cuevas | Mariana Torres, Andrea Cuevas, Carlos Cuevas | `DEMO-024`, Nissan Versa gris; `DEMO-124`, Toyota Corolla blanco, inactivo |
| 37 | Luis Herrera | — | `DEMO-037`, Mazda CX-5 rojo |
| 51 | Elena Ríos | — | `DEMO-051`, Honda CR-V plata, sin propietario |

Andrea y Carlos no tienen cuenta. Agregar un habitante no crea credenciales. Su correo opcional es de contacto: editarlo no cambia el correo de acceso de una cuenta existente.

Al asignar un principal, el administrador puede elegir un habitante activo de esa casa o registrar al nuevo principal. Si necesita cuenta, se crea con correo único y contraseña demo `Access123`. Si ya tiene cuenta, se conserva. El principal anterior queda como habitante de consulta; no se trasladan cuentas entre casas.

Los vehículos pertenecen a la residencia. Su propietario opcional debe ser un habitante de esa misma casa. Se usa desactivación reversible para conservar registros. El principal actual no puede desactivarse hasta que la administración nombre a su reemplazo. Una casa inactiva permite consulta y bloquea su gestión cotidiana hasta reactivarse.

## Contactos frecuentes

Entra con Daniel (`residente@accesshome.demo` / `Access123`) y abre **Contactos frecuentes** en el menú. En móvil, pulsa primero **Abrir menú**.

| Contacto demo | Teléfono | Vehículos del contacto |
| --- | --- | --- |
| Carlos López | 3312345678 | Mazda 3 · `JKL-1234` |
| María González | Opcional, sin registrar | Sin vehículos |
| Pedro Ramírez | Opcional, sin registrar | Nissan Versa · `HJK-7821` |

1. Pulsa **Nuevo contacto**; solo el nombre es obligatorio. Teléfono, correo y notas son opcionales.
2. Al guardar se abre su detalle. Pulsa **Agregar vehículo**; solo las placas son obligatorias. Puedes registrar varios.
3. Usa **Editar contacto** o **Editar** junto a un vehículo para cambiar datos o seleccionar Inactivo. Los datos se conservan y pueden reactivarse.
4. Busca por nombre, teléfono, correo o placas. La búsqueda ignora mayúsculas y acentos e incluye contactos inactivos.
5. **Invitar** abre la pantalla de la próxima etapa. No crea una invitación, QR ni autorización de acceso. El botón se deshabilita para contactos o residencias inactivos.

Los contactos pertenecen a la cuenta del principal y no se comparten con el administrador ni con otros residentes, incluso de su misma casa. Si cambia el principal, su agenda no se transfiere: queda conservada para su propietario, que volverá a acceder si recupera la condición de principal. Una casa inactiva permite consultar la agenda, pero no modificarla.

Los vehículos del contacto se guardan dentro del contacto, separados de `vehicles`, que contiene los vehículos permanentes de las casas. Las placas no pueden repetirse dentro de un contacto; sí pueden figurar en otra agenda o registro sin que eso conceda acceso permanente.

La verificación dejó un contacto adicional de Daniel: **Laura Sánchez Ruiz**, teléfono ficticio `3312345099`, con `LRS-9001` (Mazda 3 azul, inactivo) y `LRS-9002` (Honda Civic, activo). El contacto quedó activo. Usa otros nombres/placas si repites pruebas; no hace falta restaurar.

## Eliminar contactos y vehículos

Con la cuenta de Daniel (`residente@accesshome.demo` / `Access123`):

- **Contacto:** Contactos frecuentes → Ver → Eliminar contacto. La confirmación indica que también se eliminarán todos sus vehículos. Al confirmar, vuelve al listado.
- **Vehículo de contacto:** abrir el contacto → Eliminar vehículo junto a sus placas → Confirmar eliminación.
- **Vehículo permanente:** Mi residencia → Ver detalle del vehículo → Eliminar vehículo → Confirmar eliminación.

Cancelar conserva los datos. La eliminación es definitiva en los datos locales y se mantiene al recargar; desactivar/reactivar sigue disponible como alternativa. Eliminar un vehículo no elimina al contacto, la casa ni sus habitantes. Se mantienen los permisos: solo el principal de una casa activa puede borrar vehículos de esa casa y únicamente contactos/vehículos de su propia agenda. El administrador continúa en consulta para estos registros.

Las pruebas automatizadas utilizan datos aislados para verificar borrado, permisos, persistencia y fallos de escritura. En el navegador se comprobaron confirmaciones y cancelación sin eliminar los registros existentes.

## Prueba rápida de comunidad

1. Entra como administrador, abre **Residencias → Agregar residencia** y crea Casa `91`, calle `Circuito Cedros`.
2. Abre Casa 91, pulsa **Asignar residente principal** y registra a **Sofía Ramos**, correo `sofia91@accesshome.demo`. Comprueba que solo aparecen acciones administrativas y de consulta.
3. Cierra sesión y entra con esa cuenta y `Access123`: podrá gestionar exclusivamente Casa 91.
4. Entra como Daniel. En Casa 24, pulsa **Agregar habitante** y registra **Elena Cuevas**, sin correo obligatorio. Abre **Ver detalle → Editar habitante** y cambia teléfono, apellido o estado.
5. Pulsa **Registrar vehículo**: `DEMO-324`, Mazda, 3, Azul, propietario Elena. Abre su detalle, edita el color y desactívalo. Recarga para comprobar persistencia.
6. Con Daniel, intenta abrir `/admin/residencias/house-12`: vuelve a su casa con aviso. Las llamadas directas del servicio contra otra casa también se rechazan; hay un ejemplo en la guía de pruebas.
7. Entra como administrador y consulta Casa 24: verás los cambios, sin botones para agregar o editar habitantes/vehículos.

Si un número, correo o placas ya existen, utiliza otros. Durante la verificación se conservaron Casa 90 / Sofía Ramos (`sofia90@accesshome.demo`), Lucía Cuevas Pérez y `DEMO-224` en Casa 24. No se reiniciaron los datos anteriores del navegador.

## Persistencia y restauración

Solo `services/demoStorage.ts` accede a localStorage, bajo `accesshome.demo.v1`. El esquema interno es **versión 4**. La migración desde versión 3 conserva íntegramente la comunidad, los principales asignados, los estados y la sesión; añade una sola vez los tres contactos demo a Daniel. Las versiones 1/2 pasan además por la migración de habitantes y principales de la etapa anterior. Las agendas existentes en versión 4 no se reinician al recargar. Restaurar datos demo también restaura contactos y sus vehículos.

La migración desde versión 1 también conserva Casa 25 y completa los datos demo de la etapa anterior. Por eso una instalación migrada puede tener más casas y cantidades distintas de la semilla.

Para recuperar la semilla exacta: cierra sesión y usa **Restaurar datos demo → Confirmar restauración** en el login. `demoService.resetDemoData()` reemplaza todos los datos del prototipo y cierra la sesión; conserva las claves de otras aplicaciones. Los datos corruptos no se sobrescriben automáticamente y los fallos de almacenamiento se muestran como errores.

La sesión no caduca automáticamente. Los cambios y el logout se comparten entre pestañas del mismo origen; `localhost`, `127.0.0.1` y otros puertos tienen almacenamientos independientes.

## Organización

```text
src/
  components/   Navegación, rutas protegidas, formularios, tablas y detalles
  layouts/      Público, administrador y residente
  pages/        Login, condominio, residencias, perfil y 404
  services/     Contratos asíncronos, permisos, autenticación y persistencia
  data/         Semilla y navegación
  types/        Cuentas, condominio, casas, habitantes y vehículos
  hooks/        Sesión, consultas y título de página
  utils/        Destino por rol y nombres de habitantes
  styles/       Estilos globales y responsive
  router.tsx    Rutas principales
```

`communityService` ofrece las consultas y operaciones estructurales; delega la gestión de habitantes/vehículos a `householdService` y la asignación a `principalService`. `communityRules` resuelve al usuario desde la sesión persistida, verifica principal/casa/estado y valida campos, números, correos y placas. Las pantallas no eligen el usuario que autoriza una operación. Las consultas no devuelven contraseñas.

`contactsService` concentra consultas y modificaciones de agenda, con validación del principal y propietario en cada llamada. Los componentes consumen contratos asíncronos y notificaciones de los servicios; una futura API podrá sustituir su implementación sin trasladar persistencia a las pantallas. No se añaden dependencias de componentes ni recursos externos.

## Verificación y documentación

`npm test` ejecuta **51 pruebas** con TypeScript y el ejecutor nativo de Node: autenticación, permisos de lectura/escritura, asignación y revocación del principal, desactivación, duplicados, privacidad de contactos, separación de vehículos, migraciones, restauración y errores de almacenamiento. Build y recorridos de navegador comprobados; guía acumulativa con casos manuales y alcance de la revisión.

- [Estado y checklist de fases](docs/PROTOTYPE_STATUS.md)
- [Guía acumulativa de pruebas](docs/PROTOTYPE_TESTING.md)
- [Contratos y reglas de servicios](src/services/README.md)

Siguen pendientes la creación de invitaciones, el registro de accesos y los reportes. No se ha iniciado el siguiente módulo ni se han realizado commits o push.
