# Estado del prototipo AccessHome

## Etapa 1 · Infraestructura del frontend

- [x] React, Vite y TypeScript con comprobación estricta.
- [x] Router principal con redirección inicial.
- [x] Layout público.
- [x] Layout de administrador.
- [x] Layout de residente.
- [x] Acceso temporal mediante selección de perfil.
- [x] Página 404 global y dentro de cada perfil.
- [x] Navegación lateral en escritorio y desplegable en móvil.
- [x] Identidad azul con acentos amarillos, estilos globales y accesibilidad básica.
- [x] Carpetas modulares, incluido el límite de servicios.
- [x] README y guía acumulativa de pruebas.
- [x] Verificación final de build y servidor de desarrollo.
- [x] Verificación de navegación en navegador.

## Fases previstas

El objetivo general actualizado define las funciones finales. Esta división organiza su implementación; se debe detener el trabajo al terminar cada etapa y esperar la indicación de continuar. Solo la fase 1 está implementada.

- [x] **Fase 1 — Infraestructura:** implementación y verificación completadas.
- [ ] **Fase 2 — Datos, servicios y perfiles:** modelos tipados, datos demo, sesión simulada por rol y localStorage encapsulado en servicios sustituibles por API.
  - [ ] Condominio con administradores y múltiples residencias; cada residencia con residentes y vehículos.
  - [ ] Casa 24 como residencia del recorrido de presentación.
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

- Las rutas de perfiles están abiertas; elegir un perfil no crea una sesión ni valida permisos.
- No hay operaciones de negocio, usuarios reales ni datos guardados.
- `services/` documenta el contrato arquitectónico; localStorage se añadirá con los primeros datos.
- La secuencia de fases futuras puede ajustarse sin omitir los requisitos del objetivo final.

## Verificación de entrega · 14 de septiembre de 2026

- `npm install`: instalación correcta, auditoría de npm sin vulnerabilidades reportadas.
- `npm run build`: TypeScript y Vite completados; salida en `dist/`.
- `npm run dev`: servidor disponible en http://127.0.0.1:5173.
- `npm run preview`: build comprobado en http://127.0.0.1:4173.
- Navegación entre perfiles, recarga, historial y páginas 404 comprobados en navegador.
- Revisión visual en escritorio (1366 × 900) y móvil (390 × 844 y 320 × 740).
- Corregido el desbordamiento horizontal a 320 px y verificado el foco de teclado.
- Sin errores ni advertencias en la consola del navegador durante el recorrido.
- No se realizaron commits ni push.

## Archivos principales de la etapa

Ajuste al objetivo actualizado: paleta azul/amarilla y checklist del alcance final. Build correcto; revisión adicional en tablet a 768 px y móvil a 375/430 px. Este ajuste conserva el alcance de infraestructura y no inicia una nueva fase funcional.

Archivos de este ajuste: `src/styles/global.css`, `index.html`, `README.md`, `docs/PROTOTYPE_STATUS.md` y `docs/PROTOTYPE_TESTING.md`.

Mensaje de commit sugerido (sin ejecutarlo): `feat: crear infraestructura frontend de AccessHome`.

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`.
- `src/main.tsx`, `src/router.tsx`.
- `src/layouts/`, `src/pages/`, `src/components/`.
- `src/data/navigation.ts`, `src/types/navigation.ts`, `src/hooks/usePageTitle.ts`.
- `src/styles/`, `src/services/README.md`, `src/utils/README.md`.
- `README.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`.
