# Guía acumulativa de pruebas

Esta guía se amplía en cada etapa. Al incorporar funciones nuevas, repetir también las pruebas anteriores que puedan verse afectadas.

## Preparación

1. Instalar una versión de Node.js compatible con el README.
2. Ejecutar `npm install` desde la raíz del proyecto.
3. Ejecutar `npm run dev` y mantener esa terminal abierta.
4. Abrir http://127.0.0.1:5173.

### Datos de prueba de la etapa 1

Perfiles disponibles: **Administrador** y **Residente**. No requieren credenciales. No existen cuentas, sesiones ni registros persistidos; no hace falta limpiar localStorage.

## Etapa 1 · Infraestructura

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
