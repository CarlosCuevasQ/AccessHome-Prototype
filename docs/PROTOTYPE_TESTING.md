# Guía acumulativa de pruebas

Esta guía se amplía en cada etapa. Al incorporar funciones nuevas, repetir también las pruebas anteriores que puedan verse afectadas.

## Preparación

1. Instalar una versión de Node.js compatible con el README.
2. Ejecutar `npm install` desde la raíz del proyecto.
3. Ejecutar `npm run dev` y mantener esa terminal abierta.
4. Abrir http://127.0.0.1:5173.

## Etapa 3 · Permisos y residencia propia (pruebas vigentes)

Esta corrección sustituye los casos E3 antiguos que daban al administrador altas/edición cotidianas o limitaban al principal a consulta. La autenticación, navegación, búsqueda, 404 y pruebas de almacenamiento de etapas anteriores siguen aplicando.

### Datos

- Administrador: `admin@accesshome.demo` / `Access123`.
- Daniel, principal de Casa 24: `residente@accesshome.demo` / `Access123`.
- Mariana, cuenta adicional de consulta: `mariana@accesshome.demo` / `Access123`.
- Casa 24 contiene Daniel, Mariana, Andrea y Carlos en la semilla. Andrea/Carlos no tienen cuenta. Mantiene sus dos vehículos demo.
- Para este recorrido: Casa **91**, Circuito Cedros; principal **Sofía Ramos**, `sofia91@accesshome.demo`; habitante **Elena Cuevas**; vehículo `DEMO-324`, Mazda 3 azul. Usa otros valores si ya existen.
- Los datos anteriores se migran sin reinicio. Solo usa Restaurar datos demo si deseas descartar las altas/ediciones y volver a la semilla exacta: cuatro casas, ocho habitantes y cinco vehículos.

### Nueve recorridos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| P3-01 | Como administrador, abrir Residencias → Agregar residencia. Guardar Casa 91, Circuito Cedros, Activa. | Nueva casa sin principal ni habitantes; aparece en la búsqueda y el resumen. |
| P3-02 | Abrir Casa 91 → Asignar residente principal. Registrar Sofía Ramos / `sofia91@accesshome.demo`. | Sofía figura como principal. Solo hay acciones de estructura/asignación y consulta; no Agregar habitante ni Registrar vehículo. |
| P3-03 | Cerrar sesión. Entrar con `sofia91@accesshome.demo` / `Access123`. Después entrar como Daniel para los pasos siguientes. | Sofía gestiona Casa 91; Daniel gestiona Casa 24. Ninguno puede editar el número de casa, crear casas o asignarse otra. |
| P3-04 | Como Daniel, pulsar Agregar habitante. Nombre Elena, apellido Cuevas, relación Familiar; dejar teléfono/correo vacíos y guardar. | Habitante activo de Casa 24, sin crear cuenta de acceso. |
| P3-05 | Ver detalle de Elena → Editar habitante. Cambiar apellido a Cuevas Pérez y teléfono a `55 5550 2432`; guardar y volver a abrir el detalle. | Datos actualizados. El formulario permite desactivar y reactivar; no cambia casa ni asignación. |
| P3-06 | Registrar vehículo: `DEMO-324`, Mazda, 3, Azul, Activo, propietaria Elena Cuevas Pérez. | Vehículo de Casa 24, con propietaria de esa casa. El selector no incluye habitantes de otras casas. |
| P3-07 | Ver detalle del vehículo → Editar vehículo. Cambiar color a Azul oscuro y estado a Inactivo; guardar y recargar. | Se conservan sesión, casa, propietaria, color y estado. Se puede reactivar. |
| P3-08 | Como Daniel, abrir `/admin/residencias/house-12`. Ejecutar además la llamada directa de servicio indicada debajo. | La ruta vuelve a `/residente` con aviso. La llamada rechaza la modificación por pertenecer a otra casa. |
| P3-09 | Cerrar sesión, entrar como administrador y abrir Residencias → Casa 24. Abrir los detalles de Elena y del vehículo. | Ve habitantes/vehículos actualizados y sus datos; no puede editarlos desde el detalle. |

