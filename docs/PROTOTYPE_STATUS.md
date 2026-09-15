# Estado del prototipo AccessHome

## Etapa 3 · Corrección de responsabilidades (vigente)

Esta sección sustituye el modelo de permisos de la implementación inicial. Las secciones históricas se conservan como registro de entregas, no como requisitos actuales.

- [x] Residencia con estado activo/inactivo y referencia explícita al residente principal.
- [x] Administrador: crear y editar estructura/estado, asignar o cambiar principal y consultar habitantes/vehículos.
- [x] Habitantes separados de cuentas de acceso: nombre, apellido, teléfono/correo/relación opcionales y estado.
- [x] Daniel principal de Casa 24; Mariana conservada y Andrea/Carlos como habitantes sin cuenta.
- [x] Principal: alta, detalle, edición, desactivación y reactivación de habitantes y vehículos propios.
- [x] Vehículos vinculados a la casa y propietario opcional entre sus habitantes.
- [x] Administrador sin mutaciones cotidianas de habitantes/vehículos, también en servicios.
- [x] Residente sin acceso a estructura, asignación o registros de otras casas, también en servicios.
- [x] Cambio de principal revoca permisos anteriores; una cuenta adicional queda en consulta.
- [x] Casa inactiva bloquea la gestión cotidiana y permite consulta; principal actual protegido contra desactivación.
- [x] Migración de esquemas 1/2 a 3 sin reiniciar datos; restauración actualizada.
- [x] Autenticación, roles, persistencia, navegación y diseño azul/amarillo conservados.
- [x] README y guía acumulativa con los nueve recorridos solicitados y prueba directa de permisos.
- [x] 32 pruebas automatizadas correctas y build de TypeScript/Vite correcto.
- [x] Recorridos de navegador: asignación, habitantes, vehículos, estados, persistencia y bloqueo por rol; revisión a 375, 768 y 1366 px.

### Datos conservados de la verificación

- Casa 90, Circuito Cedros, principal Sofía Ramos; `sofia90@accesshome.demo` / `Access123`.
- Casa 24 mantiene a Daniel como principal. Se agregó Lucía Cuevas Pérez, teléfono ficticio `55 5550 2490`, sin cuenta; se verificó desactivación/reactivación y quedó activa.
- Vehículo de prueba `DEMO-224`, Mazda 3 azul oscuro, propietaria Lucía, inactivo.
- Se conservaron Casa 25, Casa 88 y los registros anteriores del navegador. La semilla restaurada sigue teniendo cuatro casas, ocho habitantes y cinco vehículos.

### Archivos principales de esta corrección

- Modelos/semilla: `src/types/demo.ts`, `src/types/community.ts`, `src/data/demo.ts`, `src/utils/people.ts`.
- Servicios: `communityService.ts`, `communityRules.ts`, `householdService.ts`, `principalService.ts`, autenticación, validación, migración y almacenamiento en `src/services/`.
- Interfaz: `src/components/community/`, `src/pages/ResidencePage.tsx`, `ResidencesPage.tsx`, `CondominiumPage.tsx`, `src/router.tsx`, `src/styles/community.css`.
- Pruebas/documentación: `tests/community.test.mjs`, `tests/migration.test.mjs`, `package.json`, README y ambas guías.

No se añadieron dependencias ni se avanzó a contactos frecuentes. No se realizó commit ni push.

Mensaje de commit sugerido: `fix: separar permisos de administrador y residente principal`.

## Etapa 3 · Implementación inicial (histórico)

- [x] Semilla de Residencial Los Robles: casas 12, 24, 37 y 51, seis residentes y cinco vehículos coherentes.
- [x] Daniel Cuevas asociado a Casa 24 junto con Mariana Torres.
- [x] Varios residentes/vehículos por casa; propietario principal opcional y estado activo/inactivo.
- [x] Resumen de condominio con cantidades reales y edición de nombre/dirección.
- [x] Listado y búsqueda de residencias por número, con estados vacíos.
- [x] Detalle de residencia con residentes y vehículos.
- [x] Alta y edición básica de casas, residentes y vehículos.
- [x] Consulta del residente limitada a su propia casa, sin controles de modificación.
- [x] Validaciones de duplicados, campos, propietarios y permisos en servicios.
- [x] Persistencia local y migración del esquema anterior sin reiniciar los datos.
- [x] Tablas de escritorio adaptadas a listas compactas en móvil/tablet.
- [x] 25 pruebas automatizadas correctas; build y pruebas de navegador.
- [x] Documentación de alta de casa, residente y vehículo.

No se implementaron invitaciones ni funciones de etapas posteriores.

### Verificación y archivos de la etapa 3

