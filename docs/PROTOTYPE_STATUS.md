# Estado del prototipo AccessHome

## Corrección vigente · Compatibilidad de IDs

- [x] `generateId()` compartido por las 12 altas/generaciones que dependían directamente de `crypto.randomUUID()`.
- [x] Prioridad: UUID nativo, UUID v4 con `getRandomValues`, timestamp + contador + aleatorio como último recurso del prototipo.
- [x] Disponibilidad comprobada con `typeof`; contempla objeto Crypto ausente y métodos no invocables.
- [x] Revisión adicional: seis llamadas a `structuredClone` en semilla/migraciones sustituidas por `cloneJsonData`, con alternativa JSON.
- [x] Reglas de entidades, permisos, vigencias, snapshots y usos conservadas; no se cambian IDs/tokens guardados ni esquema.
- [x] 99 pruebas correctas: las 90 anteriores y nueve de compatibilidad. Incluyen todas las altas, invitación, vista pública y entrada/salida sin UUID nativo y sin Crypto.
- [x] Build correcto; documentación de repetición de la prueba actualizada. Sin dependencias nuevas, restauración de datos, commit ni push.

Se revisaron llamadas directas de APIs del navegador y utilidades modernas en `src/`. Además de Crypto, se corrigió la dependencia no protegida de `structuredClone`. No se encontró uso de `showModal`, portapapeles, cámara, `toSorted`, `toReversed` ni `replaceAll` que requiriera otro ajuste en este alcance. La ausencia de APIs se simula en pruebas aisladas de Node; no se afirma haber probado todas las versiones de navegadores móviles.

Archivos de esta corrección: `src/utils/id.ts`, `src/utils/clone.ts`; `src/services/invitationsService.ts`, `accessService.ts`, `communityService.ts`, `contactsService.ts`, `householdService.ts`, `principalService.ts`, `demoMigration.ts`; `src/data/demo.ts`; `tests/compatibility.test.mjs`; README, ambas guías y documentación de servicios/utilidades.

Commit sugerido: `fix: generar identificadores compatibles sin crypto.randomUUID`.

## Etapa 6 · QR, visitante y control de acceso (vigente)

- [x] QR local en el detalle y vista pública; representa la URL absoluta `/invitacion/{token}` del origen actual.
- [x] Ruta pública sin sesión, con visitante, casa, anfitrión, vigencia, vehículo, placas, estado y QR de 288 px adaptable.
- [x] Proyección pública explícita: sin teléfonos, correos, habitantes, notas ni identificadores internos.
- [x] Visitante puede añadir un vehículo una sola vez a una invitación sin vehículo y antes del primer uso; placas obligatorias, demás datos opcionales.
- [x] Vehículo guardado exclusivamente en la invitación; contactos y vehículos permanentes permanecen separados.
- [x] Control administrativo con selección de invitación activa o token manual y validación explícita.
- [x] Servicio valida rol/condominio, existencia, estado, periodo, residencia activa y usos; no confía en la imagen QR.
- [x] Primera validación registra Entrada; segunda, Salida y Completada; tercera rechazada sin nuevos registros.
- [x] Resultados de autorización en verde y rechazo en rojo con motivo legible.
- [x] Historial administrativo con snapshots de visita, anfitrión, residencia, vehículo, método QR y fecha/hora.
- [x] Uso y registro persistidos en una sola escritura; fallo de almacenamiento no autoriza ni consume usos.
- [x] Esquema 6: migración desde v5 conserva datos, sesión, tokens y usos; añade historial vacío. Restauración incluye movimientos.
- [x] Única dependencia nueva: `qrcode.react` 4.2.0; sin servicios externos, cámara ni hardware.
- [x] 90 pruebas automatizadas correctas: 21 nuevas y 69 de regresión.
- [x] Documentación acumulativa y verificación de navegador, móvil y build.

### Verificación y datos conservados

Recorrido completo con **Visita QR demostración**, invitada por Daniel a Casa 24: consulta pública sin sesión, incorporación de solo placas **QR-9001**, recarga, entrada, salida y tercer rechazo. Quedó Completada con exactamente dos movimientos. También se verificaron tokens inexistentes, cancelados, expirados y de inicio futuro, además de un enlace público inválido. No se restauraron ni borraron datos anteriores ni se consumieron usos de otras invitaciones.

Build final correcto (`tsc --noEmit` y Vite); 90 pruebas de servicios correctas. Revisión a 375, 768 y 1366 px sin desbordamiento en las vistas medidas; consola final sin errores ni advertencias. Servidor de desarrollo disponible en http://127.0.0.1:5173. Sin commit ni push.