### P3-08: comprobar permisos en el servicio

Con `npm run dev`, sesión de Daniel y la consola de desarrollo del navegador abierta en `/residente`, ejecutar:

```js
const { communityService } = await import('/src/services/communityService.ts');
try {
  await communityService.updateVehicle('house-12', 'vehicle-12', {
    plates: 'DEMO-012', brand: 'Kia', model: 'Rio', color: 'Verde',
    active: true, ownerId: null,
  });
  console.error('FALLO: se permitió modificar otra casa');
} catch (error) {
  console.log(error.message);
}
```

Resultado: **Solo puedes acceder a tu propia residencia.** El administrador debe seguir viendo el Kia de Casa 12 azul, sin cambios. El ejemplo requiere el servidor de desarrollo de Vite; no funciona en `npm run preview` porque el código fuente no se sirve en el build. `npm test` también verifica las cuatro operaciones de habitantes/vehículos contra otra casa, además de IDs ajenos enviados junto al ID de Casa 24.

### Casos adicionales y regresión

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| P3-10 | Como Daniel, desactivar a Elena desde Editar habitante. Consultar su vehículo y reactivar a Elena. | Habitante inactivo identificado; vehículo y propietaria se conservan. La reactivación recupera el estado activo. |
| P3-11 | Abrir la edición de Daniel. | Estado deshabilitado: el principal no puede desactivarse hasta que el administrador lo reemplace. La misma acción directa se rechaza en el servicio. |
| P3-12 | Como administrador, editar Casa 91 y cambiarla a Inactiva. Entrar con Sofía. Luego reactivarla como administrador. | Sofía consulta pero no gestiona mientras esté inactiva; tras reactivación recupera la gestión. No se borran habitantes/vehículos. |
| P3-13 | Como Sofía, agregar a Tomás Ramos sin cuenta. Como administrador, cambiar principal de Casa 91 a Tomás, correo de acceso `tomas91@accesshome.demo`. | No duplica al habitante. Tomás puede entrar con Access123 y gestionar; Sofía queda en consulta. La casa de Daniel no cambia. |
| P3-14 | Como administrador, volver a elegir Sofía como principal existente. | Usa su cuenta previa; no exige crear otra ni cambia su contraseña. Tomás queda como habitante de consulta. |
| P3-15 | En Casa 91, intentar crear un nuevo principal usando `residente@accesshome.demo`. | Error de correo existente; no mueve a Daniel ni duplica habitantes/cuentas. |
| P3-16 | Entrar como Mariana y consultar Casa 24. | Tiene consulta y detalle, sin altas/ediciones ni permisos de gestión en servicios. |
| P3-17 | Como Daniel, editar correo de contacto de un habitante con cuenta. | Cambia el contacto, no su correo de acceso ni contraseña. Si desactiva una cuenta adicional, esta no puede iniciar sesión hasta reactivarse. |
| P3-18 | Intentar Casa 24 duplicada, principal con correo inválido/existente, placas `demo 012` o campos obligatorios en blanco. | Error legible; sin registros duplicados ni guardados parciales. Teléfono, contacto y relación de habitantes siguen siendo opcionales. |
| P3-19 | Repetir login incorrecto, ambos roles, logout, recarga, perfil, 404 y cambios entre pestañas. | Se conservan flujos anteriores. Los cambios de principal/estado se reflejan al recibir notificaciones y el servicio revalida cada operación. |
| P3-20 | Probar listas, detalles, formularios y menú a 375, 768 y 1366 px. Recorrer con teclado. | Sin desbordamiento horizontal; acciones visibles, foco identificable y tablas/listas legibles. |
| P3-21 | Restaurar desde el login en una copia de prueba. | Recupera Daniel como principal de Casa 24, ocho habitantes y cinco vehículos; cierra sesión y elimina las altas locales. |

### Verificación realizada en esta corrección

