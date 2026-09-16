# AccessHome

Prototipo funcional para una presentación universitaria sobre seguridad residencial. React, Vite, TypeScript y React Router, con persistencia local y sin backend ni servicios externos.

## Estado actual

**Preparación del prototipo integrado:** se inspeccionaron las etapas 1–7 y se preparó [el plan de backend compartido](docs/SHARED_BACKEND_PLAN.md), con tablas, relaciones, Supabase Auth, roles administrador/residente/guardia, RLS, frontera pública por token y adaptación gradual de los servicios. La aplicación sigue usando localStorage; no hay conexión ni migración remota activa.

Etapa 7: historial de accesos, reportes y dashboards calculados desde los datos guardados, conservando las responsabilidades de la comunidad:

- **Administrador:** gestiona la estructura y principales del condominio; consulta habitantes/vehículos, opera Control de acceso, filtra el historial y procesa reportes de su condominio.
- **Residente principal:** administra habitantes, vehículos y su agenda privada; genera y cancela invitaciones, consulta los accesos de su casa y crea/consulta sus propios reportes.
- **Habitante adicional:** puede existir sin cuenta. Las cuentas adicionales conservadas de etapas anteriores solo consultan su casa hasta que el administrador las designe como principal.
- **Visitante:** abre su invitación por token sin iniciar sesión; ve su QR y puede añadir un vehículo si la invitación se creó sin él, antes de la entrada.

Los permisos se verifican en las pantallas y en cada operación del servicio. Se mantienen autenticación, roles, navegación, sesión persistente, restauración y diseño responsive azul con acentos amarillos.

La autenticación es simulada: las contraseñas demo están en el frontend y los datos locales se pueden manipular desde el navegador. Utiliza datos ficticios. No hay seguridad de servidor.

## Preparar Supabase antes del Prompt 9

1. Crear o seleccionar un proyecto Supabase de ensayo y obtener su Project URL y clave **publishable** reales.
2. Copiar `.env.example` a `.env.local` y completar esos dos valores. Nunca incluir `service_role`, claves secretas o contraseña de PostgreSQL en variables `VITE_*`. Estas variables están reservadas; todavía no activan el backend.
3. Preparar Auth con email/contraseña, registro abierto y anonymous sign-in desactivados, cuentas de prueba con contraseñas únicas y redirects del dominio real que vaya a utilizarse. Los datos `Access123` son exclusivamente de la demo local.
4. Revisar [migraciones e instrucciones](supabase/README.md). Hay tres migraciones aditivas, diez tablas de dominio, tokens privados y RLS de lectura; las escrituras permanecen bloqueadas hasta implementar RPCs autorizados. No se han ejecutado ni verificado en una instancia Supabase.