El QR y los enlaces funcionan con los datos del mismo navegador, perfil y origen. localStorage no sincroniza otro teléfono ni otro navegador. Para presentar el flujo público, cerrar sesión y abrir el enlace en ese mismo origen, o usar otra pestaña y emulación móvil. No se realizó escaneo con una cámara física.

Archivos principales:

- Servicios: `src/services/publicInvitationService.ts`, `accessService.ts`, `accessRules.ts`, `accessValidation.ts`, migración/validación de datos y contratos de servicios.
- Modelos/semilla: `src/types/access.ts`, `invitations.ts`, `demo.ts`, `src/data/demo.ts`.
- Interfaz: `src/pages/PublicInvitationPage.tsx`, `AccessControlPage.tsx`, `InvitationPage.tsx`, `src/components/access/`, `src/components/invitations/InvitationQr.tsx`, `VisitorVehicleForm.tsx`.
- Integración: `src/router.tsx`, `src/data/navigation.ts`, `src/layouts/PublicLayout.tsx`, `src/utils/invitationLinks.ts`, estilos de acceso/invitaciones/globales y archivos de dependencias.
- Pruebas/documentación: `tests/access.test.mjs`, `tests/public-invitation.test.mjs`, expectativas de migración existentes, README y ambas guías.

Commit sugerido: `feat: agregar QR, vista pública y control de acceso simulado`.

## Etapa 5 · Invitaciones (conservada)

Registro histórico: el espacio pendiente de QR, enlace público y consumo de usos de esta etapa fue sustituido por la implementación funcional de la etapa 6.

- [x] Dos flujos: contacto frecuente con vehículo guardado/ninguno/otro y visitante ocasional.
- [x] Guardado opcional como contacto desmarcado, sin exigir cuenta ni datos extra.
- [x] Hoy, 24 horas y rango personalizado, con validación de fechas y captura en hora local.
- [x] Destino e invitador definidos desde sesión; token único y usos iniciales 0 de 2.
- [x] Snapshot de visitante, teléfono y vehículo; historial conservado tras editar/eliminar contactos.
- [x] Listado compacto, búsqueda, filtros de cuatro estados, detalle y cancelación confirmada de activas.
- [x] Datos principales inmutables; espacio informativo para QR sin implementarlo.
- [x] Servicios validan residencia, principal, estado y pertenencia del contacto/vehículo.
- [x] Consulta de la propia casa para cuentas adicionales; gestión exclusiva del principal activo.
- [x] Esquema 5: migración desde v4 conserva todos sus datos y añade invitaciones vacías. Reset actualizado.
- [x] 69 pruebas automatizadas correctas; build de TypeScript/Vite correcto.
- [x] Documentación acumulativa con los ocho recorridos solicitados y casos adicionales.

El estado Completada ya se reconoce al alcanzar los usos máximos; aún no hay interfaz para consumirlos. El QR, enlace público y simulador de accesos siguen pendientes. No se instalaron dependencias ni se realizaron commits/push.

Navegador: probados contacto con vehículo activo, contacto sin vehículo, otro vehículo, ocasional, guardado opcional, fechas personalizadas, cancelación, búsqueda/filtro y persistencia. Snapshot conservado tras cambiar nombre y vehículo del contacto de prueba; acceso ajeno rechazado y cuenta adicional en consulta. Se corrigió y verificó la captura inmediata de fecha/hora. Se conservaron datos anteriores y registros de prueba; detalle en la guía acumulativa.

Expiración automática observada sin recargar, con cancelación bloqueada y filtro correcto. Revisión responsive a 375, 768 y 1366 px sin desbordamientos; consola sin errores/advertencias. Build final correcto. Servidor de desarrollo disponible en http://127.0.0.1:5173.

Archivos principales: `src/types/invitations.ts`, `src/services/invitationsService.ts`, `invitationRules.ts`, `invitationSnapshot.ts`, `invitationValidation.ts`, migración/validación/semilla, `src/components/invitations/`, `src/pages/InvitationsPage.tsx`, `NewInvitationPage.tsx`, `InvitationPage.tsx`, router/navegación, `src/styles/invitations.css`, `src/utils/dates.ts`, `tests/invitations.test.mjs` y documentación.

Commit sugerido: `feat: implementar invitaciones con snapshots y permisos por residencia`.

## Ajuste conservado · Eliminación de contactos y vehículos