- `npm test`: **32/32** pruebas correctas: 11 de autenticación, 17 de comunidad/permisos y 4 de migración/integridad. Prueban permisos dentro de servicios, asignación/revocación, acceso anónimo e inactivo, rechazo entre condominios, propietarios, duplicados y errores de escritura. Se conserva la regresión de autenticación.
- `npm run build`: TypeScript y Vite correctos. Se reutilizó y comprobó el servidor `npm run dev` del puerto 5173.
- Navegador, P3-01 a P3-09: se usó Casa **90** y **Sofía Ramos** (`sofia90@accesshome.demo`), se comprobó su login; como Daniel se agregó **Lucía Cuevas**, luego **Lucía Cuevas Pérez** / `55 5550 2490`. Se registró `DEMO-224` Mazda 3, se editó a Azul oscuro/Inactivo y se comprobó recarga. El administrador ve los cambios sin botones cotidianos. P3-08: bloqueo de ruta probado en navegador; llamadas directas verificadas por tests de Node.
- Desactivación/reactivación de Lucía probada desde el móvil; quedó activa y sin cuenta. Se conservaron sus datos y su vehículo. La migración mantuvo la sesión previa de Laura, Casa 88 y Casa 25; no se reinició localStorage.
- Revisión visual de formularios a 375 × 812 y consulta administrativa a 1366 × 1000 y 768 × 1024. Sin desbordamiento horizontal en las vistas medidas. Se ajustó la posición del indicador Principal en tablet. Menú y logout móvil comprobados.
- El cambio de principal y la casa inactiva están cubiertos por pruebas automatizadas; P3-12 a P3-14 quedan disponibles como recorridos manuales adicionales sin alterar la asignación demo de Daniel.
- No se instalaron dependencias ni se realizaron commits/push. No se inició contactos frecuentes.

## Etapa 3 · Comunidad (registro histórico)

Los recorridos y resultados siguientes corresponden a la implementación previa. Sus permisos de edición administrativa y consulta exclusiva del residente fueron sustituidos por P3-01 a P3-21.

La autenticación sigue funcionando. `/admin` ahora abre el resumen del condominio y `/residente` abre la casa del residente. Los datos de perfil anteriores están en **Mi perfil**.

### Preparación y datos

- Administrador: `admin@accesshome.demo` / `Access123`.
- Daniel Cuevas: `residente@accesshome.demo` / `Access123`, asociado a Casa 24.
- Semilla nueva: Residencial Los Robles; Casa 12 (Ana López y Jorge Mendoza), Casa 24 (Daniel Cuevas y Mariana Torres), Casa 37 (Luis Herrera) y Casa 51 (Elena Ríos).
- Cinco vehículos permanentes, cuatro activos y uno inactivo en una semilla recién restaurada. Casa 24 tiene `DEMO-024` (Daniel, activo) y `DEMO-124` (Mariana, inactivo).
- Para las altas utiliza Casa `90`, `Circuito Cedros`, residente `Laura Pérez`, correo `laura90@accesshome.demo`, vehículo `DEMO-090`, `Honda`, `Civic`, `Negro`. Si existen, usa otro número, correo y placas.

La migración conserva los registros de la etapa 2, incluida Casa 25; añade lo que falte y conserva la sesión. Los vehículos anteriores reciben estado activo y propietario sin asignar. Por ello las cantidades iniciales pueden diferir de la semilla nueva. No hace falta borrar datos. Si se desea la semilla exacta, cerrar sesión y usar **Restaurar datos demo → Confirmar restauración**, que descarta las altas y ediciones locales.

### Crear una casa, agregar residente y registrar vehículo

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E3-01 | Ingresar como administrador y abrir Condominio. | Nombre, dirección y cantidades de residencias/residentes/vehículos calculadas desde datos reales. |
| E3-02 | Abrir Residencias y buscar `24`; luego `Casa 24` y un número inexistente. | Se filtra Casa 24 en los primeros casos y se muestra estado vacío para el inexistente. |
| E3-03 | Pulsar Agregar residencia, escribir número `90` y calle `Circuito Cedros`, guardar. | Aparece Casa 90; el filtro se limpia para que la nueva casa sea visible. |
| E3-04 | Abrir Casa 90 y pulsar Agregar residente demo. Guardar Laura Pérez / `laura90@accesshome.demo`. | Residente asociado a Casa 90 y contador actualizado. La cuenta usa `Access123`. |
| E3-05 | Pulsar Agregar vehículo. Completar `DEMO-090`, Honda, Civic, Negro, Activo; elegir Laura Pérez como propietaria. | Vehículo asociado a la casa, con sus datos, estado y propietaria visibles. |
| E3-06 | Recargar y volver al listado/resumen. | Casa, residente y vehículo se conservan; cantidades actualizadas. |
| E3-07 | Cerrar sesión y entrar como `laura90@accesshome.demo` / `Access123`. | Solo consulta Casa 90 y sus datos. No aparecen acciones de edición. |

