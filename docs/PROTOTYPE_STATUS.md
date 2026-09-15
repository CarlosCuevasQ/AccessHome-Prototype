# Estado del prototipo AccessHome

## Etapa 2 · Autenticación simulada

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

La entrega vigente es la etapa 2. Los resultados siguientes conservan el historial de la infraestructura inicial.

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

El objetivo general actualizado define las funciones finales. Esta división organiza su implementación; se debe detener el trabajo al terminar cada etapa y esperar la indicación de continuar. Las fases 1 y 2 están implementadas.

- [x] **Fase 1 — Infraestructura:** implementación y verificación completadas.
- [x] **Fase 2 — Datos, servicios y perfiles:** modelos tipados, datos demo, sesión simulada por rol y localStorage encapsulado en servicios sustituibles por API.
  - [x] Relaciones tipadas entre condominio, usuarios, residencias y vehículos; semilla inicial del prototipo.
  - [x] Casa 24 como residencia del recorrido de presentación.
- [ ] **Fase 3 — Comunidad:** consulta del condominio, administración de residencias y consulta de residentes/vehículos para el administrador; consulta de residencia, residentes asociados y vehículos para el residente.
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
- La gestión de comunidad, contactos, invitaciones, accesos y reportes sigue pendiente.
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