- [x] Eliminar un contacto propio y sus vehículos asociados.
- [x] Eliminar un vehículo de un contacto sin eliminar el contacto ni sus otros vehículos.
- [x] Eliminar un vehículo permanente de la propia casa sin afectar habitantes, casa ni agenda.
- [x] Confirmación explícita con descripción del registro, Cancelar y errores de guardado visibles.
- [x] Permisos revalidados en servicios: propietario/principal, pertenencia y residencia activa.
- [x] Cambios persistentes; resumen y listados se actualizan mediante las notificaciones existentes.
- [x] 51 pruebas automatizadas correctas, build correcto y revisión de confirmaciones/cancelación a 375 px.
- [x] README y guía acumulativa actualizados. Sin cambios de esquema, dependencias, commit ni push.

El borrado es definitivo. Continúa la desactivación reversible como alternativa. No se añadió eliminación de casas ni habitantes. Las confirmaciones se revisaron en el navegador sin borrar registros guardados; las eliminaciones se ejecutaron en pruebas automatizadas con almacenamiento aislado.

Archivos principales: `src/components/DeleteAction.tsx`, `src/services/contactsService.ts`, `src/services/householdService.ts`, `src/components/contacts/ContactDetail.tsx`, `src/components/community/HouseholdDetail.tsx`, `ResidenceContent.tsx`, `src/pages/ContactsPage.tsx`, estilos de comunidad/contactos y `tests/deletion.test.mjs`.

Commit sugerido: `feat: permitir eliminar contactos y vehículos propios`.

## Etapa 4 · Contactos frecuentes (conservada)

El botón Invitar descrito en el registro de esta etapa fue sustituido por el flujo funcional de la etapa 5.

- [x] Agenda privada vinculada al residente propietario, independiente de la residencia y de sus habitantes.
- [x] Solo el principal consulta o modifica su agenda; validación en cada operación del servicio.
- [x] Cambio de principal no transfiere contactos; administrador y cuentas adicionales sin acceso.
- [x] Nombre obligatorio, teléfono/correo/notas opcionales y estado activo/inactivo.
- [x] Cero, uno o varios vehículos por contacto; placas obligatorias y resto de datos opcionales.
- [x] Vehículos de contactos separados de los vehículos permanentes, sin alterar los contadores de comunidad.
- [x] Listado compacto, búsqueda por nombre/teléfono/correo/placas, detalle, creación y edición.
- [x] Desactivación y reactivación de contactos/vehículos conservando sus datos.
- [x] Formularios en una columna, botones de al menos 48 px y navegación responsive.
- [x] Invitar visible, con ruta preparada que informa que no se ha generado autorización.
- [x] Datos demo de Carlos López, María González y Pedro Ramírez para Daniel.
- [x] Esquema 4 y migración de versiones 1/2/3 sin reinicio de comunidad ni sesión.
- [x] Restauración de datos incluye contactos y vehículos de contactos.
- [x] README y guía acumulativa con los ocho casos manuales solicitados.
- [x] `npm run build` correcto; `npm test` con 45 pruebas correctas, incluidas las 32 de etapas anteriores.
- [x] Verificación de navegador: alta, edición, varios vehículos, desactivación/reactivación, búsqueda, persistencia, privacidad y ruta Invitar.

### Verificación y datos conservados

Se creó para Daniel el contacto Laura Sánchez Ruiz, teléfono ficticio 3312345099, nota “Visita habitual de demostración”. Tiene LRS-9001 (Mazda 3 azul, inactivo) y LRS-9002 (Honda Civic, activo); contacto activo. Se comprobó que esos vehículos no aparecen en el registro permanente de Casa 24. La cuenta de Ana no puede abrir este contacto y la cuenta adicional de Mariana no accede a la agenda.

Interfaz revisada a 375 × 812, 768 × 1024 y 1366 × 1000, sin desbordamiento horizontal en las vistas medidas. El servidor Vite se reinició para resolver una caché de importación de la nueva hoja CSS y funciona en http://127.0.0.1:5173. Se conservaron los datos y asignaciones de etapas anteriores.

Archivos principales: `src/types/contacts.ts`, `src/data/contacts.ts`, `src/services/contactsService.ts`, `contactRules.ts`, `contactValidation.ts`, `demoMigration.ts`, `demoValidation.ts`, `src/components/contacts/`, `src/components/PrincipalRoute.tsx`, `src/pages/ContactsPage.tsx`, `ContactPage.tsx`, navegación/layouts, `src/router.tsx`, `src/styles/contacts.css` y `tests/contacts.test.mjs`.