### Edición, integridad y permisos

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E3-08 | Como administrador, editar calle/número de Casa 90. | Se actualiza la información sin perder residentes ni vehículos. |
| E3-09 | Editar nombre/correo de Laura. | Se actualiza la tabla y el nombre de propietaria en sus vehículos. Puede entrar con el nuevo correo y la misma contraseña. |
| E3-10 | Editar placas, marca, modelo, color y estado de un vehículo; seleccionar Sin asignar. | Cambios persistidos; estado Inactivo explícito y propietaria opcional. El resumen refleja los vehículos activos. |
| E3-11 | En Condominio, pulsar Editar información y modificar nombre/dirección. | Se reflejan en el resumen y en los detalles de las casas; Cancelar conserva los datos previos. |
| E3-12 | Intentar repetir Casa 24, un correo ya registrado o las placas `DEMO-024` (también `demo 024`). | Error legible; no duplica ni sobrescribe registros. |
| E3-13 | Dejar campos obligatorios vacíos o escribir una calle con solo espacios. | No guarda; muestra validación del formulario o servicio. |
| E3-14 | Revisar el selector de propietario en Casa 24. | Solo permite elegir residentes de Casa 24 o Sin asignar. El servicio también rechaza IDs de otra casa. |
| E3-15 | Como Daniel, consultar Mi residencia y luego intentar `/admin/residencias/house-12`. | Ve Casa 24 con Daniel/Mariana y sus vehículos; la ruta administrativa redirige a su inicio con aviso. |
| E3-16 | Abrir un ID de residencia inexistente como administrador. | Mensaje Residencia no disponible con enlace de regreso. |
| E3-17 | Probar login incorrecto, logout, recarga con sesión y Mi perfil para ambos roles. | Continúan funcionando los flujos de la etapa 2. |
| E3-18 | Probar formularios/listas a 375–430 px, 768 px y escritorio. | Tablas de escritorio; listas compactas en ancho reducido, campos y acciones accesibles, sin scroll horizontal. |
| E3-19 | Restaurar datos demo y volver a entrar. | Cuatro casas, seis residentes, cinco vehículos; se eliminan altas y ediciones de prueba. |

### Resultados de verificación de la etapa 3

- `npm test`: **25/25** pruebas correctas. Incluye regresión de autenticación, alta/edición, duplicados, relaciones, propietarios, acceso entre condominios, consultas del residente, migración, restauración y fallos de escritura.
- `npm run build`: TypeScript y Vite correctos.
- Navegador: migración conservó sesión y Casa 25, y mostró Los Robles con las nuevas casas y residentes.
- Se creó **Casa 88**, **Laura Méndez** (`laura@accesshome.demo`) y **DEMO-088**, Honda Civic. Se comprobó persistencia al recargar, se editó la calle a **Circuito Cedros Norte**, el nombre a **Laura Méndez Ruiz** y el vehículo a **Azul oscuro / Inactivo**. Estos registros de prueba se conservaron; no se restauraron los datos del navegador.
- E3-02 a E3-06 y edición de casa/residente/vehículo comprobados en la interfaz. El resto de validaciones de integridad y restricciones de servicio también está cubierto por tests automatizados.
- E3-07: la cuenta creada `laura@accesshome.demo` entró con `Access123` y mostró exclusivamente Casa 88 con su vehículo inactivo. Se comprobó el formulario de edición del condominio guardando sus valores vigentes y el rechazo visual de Casa 24 duplicada.
- Vista de Daniel verificada sin acciones de edición; bloqueo de detalle administrativo de otra casa y persistencia al recargar comprobados.
- Revisión visual a 1366 × 1000, formulario de vehículo y consulta de residente a 375 × 812, y consulta a 768 × 1024. Ancho de contenido igual al área disponible en las vistas móviles/tablet inspeccionadas.
- Sin errores ni advertencias de consola observados.

