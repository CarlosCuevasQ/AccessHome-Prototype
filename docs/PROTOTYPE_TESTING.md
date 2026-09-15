# Guía acumulativa de pruebas

Esta guía se amplía en cada etapa. Al incorporar funciones nuevas, repetir también las pruebas anteriores que puedan verse afectadas.

## Preparación

1. Instalar una versión de Node.js compatible con el README.
2. Ejecutar `npm install` desde la raíz del proyecto.
3. Ejecutar `npm run dev` y mantener esa terminal abierta.
4. Abrir http://127.0.0.1:5173.

## Etapa 2 · Autenticación simulada (pruebas vigentes)

Las pruebas de esta sección sustituyen el acceso libre y el cambio directo de perfil de la etapa 1. Las verificaciones anteriores de apariencia, teclado y 404 siguen aplicando, pero las rutas de cada perfil requieren su sesión correspondiente.

### Datos de prueba

| Perfil | Nombre | Correo | Contraseña |
| --- | --- | --- | --- |
| Administrador | Administrador Demo | `admin@accesshome.demo` | `Access123` |
| Residente | Daniel Cuevas | `residente@accesshome.demo` | `Access123` |

Condominio: **Residencial Los Encinos**. Residencia de Daniel: **Casa 24**. La semilla incluye Casa 25 y dos vehículos de Casa 24: `DEMO-024` (Nissan Versa gris) y `DEMO-124` (Toyota Corolla blanco). No hay pantallas de gestión de estos registros todavía.

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