- 25 pruebas automatizadas correctas, incluidas las 11 de autenticación y 14 de comunidad/migración.
- En navegador: creación de Casa 88, alta de Laura Méndez, registro de DEMO-088 con propietaria, recarga y edición de casa/residente/vehículo. Se conservó el ejemplo de prueba (Laura Méndez Ruiz, Circuito Cedros Norte, vehículo azul oscuro e inactivo).
- Login de la nueva residente comprobado: solo ve Casa 88. Daniel sigue viendo Casa 24 y la navegación administrativa está bloqueada.
- Resumen, búsqueda, formulario de condominio, rechazo de número de casa duplicado y vistas a 375, 768 y 1366 px comprobados.
- Migración conserva sesión, Casa 25 y modificaciones anteriores; una restauración recupera la nueva semilla exacta.
- No se instalaron dependencias, no se borraron archivos y no se realizaron commits o push.

Archivos principales: `src/types/demo.ts`, `src/types/community.ts`, `src/data/demo.ts`, `src/services/communityService.ts`, `src/services/communityRules.ts`, `src/services/demoMigration.ts`, validación/persistencia, `src/hooks/useCommunityQuery.ts`, `src/pages/CondominiumPage.tsx`, `ResidencesPage.tsx`, `ResidencePage.tsx`, `src/components/community/`, router/navegación y `src/styles/community.css`. Pruebas en `tests/community.test.mjs`; documentación en README y las dos guías del prototipo.

Mensaje de commit sugerido (sin ejecutarlo): `feat: gestionar condominio, residencias, residentes y vehículos`.

## Etapa 2 · Autenticación simulada (histórico)

- [x] Login por correo y contraseña con errores legibles.
- [x] Administrador Demo y Daniel Cuevas con los correos y contraseña solicitados.
- [x] Semilla centralizada: condominio, dos residencias y dos vehículos de Casa 24.
- [x] Sesión persistente y logout desde el menú de ambos perfiles.
- [x] Protección de rutas, incluidas subrutas y 404 internas.
- [x] Redirección por rol con aviso al intentar entrar al área de otro perfil.
- [x] Credenciales de ayuda y restauración completa desde el login con confirmación.
- [x] localStorage encapsulado en servicios, sin lógica de credenciales en componentes.
- [x] Gestión de datos corruptos y fallos de almacenamiento.
- [x] Sincronización de sesión entre pestañas del mismo origen.
- [x] 11 pruebas automatizadas de servicios y build correcto.
- [x] Los seis recorridos solicitados comprobados en navegador.

## Etapa 1 · Infraestructura del frontend (histórico)

La entrega vigente es la etapa 3. Los resultados siguientes conservan el historial de la infraestructura inicial.

- [x] React, Vite y TypeScript con comprobación estricta.
- [x] Router principal con redirección inicial.
- [x] Layout público.
- [x] Layout de administrador.
- [x] Layout de residente.
- [x] Acceso temporal mediante selección de perfil, sustituido por login en la etapa 2.
- [x] Página 404 global y dentro de cada perfil.
- [x] Navegación lateral en escritorio y desplegable en móvil.
- [x] Identidad azul con acentos amarillos, estilos globales y accesibilidad básica.
- [x] Carpetas modulares, incluido el límite de servicios.
- [x] README y guía acumulativa de pruebas.
- [x] Verificación final de build y servidor de desarrollo.
- [x] Verificación de navegación en navegador.

## Fases previstas

El objetivo general actualizado define las funciones finales. Esta división organiza su implementación; se debe detener el trabajo al terminar cada etapa y esperar la indicación de continuar. Las fases 1, 2 y 3 están implementadas.

- [x] **Fase 1 — Infraestructura:** implementación y verificación completadas.
- [x] **Fase 2 — Datos, servicios y perfiles:** modelos tipados, datos demo, sesión simulada por rol y localStorage encapsulado en servicios sustituibles por API.
  - [x] Relaciones tipadas entre condominio, usuarios, residencias y vehículos; semilla inicial del prototipo.
  - [x] Casa 24 como residencia del recorrido de presentación.
- [x] **Fase 3 — Comunidad y permisos:** el administrador gestiona estructura, estado y principal de cada casa; el principal administra habitantes y vehículos propios. Consulta administrativa y restricciones en servicios verificadas.
- [ ] **Fase 4 — Contactos frecuentes:** alta, edición y eliminación de contactos propios del residente.
  - [ ] Nombre, teléfono/correo/notas opcionales y varios vehículos con placas y marca/modelo/color opcionales.
  - [ ] Un contacto guardado no concede autorización permanente de entrada.
- [ ] **Fase 5 — Invitaciones:** creación desde contacto o para visitante ocasional sin guardar contacto.
  - [ ] Visitante ocasional: nombre, vehículo sí/no y placas cuando corresponda; demás datos opcionales.
  - [ ] Residente, residencia destino, copia de datos del visitante/vehículo, vigencia, usos permitidos/utilizados, estado y token único simulado.
  - [ ] Editar un contacto no modifica invitaciones históricas.
  - [ ] Consulta de invitaciones, QR y enlace público con destino, vigencia, vehículo y estado; visitante sin cuenta ni instalación.
- [ ] **Fase 6 — Accesos:** simulador del administrador que valida QR/token, registra entrada, registra salida y completa la invitación según sus usos.
  - [ ] Historial consultable por administrador y residente con validaciones de vigencia, estado y usos.