## Etapa 2 · Autenticación simulada (regresión)

Las pruebas de esta sección sustituyen el acceso libre y el cambio directo de perfil de la etapa 1. Las verificaciones anteriores de apariencia, teclado y 404 siguen aplicando, pero las rutas de cada perfil requieren su sesión correspondiente.

### Datos de prueba

| Perfil | Nombre | Correo | Contraseña |
| --- | --- | --- | --- |
| Administrador | Administrador Demo | `admin@accesshome.demo` | `Access123` |
| Residente | Daniel Cuevas | `residente@accesshome.demo` | `Access123` |

En la etapa 2 el condominio se llamaba Los Encinos y la semilla tenía Casa 24 y Casa 25. La etapa 3 actualiza el nombre, amplía los datos e incorpora su gestión; las credenciales principales se conservan.

### Los seis recorridos solicitados

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E2-01 | En `/login`, escribir `admin@accesshome.demo` y contraseña `incorrecta`. Pulsar Iniciar sesión. | Aviso **Correo o contraseña incorrectos**. Permanece en login sin crear sesión. |
| E2-02 | Cambiar contraseña a `Access123` y enviar. | Abre `/admin`; muestra Administrador Demo, rol Administrador y el condominio. |
| E2-03 | Pulsar Cerrar sesión en el menú. En móvil, abrir primero el menú. | Abre `/login`. Abrir `/admin` o usar Atrás no recupera acceso. |
| E2-04 | Ingresar `residente@accesshome.demo` y `Access123`. | Abre `/residente`; muestra Daniel Cuevas y Casa 24. |
| E2-05 | Con la sesión de residente, escribir `/admin` o `/admin/no-existe` en la dirección. | Regresa a `/residente` con aviso de acceso restringido. No muestra contenido del administrador. |
| E2-06 | Recargar `/residente`. Repetir luego con la sesión del administrador en `/admin`. | Conserva usuario, rol y ruta; recupera el contexto del perfil. |

### Regresión y casos adicionales

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E2-07 | Sin sesión, abrir `/admin`, `/residente` y subrutas de ambos. | Redirección al login. |
| E2-08 | Con sesión de administrador, abrir `/residente`. | Regresa a `/admin` con aviso. |
| E2-09 | Con cualquier sesión, abrir `/login` o `/`. | Redirección al inicio del rol actual. |
| E2-10 | Abrir `/no-existe`; después, con el rol adecuado, `/admin/no-existe` o `/residente/no-existe`. | 404 pública o dentro del layout autorizado; Volver al inicio funciona. |
| E2-11 | Abrir dos pestañas del mismo origen con la misma sesión. Cerrar sesión en una. | Ambas regresan al login sin recargar manualmente. |
| E2-12 | Desde el login, abrir Credenciales de demostración. | Correos y contraseñas legibles; el detalle puede cerrarse. |
| E2-13 | Pulsar Restaurar datos demo y Cancelar. | Conserva los datos. No aparece mensaje de restauración exitosa. |
| E2-14 | Pulsar Restaurar datos demo y Confirmar restauración. | Mensaje de éxito. Se restaura toda la semilla, se cierra la sesión y ambas credenciales originales funcionan. |
| E2-15 | Probar correo vacío, formato inválido y contraseña vacía; enviar con Enter. | Validación del formulario impide enviar campos inválidos. El envío válido funciona con teclado. |
| E2-16 | Revisar login con credenciales expandidas y perfil a 375–430 px, 768 px y 1280 px o más. | Sin desbordamiento horizontal; controles legibles, foco visible y logout accesible en el menú móvil. |

### Persistencia, restauración y errores

Toda la demostración reside bajo `accesshome.demo.v1`. No se usa `localStorage.clear()`. La función `demoService.resetDemoData()` reemplaza esa clave completa por la semilla original y notifica el cambio de sesión. Para restaurar desde la interfaz, cerrar sesión primero y usar el control del login.

