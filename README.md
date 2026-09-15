# AccessHome

Prototipo funcional para una presentación universitaria sobre seguridad residencial. React, Vite, TypeScript y React Router, con persistencia local y sin backend ni servicios externos.

## Estado actual

Etapa 3, con responsabilidades corregidas:

- **Administrador:** crea residencias, edita número/calle y estado, asigna o cambia al principal y consulta habitantes y vehículos.
- **Residente principal:** administra los habitantes y vehículos de su propia residencia activa. Puede agregarlos, consultar su detalle, editarlos, desactivarlos y reactivarlos.
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

## Prueba rápida

1. Entra como administrador, abre **Residencias → Agregar residencia** y crea Casa `91`, calle `Circuito Cedros`.
2. Abre Casa 91, pulsa **Asignar residente principal** y registra a **Sofía Ramos**, correo `sofia91@accesshome.demo`. Comprueba que solo aparecen acciones administrativas y de consulta.
3. Cierra sesión y entra con esa cuenta y `Access123`: podrá gestionar exclusivamente Casa 91.
4. Entra como Daniel. En Casa 24, pulsa **Agregar habitante** y registra **Elena Cuevas**, sin correo obligatorio. Abre **Ver detalle → Editar habitante** y cambia teléfono, apellido o estado.
5. Pulsa **Registrar vehículo**: `DEMO-324`, Mazda, 3, Azul, propietario Elena. Abre su detalle, edita el color y desactívalo. Recarga para comprobar persistencia.
6. Con Daniel, intenta abrir `/admin/residencias/house-12`: vuelve a su casa con aviso. Las llamadas directas del servicio contra otra casa también se rechazan; hay un ejemplo en la guía de pruebas.
7. Entra como administrador y consulta Casa 24: verás los cambios, sin botones para agregar o editar habitantes/vehículos.

Si un número, correo o placas ya existen, utiliza otros. Durante la verificación se conservaron Casa 90 / Sofía Ramos (`sofia90@accesshome.demo`), Lucía Cuevas Pérez y `DEMO-224` en Casa 24. No se reiniciaron los datos anteriores del navegador.

## Persistencia y restauración

Solo `services/demoStorage.ts` accede a localStorage, bajo `accesshome.demo.v1`. El esquema interno es **versión 3**. Migra automáticamente versiones 1 y 2 conservando casas, usuarios, credenciales, vehículos, propietarios, ediciones y sesión. Los antiguos residentes se convierten en habitantes vinculados a su cuenta. Daniel queda como principal de su Casa 24; en las demás casas se asigna al primer residente existente. Las casas sin residentes quedan sin principal. Andrea y Carlos se añaden a la casa de Daniel si faltan.

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

Los componentes consumen contratos asíncronos y notificaciones de los servicios; una futura API podrá sustituir su implementación sin trasladar persistencia a las pantallas. No se añaden dependencias de componentes ni recursos externos.

## Verificación y documentación

`npm test` ejecuta **32 pruebas** con TypeScript y el ejecutor nativo de Node: autenticación, permisos de lectura/escritura, asignación y revocación del principal, desactivación, duplicados, migraciones, restauración y errores de almacenamiento. Build y recorridos de navegador comprobados; guía acumulativa con casos manuales y alcance de la revisión.

- [Estado y checklist de fases](docs/PROTOTYPE_STATUS.md)
- [Guía acumulativa de pruebas](docs/PROTOTYPE_TESTING.md)
- [Contratos y reglas de servicios](src/services/README.md)

Contactos frecuentes, invitaciones, accesos y reportes siguen pendientes. No se ha iniciado el siguiente módulo ni se han realizado commits o push.