No se añadieron dependencias ni se implementó la creación de invitaciones. No se realizó commit ni push.

Mensaje de commit sugerido: `feat: agregar agenda privada de contactos frecuentes`.

## Etapa 3 · Corrección de responsabilidades (conservada)

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

La entrega vigente es la etapa 6. Los resultados siguientes conservan el historial de la infraestructura inicial.

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

El objetivo general actualizado define las funciones finales. Esta división organiza su implementación; se debe detener el trabajo al terminar cada etapa y esperar la indicación de continuar. Las fases 1 a 6, incluido QR/enlace público y control administrativo, están implementadas. Las ampliaciones pendientes se indican por separado.

- [x] **Fase 1 — Infraestructura:** implementación y verificación completadas.
- [x] **Fase 2 — Datos, servicios y perfiles:** modelos tipados, datos demo, sesión simulada por rol y localStorage encapsulado en servicios sustituibles por API.
  - [x] Relaciones tipadas entre condominio, usuarios, residencias y vehículos; semilla inicial del prototipo.
  - [x] Casa 24 como residencia del recorrido de presentación.
- [x] **Fase 3 — Comunidad y permisos:** el administrador gestiona estructura, estado y principal de cada casa; el principal administra habitantes y vehículos propios. Consulta administrativa y restricciones en servicios verificadas.
- [x] **Fase 4 — Contactos frecuentes:** agenda privada del principal, alta, búsqueda, detalle, edición y desactivación/reactivación de contactos y sus vehículos.
  - [x] Nombre obligatorio, teléfono/correo/notas opcionales y varios vehículos con placas obligatorias y marca/modelo/color opcionales.
  - [x] Un contacto guardado no concede autorización permanente de entrada; Invitar abre el formulario de visita.
- [x] **Fase 5 — Invitaciones:** creación desde contacto o para visitante ocasional sin guardar contacto.
  - [x] Visitante ocasional: nombre, vehículo sí/no y placas cuando corresponda; demás datos opcionales.
  - [x] Residente, residencia destino, copia de visitante/vehículo, vigencia, usos, estado y token único simulado.
  - [x] Editar o eliminar un contacto no modifica invitaciones históricas.
  - [x] Consulta, búsqueda, estados, cancelación y confirmación responsive.
- [x] **Fase 5B — QR y visitante:** QR y enlace público con destino, vigencia, vehículo y estado; visitante sin cuenta ni instalación, con vehículo opcional posterior.
- [x] **Fase 6 — Accesos:** simulador del administrador que valida QR/token, registra entrada, registra salida y completa la invitación según sus usos.
  - [x] Historial administrativo con validaciones de vigencia, estado, condominio y usos.
  - [ ] Ampliación posterior: consulta detallada de movimientos desde el residente (no solicitada en esta entrega).
- [ ] **Fase 7 — Reportes:** residente crea y consulta reportes; administrador los consulta y cambia su estado.
- [ ] **Fase 8 — Presentación:** recorrido completo, regresión, pruebas a 375–430 px, 768 px y 1280 px o más; adaptación de formularios/tablas/listas y revisión de accesibilidad.
  - [ ] Crear `docs/PRESENTATION_DEMO.md` con datos y guion reproducible del recorrido final.

Una integración de producción con API queda fuera del prototipo y requiere una solicitud posterior.

## Límites actuales

- Las rutas están protegidas en el frontend; es una simulación que no ofrece seguridad frente a la manipulación del navegador o del código.
- La sesión y los datos demo se guardan en `accesshome.demo.v1`; no hay backend ni cuentas reales.
- Las contraseñas demo están en la semilla local. No se devuelven en los objetos de sesión.
- Invitaciones, QR/enlace público y control administrativo implementados. Reportes y consulta detallada de movimientos desde el residente pendientes.
- El QR contiene una URL con token; no lleva los datos ni los sincroniza entre dispositivos. Otro navegador/perfil/origen no tendrá la invitación. No hay lector de cámara ni hardware de acceso.
- El simulador representa un puesto local. Una API futura deberá validar permisos y aplicar transacciones para varios puestos simultáneos; localStorage no ofrece seguridad ni transacciones entre dispositivos.
- Contactos y vehículos admiten eliminación definitiva o desactivación reversible. Los habitantes solo se desactivan. No hay traslado entre casas ni cambio de contraseñas. Las cuentas adicionales consultan su casa; solo el principal de una casa activa puede gestionarla.
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