Los tests automatizados verifican que restaurar elimina modificaciones de usuarios/residencias/vehículos, cierra sesión y conserva una clave de otra aplicación. También prueban JSON corrupto, versiones incompatibles, usuarios de sesión inexistentes y almacenamiento bloqueado o sin espacio. No se hace pasar un guardado fallido por exitoso ni se destruyen automáticamente datos corruptos.

Para reproducir datos corruptos manualmente en un perfil de navegador destinado a pruebas: en Herramientas de desarrollador → Almacenamiento local, cambia únicamente el valor de `accesshome.demo.v1` por `{incompleto` y recarga. Debe aparecer el login con un error que permite restaurar. Confirma la restauración y comprueba que puedes entrar otra vez.

La sesión no tiene caducidad automática. Persiste al recargar y se comparte entre pestañas del mismo origen; cambiar de hostname o puerto crea un almacenamiento independiente. Las restricciones son simuladas, no seguridad de producción.

### Ejecución automatizada

```sh
npm test
npm run build
```

`npm test` utiliza TypeScript y el ejecutor nativo de Node, sin nuevas dependencias. Sus 11 pruebas cubren los servicios; las restricciones visuales de rutas se comprueban en los recorridos del navegador.

## Registro de ejecución de la etapa 2

### Resultados de la etapa 2

- E2-01 a E2-06: los seis recorridos solicitados pasaron en el navegador integrado.
- E2-07: después del logout, el acceso directo a `/admin` y Atrás vuelven al login.
- E2-09: abrir `/login` con sesión residente vuelve a `/residente`.
- E2-10: 404 pública y del residente verificadas, incluido su enlace de regreso. La subruta `/admin/no-existe` se rechaza con el rol residente.
- E2-11: sesión recuperada en una segunda pestaña; logout propagado a ambas sin recarga manual.
- E2-12 y E2-14: credenciales desplegables y confirmación de restauración verificadas en UI.
- E2-15: envío válido con Enter comprobado.
- E2-16: revisión visual del login y logout móvil a 375 × 812, residente a 768 × 1024 y escritorio a 1366 × 1000. El contenido no desborda horizontalmente en las vistas revisadas.
- Consola del navegador sin errores ni advertencias observados.
- `npm test`: 11/11 pruebas correctas, incluidos fallos de almacenamiento, restauración íntegra y sesión inválida.
- `npm run build`: TypeScript y Vite correctos. Se conserva la guía manual para los casos adicionales y futuros controles de regresión.

## Etapa 1 · Registro histórico

### Datos de prueba originales de la etapa 1

En la entrega inicial se seleccionaban perfiles sin credenciales. Este comportamiento fue sustituido por los datos y las pruebas de la etapa 2 descritos arriba.

### Pruebas originales de infraestructura

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| E1-01 | Abrir `/`. | Redirección a `/login`; marca y selección de perfil visibles. |
| E1-02 | Elegir Administrador. | URL `/admin`, encabezado Administrador, Inicio activo y contenido del perfil. |
| E1-03 | Pulsar Cambiar de perfil y elegir Residente. | Regreso a `/login` y después `/residente`, con layout de residente. |
| E1-04 | Pulsar Inicio, Volver al acceso temporal y la marca. | Los enlaces llevan al destino indicado sin pantalla vacía. |
| E1-05 | Abrir y recargar `/admin` y `/residente` directamente. | Se conserva la ruta y se renderiza el layout correcto. No se pide sesión. |
| E1-06 | Abrir `/no-existe`. | Página 404 pública con enlace al acceso temporal. |
| E1-07 | Abrir `/admin/no-existe` y `/residente/no-existe`. | 404 con navegación del perfil; Volver al inicio lleva al inicio de ese perfil. |
| E1-08 | Usar Atrás y Adelante del navegador tras cambiar de perfil. | Historial y contenido coherentes con la URL. |
| E1-09 | Reducir el ancho a 390 px y 320 px. | Sin desplazamiento horizontal; login apilado y botón Abrir menú en cada perfil. |
| E1-10 | En móvil, abrir/cerrar el menú y pulsar Inicio. | El menú alterna y se cierra al navegar. El contenido sigue accesible. |
| E1-11 | Ampliar a escritorio. | Menú lateral visible y contenido en una segunda columna. |
| E1-12 | Recorrer la interfaz con Tab, Shift+Tab y Enter. | Foco visible, enlaces operables y enlace Saltar al contenido al inicio. |
| E1-13 | Navegar entre páginas y revisar el título de pestaña. | El título refleja acceso temporal, perfil o página no encontrada. |
| E1-14 | Ejecutar `npm run build`. | TypeScript y Vite finalizan correctamente y generan `dist/`. |
| E1-15 | Ejecutar `npm run preview` y abrir http://127.0.0.1:4173. | El build permite recorrer las mismas rutas. |
| E1-16 | Revisar login y perfiles con la paleta actualizada. | Azul dominante en encabezados y acciones; amarillo limitado a indicadores de etapa, con texto oscuro legible. |
| E1-17 | Probar a 375 px, 430 px y 768 px. | Navegación operable, información legible y sin desbordamiento horizontal. |