El [plan, sección 10](docs/SHARED_BACKEND_PLAN.md#10-configuración-manual-antes-del-prompt-9) detalla la configuración manual. La siguiente etapa incorporará Auth y adaptadores; añadir claves ahora no cambia datos ni sesiones existentes. No se instaló el SDK ni se utilizó Docker.

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

### Compatibilidad de identificadores

Todas las altas y tokens utilizan `generateId()` de `src/utils/id.ts`: primero `crypto.randomUUID()`, después UUID v4 mediante `crypto.getRandomValues()` y, si falta Crypto, timestamp + contador local + dos valores aleatorios. El último recurso es un identificador de demostración, no un token criptográfico. Los IDs y tokens anteriores se conservan; no cambia el esquema ni las reglas de invitaciones.

`randomUUID()` puede faltar al abrir la aplicación por HTTP desde una IP local, porque requiere un contexto seguro; `getRandomValues()` también funciona en contextos no seguros. Véanse [randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) y [getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues). La disponibilidad se comprueba antes de invocar cada API.

La revisión también encontró llamadas a `structuredClone()` en la semilla y migraciones. Ahora usan `cloneJsonData()` con alternativa JSON para los datos serializables del prototipo. No se añadieron dependencias ni se reiniciaron datos. La corrección cubre estas APIs ausentes; no establece compatibilidad general con navegadores obsoletos.

Para repetir la prueba: recarga la aplicación en el navegador donde apareció el error, entra como Daniel y abre **Invitaciones → Nuevo visitante**. Usa **Prueba compatibilidad**, sin vehículo, **24 horas**, y genera. Debe abrir el detalle con QR, estado Activa y 0 de 2 usos; al recargar debe conservarse. Repite desde un contacto frecuente. No hace falta restaurar la demo.

## Rutas

| Ruta | Función |
| --- | --- |
| `/`, `/login` | Login; con sesión redirige al inicio del rol |
| `/admin` | Dashboard real, actividad reciente y datos básicos del condominio |
| `/admin/residencias` | Listado, búsqueda y alta de casas |
| `/admin/residencias/:residenceId` | Estructura, estado, asignación del principal y consulta de habitantes/vehículos |
| `/admin/control-acceso` | Simulador de validación por token, selector de activas e historial autorizado |
| `/admin/historial` | Historial del condominio con búsqueda y filtros |
| `/admin/reportes`, `/admin/reportes/:reportId` | Consulta y avance de reportes |
| `/residente` | Dashboard de la propia residencia y acciones rápidas |
| `/residente/mi-residencia` | Gestión si el usuario es su principal y la casa está activa |
| `/residente/historial` | Movimientos de la propia casa y sus invitaciones |
| `/residente/reportes`, `/residente/reportes/:reportId` | Reportes del propio autor |
| `/residente/reportes/nuevo` | Crear reporte como principal de casa activa |
| `/residente/contactos` | Agenda privada: listado, buscador y alta de contactos |
| `/residente/contactos/:contactId` | Detalle y edición del contacto y sus vehículos |
| `/residente/contactos/:contactId/invitar` | Invitación con datos del contacto y selección de vehículo |
| `/residente/invitaciones` | Listado, búsqueda y filtro por estado de las invitaciones de la casa |
| `/residente/invitaciones/nueva` | Nuevo visitante, con guardado opcional como contacto |
| `/residente/invitaciones/:invitationId` | Detalle, cancelación, QR y enlace del visitante |
| `/invitacion/:token` | Vista pública sin login, con QR y datos exclusivos de esa visita |
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
5. **Invitar** abre el formulario con nombre/teléfono del contacto, vehículos activos, Sin vehículo y Otro vehículo. El botón se deshabilita para contactos o residencias inactivos.

Los contactos pertenecen a la cuenta del principal y no se comparten con el administrador ni con otros residentes, incluso de su misma casa. Si cambia el principal, su agenda no se transfiere: queda conservada para su propietario, que volverá a acceder si recupera la condición de principal. Una casa inactiva permite consultar la agenda, pero no modificarla.

Los vehículos del contacto se guardan dentro del contacto, separados de `vehicles`, que contiene los vehículos permanentes de las casas. Las placas no pueden repetirse dentro de un contacto; sí pueden figurar en otra agenda o registro sin que eso conceda acceso permanente.

La verificación dejó un contacto adicional de Daniel: **Laura Sánchez Ruiz**, teléfono ficticio `3312345099`, con `LRS-9001` (Mazda 3 azul, inactivo) y `LRS-9002` (Honda Civic, activo). El contacto quedó activo. Usa otros nombres/placas si repites pruebas; no hace falta restaurar.

## Invitaciones

Abre [Invitaciones](http://127.0.0.1:5173/residente/invitaciones) con Daniel (`residente@accesshome.demo` / `Access123`).

1. **Desde contacto:** Contactos frecuentes → Carlos López → Invitar. Elige Mazda 3 · `JKL-1234`, Sin vehículo u Otro vehículo. Solo las placas son obligatorias para un vehículo nuevo.
2. **Ocasional:** Invitaciones → Nuevo visitante. Escribe un nombre, por ejemplo **Lucía Pérez**; teléfono opcional. Elige si llega en vehículo. **Guardar como contacto frecuente** comienza desmarcado; no se crea una cuenta ni es obligatorio guardar contacto.
3. Selecciona **Hoy**, **24 horas** o **Personalizada** y pulsa **Generar invitación**. El destino es automáticamente tu residencia, sin selector de casa.
4. El detalle confirma la creación y muestra visitante, vehículo, destino, invitador, vigencia, token y usos `0 de 2`. No se pueden editar sus datos principales.
5. Usa búsqueda por nombre/teléfono/placas y filtro por Activa, Completada, Cancelada o Expirada. Para corregir una activa, **Cancelar invitación → Confirmar cancelación** y crear otra. **Mantener invitación** evita la cancelación.
6. Recarga: se conservan sesión e invitaciones. Modificar o eliminar el contacto o su vehículo no cambia el historial.

**Vigencia:** Hoy termina a medianoche local; 24 horas dura exactamente 24 horas desde la generación; Personalizada exige fechas válidas, fin posterior al inicio y todavía futuro. Las fechas se introducen/muestran en la hora del dispositivo y se almacenan en ISO. Una visita futura figura Activa con un aviso de inicio programado en el detalle. La expiración se calcula al consultar y cancelar; las pantallas actualizan el estado cada segundo.

**Permisos:** solo el principal de una casa activa crea/cancela. Las cuentas adicionales activas pueden consultar invitaciones de su propia casa. Administrador y otras casas no acceden a esta sección. La agenda original sigue siendo privada: las invitaciones contienen exclusivamente los datos seleccionados para la visita. Cambiar al principal no cambia quién generó las invitaciones históricas.

La semilla comienza sin invitaciones ni registros de acceso. El simulador consume los dos usos y marca Completada al registrar la salida. Todo el recorrido permanece local.

Si Carlos fue eliminado de tu agenda, la migración respeta esa eliminación. Puedes probar con otro contacto o crear un contacto ficticio equivalente; no necesitas restaurar tus datos.

## QR, visitante y control de acceso

1. Entra como Daniel y crea **Visita QR de prueba**, sin vehículo y con vigencia **24 horas**. En el detalle verás el QR, token y **Abrir vista del visitante**.
2. Copia el enlace `/invitacion/{token}`, cierra sesión y ábrelo en el mismo navegador. No pide login. Muestra visitante, casa, anfitrión, vigencia, vehículo/placas, estado y QR; no entrega teléfonos, correos, agenda ni otros habitantes.
3. En **¿Llegarás en vehículo? → Sí**, registra solo `QR-9002` y guarda. Marca/modelo/color son opcionales. El vehículo queda en esa invitación y se conserva al recargar. Solo puede añadirse una vez, en una invitación activa sin vehículo, con residencia activa y antes del primer uso; no modifica la agenda ni los vehículos permanentes.
4. Entra como `admin@accesshome.demo` / `Access123` y abre [Control de acceso](http://127.0.0.1:5173/admin/control-acceso). Selecciona la invitación o pega su token; pulsa **Validar acceso**.
5. Primera validación: **Acceso autorizado · ENTRADA**, 1 de 2 usos. Segunda: **SALIDA**, 2 de 2 y Completada. Tercera: **Acceso rechazado · Invitación completada**.
6. Revisa **Movimientos autorizados**: dos registros con visitante, casa, anfitrión, vehículo, tipo, método QR y fecha/hora. Recargar conserva usos e historial. Las invitaciones canceladas, expiradas, futuras y tokens inexistentes se rechazan sin registrar movimientos ni consumir usos.

El administrador solo puede operar su condominio; residentes y visitantes no pueden autorizar accesos. El servicio consulta la invitación almacenada por token en cada intento, comprueba vigencia, estado, residencia activa y usos, y guarda el movimiento junto con el uso consumido. Un fallo de almacenamiento no anuncia autorización ni deja un registro parcial. Los resultados positivos usan verde y los rechazos, rojo, ambos con texto explícito.

El QR se genera localmente como SVG con [qrcode.react](https://github.com/zpao/qrcode.react), única dependencia añadida, sin dependencias transitivas nuevas. Codifica una URL absoluta del origen actual con la ruta `/invitacion/{token}`; utiliza el token de la invitación, sin cambiar invitaciones anteriores. El simulador sustituye la lectura física por selección/token manual y registra método QR; no usa cámara ni hardware.

**Alcance del enlace público:** no requiere sesión, pero los datos siguen en localStorage. Debe abrirse en el mismo navegador/perfil/origen que creó la invitación. Otro dispositivo o navegador no comparte sus datos; `127.0.0.1` en un teléfono apunta al propio teléfono. Para presentar el flujo utiliza varias pestañas del mismo origen y el modo móvil del navegador. La futura API permitirá compartirlo entre dispositivos.

## Historial, reportes y dashboards

1. Entra como Daniel y usa **Inicio → Nueva invitación** para crear **Visita historial de prueba**, con vigencia **24 horas**. Copia el token.
2. Como administrador, valida ese token dos veces en **Control de acceso**: Entrada y Salida. **Historial de accesos** muestra ambos movimientos; combina búsqueda, residencia, movimiento y fechas locales. Una tercera validación rechazada no agrega registros.
3. Como Daniel, abre **Historial de accesos**: solo aparecen movimientos de Casa 24 y sus invitaciones. El historial conserva los datos registrados aunque después cambie el contacto o el estado de la invitación.
4. En **Crear reporte**, escribe **Lámpara de acceso apagada**, categoría **Instalaciones** y una descripción. Autor y residencia se asignan automáticamente; comienza Pendiente. Recarga para verificar persistencia.
5. Como administrador, abre **Reportes → Ver reporte**, pulsa **Marcar en proceso** y después **Marcar completado**. Daniel verá el avance en **Mis reportes**. No se puede saltar estados, retroceder ni modificar reportes como residente.

Los servicios revalidan permisos en cada llamada. El historial se limita a la casa del residente; los reportes se limitan además al autor, incluso entre cuentas de una misma casa. Se conserva el acceso de consulta de las cuentas adicionales; crear reportes requiere ser el principal de una casa activa.

**Cómo leer los indicadores:**

- Administrador: todas las residencias del condominio, habitantes activos, vehículos permanentes activos e inactivos, entradas y salidas autorizadas de hoy, invitaciones con estado efectivo Activa y reportes exactamente Pendientes.
- Residente: datos de su casa; visitas recientes cuenta entradas de los últimos siete días naturales, incluido hoy. Habitantes y vehículos incluye todos los registrados; reportes pendientes cuenta solo los del propio autor.
- Activas incluye invitaciones programadas para una fecha futura. Los vehículos de contactos no se suman a los permanentes. Actividad reciente muestra los últimos cinco movimientos, sin limitarse a hoy.

Los dashboards se actualizan tras guardar cambios y revisan la vigencia cada segundo. La semilla no inventa accesos ni reportes: comienza en cero hasta realizar esos flujos. Una base migrada conserva sus cantidades existentes. En móvil, **Nueva invitación** ocupa el primer lugar y las tablas de historial/reportes se presentan como filas compactas con etiquetas.

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

Solo `services/demoStorage.ts` accede a localStorage, bajo `accesshome.demo.v1`. El esquema interno es **versión 7**. Migrar desde v6 conserva todos sus datos, tokens, usos, movimientos y sesión; añade `reports: []`. Las versiones anteriores pasan por las migraciones existentes, sin reinsertar contactos eliminados de agendas ya creadas. Restaurar datos demo recupera la semilla, vacía invitaciones, movimientos y reportes, y cierra sesión.

La migración desde versión 1 también conserva Casa 25 y completa los datos demo de la etapa anterior. Por eso una instalación migrada puede tener más casas y cantidades distintas de la semilla.

Para recuperar la semilla exacta: cierra sesión y usa **Restaurar datos demo → Confirmar restauración** en el login. `demoService.resetDemoData()` reemplaza todos los datos del prototipo y cierra la sesión; conserva las claves de otras aplicaciones. Los datos corruptos no se sobrescriben automáticamente y los fallos de almacenamiento se muestran como errores.

La sesión no caduca automáticamente. Los cambios y el logout se comparten entre pestañas del mismo origen; `localhost`, `127.0.0.1` y otros puertos tienen almacenamientos independientes.

## Organización

```text
src/
  components/   Navegación, rutas protegidas, formularios, tablas y detalles
  layouts/      Público, administrador y residente
  pages/        Login, comunidad, contactos, invitaciones, visitante, accesos y perfil
  services/     Contratos asíncronos, permisos, autenticación y persistencia
  data/         Semilla y navegación
  types/        Cuentas, comunidad, contactos, vehículos, invitaciones y accesos
  hooks/        Sesión, consultas y título de página
  utils/        Destino por rol y nombres de habitantes
  styles/       Estilos globales y responsive
  router.tsx    Rutas principales
```

`communityService` ofrece las consultas y operaciones estructurales; delega la gestión de habitantes/vehículos a `householdService` y la asignación a `principalService`. `communityRules` resuelve al usuario desde la sesión persistida, verifica principal/casa/estado y valida campos, números, correos y placas. Las pantallas no eligen el usuario que autoriza una operación. Las consultas no devuelven contraseñas.

`contactsService` concentra consultas y modificaciones de agenda, con validación del principal y propietario en cada llamada. Los componentes consumen contratos asíncronos y notificaciones de los servicios; una futura API podrá sustituir su implementación sin trasladar persistencia a las pantallas. No se utilizan bibliotecas generales de componentes ni servicios externos.

`invitationsService` fija destino, invitador y usos; `invitationRules` aplica permisos, vigencia y estado; `invitationSnapshot` copia los datos del visitante y vehículo. Las placas viven en `Invitation.vehicle.plates`, sin duplicarlas. El detalle nunca busca datos históricos en el contacto. Crear invitación y guardar contacto opcional utilizan una sola escritura para evitar resultados parciales.

`publicInvitationService` entrega una proyección mínima por token y permite la incorporación limitada de vehículo. `accessService` exige administrador, valida el token y guarda uso/movimiento juntos; `accessRules` centraliza permisos y motivos, y `accessValidation` comprueba la integridad del historial. Cada movimiento conserva su propia copia de los datos de la visita.

## Verificación y documentación

`npm test` ejecuta **115 pruebas** con TypeScript y el ejecutor nativo de Node: historial y filtros, indicadores, reportes, aislamiento por casa/autor/condominio, compatibilidad sin APIs modernas, acceso público, entrada/salida/rechazos, permisos, guardado conjunto, snapshots y migraciones. La guía acumulativa distingue pruebas de servicios y recorridos del navegador.

- [Estado y checklist de fases](docs/PROTOTYPE_STATUS.md)
- [Guía acumulativa de pruebas](docs/PROTOTYPE_TESTING.md)
- [Contratos y reglas de servicios](src/services/README.md)
- [Plan de backend compartido y configuración manual](docs/SHARED_BACKEND_PLAN.md)
- [Migraciones SQL y auditoría de seguridad](supabase/README.md)

Quedan pendientes la integración efectiva con Supabase, sus pruebas entre dispositivos y la preparación del recorrido final de presentación. No se realizaron commits ni push.