- [ ] **Fase 7 — Reportes:** residente crea y consulta reportes; administrador los consulta y cambia su estado.
- [ ] **Fase 8 — Presentación:** recorrido completo, regresión, pruebas a 375–430 px, 768 px y 1280 px o más; adaptación de formularios/tablas/listas y revisión de accesibilidad.
  - [ ] Crear `docs/PRESENTATION_DEMO.md` con datos y guion reproducible del recorrido final.

Una integración de producción con API queda fuera del prototipo y requiere una solicitud posterior.

## Límites actuales

- Las rutas están protegidas en el frontend; es una simulación que no ofrece seguridad frente a la manipulación del navegador o del código.
- La sesión y los datos demo se guardan en `accesshome.demo.v1`; no hay backend ni cuentas reales.
- Las contraseñas demo están en la semilla local. No se devuelven en los objetos de sesión.
- Contactos, invitaciones, accesos y reportes siguen pendientes.
- Las bajas son desactivaciones reversibles. No hay eliminación física, traslado entre casas ni cambio de contraseñas. Las cuentas adicionales consultan su casa; solo el principal de una casa activa puede gestionarla.
- La migración conserva Casa 25 y otros registros anteriores; restaurar recupera exactamente las cuatro casas de la nueva semilla.
- La sesión no tiene vencimiento automático y se comparte entre pestañas del mismo origen.
- La secuencia de fases futuras puede ajustarse sin omitir los requisitos del objetivo final.

## Verificación de entrega · Etapa 1 · 14 de septiembre de 2026

- `npm install`: instalación correcta, auditoría de npm sin vulnerabilidades reportadas.
- `npm run build`: TypeScript y Vite completados; salida en `dist/`.
- `npm run dev`: servidor disponible en http://127.0.0.1:5173.
- `npm run preview`: build comprobado en http://127.0.0.1:4173.
- Navegación entre perfiles, recarga, historial y páginas 404 comprobados en navegador.
- Revisión visual en escritorio (1366 × 900) y móvil (390 × 844 y 320 × 740).
- Corregido el desbordamiento horizontal a 320 px y verificado el foco de teclado.
- Sin errores ni advertencias en la consola del navegador durante el recorrido.
- No se realizaron commits ni push.

## Archivos principales de la etapa 1

Ajuste al objetivo actualizado: paleta azul/amarilla y checklist del alcance final. Build correcto; revisión adicional en tablet a 768 px y móvil a 375/430 px. Este ajuste conserva el alcance de infraestructura y no inicia una nueva fase funcional.

Archivos de este ajuste: `src/styles/global.css`, `index.html`, `README.md`, `docs/PROTOTYPE_STATUS.md` y `docs/PROTOTYPE_TESTING.md`.

Mensaje de commit sugerido (sin ejecutarlo): `feat: crear infraestructura frontend de AccessHome`.

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`.
- `src/main.tsx`, `src/router.tsx`.
- `src/layouts/`, `src/pages/`, `src/components/`.
- `src/data/navigation.ts`, `src/types/navigation.ts`, `src/hooks/usePageTitle.ts`.
- `src/styles/`, `src/services/README.md`, `src/utils/README.md`.
- `README.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`.

## Verificación y archivos principales de la etapa 2

- Los seis casos pedidos se comprobaron en navegador: error de login, administrador, logout, residente, bloqueo de administración y recarga con sesión.
- Comprobados logout entre pestañas, Atrás después de logout, 404 pública/residente y restricción de una subruta de administrador.
- Revisados login y menú a 375 px, perfil a 768 px y escritorio a 1366 px. Sin desbordamiento en las vistas revisadas ni errores/advertencias de consola.
- Restauración confirmada desde el login; los tests verifican el reemplazo completo y la conservación de datos de otras aplicaciones.
- `npm test`: 11 pruebas correctas. `npm run build`: correcto. Servidor Vite existente comprobado en `http://127.0.0.1:5173`.
- No se instalaron dependencias ni se realizaron commits o push.

Archivos principales:

- `src/data/demo.ts`, `src/types/auth.ts`, `src/types/demo.ts`: cuentas y datos iniciales tipados.
- `src/services/authService.ts`, `demoService.ts`, `demoStorage.ts`, `demoValidation.ts`: autenticación, restauración y persistencia.
- `src/hooks/useAuth.tsx`, `src/components/ProtectedRoute.tsx`, `src/router.tsx`, `src/main.tsx`: estado de sesión y rutas protegidas.
- `src/pages/LoginPage.tsx`, `src/pages/WorkspacePage.tsx`, `src/layouts/WorkspaceLayout.tsx`, `src/components/DemoTools.tsx`: login, perfil, logout y restauración.
- `src/styles/auth.css`, estilos existentes, marca y layout público: integración visual.
- `tests/auth.test.mjs`, `tests/tsconfig.json`, `package.json`, `.gitignore`: ejecución de pruebas sin nuevas dependencias.
- `README.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`: documentación actualizada.

Mensaje de commit sugerido (sin ejecutarlo): `feat: agregar autenticación simulada y sesión persistente`.