## Registro de ejecución

### Etapa 1 · 14 de septiembre de 2026

Entorno: Windows, Node.js 24.11.0, npm 11.6.1 y navegador integrado de Codex.

| Verificación | Resultado |
| --- | --- |
| Instalación | Correcta; auditoría de npm sin vulnerabilidades reportadas. |
| E1-01 a E1-03 | Redirección inicial y cambio entre ambos perfiles comprobados. |
| E1-04 | Inicio y regreso mediante Cambiar de perfil comprobados; los restantes enlaces conservan destinos explícitos en el router. |
| E1-05 | Recarga de ambos perfiles comprobada en desarrollo; apertura directa también comprobada en el build. |
| E1-06 y E1-07 | 404 pública y de cada perfil comprobadas, incluido el enlace de regreso. |
| E1-08 | Atrás y Adelante conservan la ruta esperada. |
| E1-09 a E1-11 | Revisados escritorio a 1366 × 900 y móvil a 390 × 844 y 320 × 740; menú abre, cierra y se oculta al seleccionar Inicio. |
| E1-12 | Enter activa los enlaces y el menú; Shift+Tab recorre menú, marca y Saltar al contenido. Este último lleva el foco al contenido. |
| E1-13 | Títulos del acceso, administrador, residente y 404 comprobados. |
| E1-14 | Build correcto con comprobación de TypeScript. |
| E1-15 | Rutas `/`, `/admin`, `/residente` y las tres variantes 404 comprobadas en la vista previa del build. |
| Consola | Sin errores ni advertencias observados durante el recorrido. |

Se corrigió un desbordamiento causado por un ancho mínimo del body a 320 px. Tras el ajuste, el ancho del contenido coincide con el área útil del navegador en el login y el administrador. También se evitó que el foco automático desplazara la página al entrar.

El sandbox de ejecución bloqueó inicialmente la creación de procesos de Vite (`EPERM`). Build, desarrollo y vista previa funcionaron al ejecutarse con los permisos aprobados; no fue necesario alterar los comandos del proyecto.

Esta revisión cubre navegación y accesibilidad básica; no sustituye una auditoría con lectores de pantalla ni pruebas en teléfonos físicos.

### Ajuste de la etapa 1 al objetivo actualizado

- Actualizados los azules y añadidos acentos amarillos en los indicadores de etapa.
- `npm run build` completado correctamente después del ajuste.
- E1-16: revisados visualmente login, administrador y residente con la nueva paleta.
- E1-17: login y administrador revisados a 768 × 1024; residente a 375 × 812 y 430 × 932. Sin desbordamiento horizontal en el administrador y el residente; menú móvil abierto y cerrado al pulsar Inicio.
- Se reutilizó el servidor de desarrollo existente en el puerto 5173, comprobado desde el navegador. Si `npm run dev` indica que el puerto está ocupado, abrir la instancia existente antes de iniciar otra.
- Los datos de prueba siguen siendo los perfiles temporales Administrador y Residente, sin credenciales.
