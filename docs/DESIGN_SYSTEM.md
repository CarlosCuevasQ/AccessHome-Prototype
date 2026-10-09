# AccessHome · Sistema de diseño (Prompts 15, 15.2 y 15.3)

## Prompt 15.3 · Experiencia residente

Refinamiento de presentación sin cambios de negocio: services, Auth, roles, contratos, QR/cámara, RPC/RLS, datos, reportes de caseta y CSV permanecen intactos. No requiere backend, migración ni instalación. Se conservan los cambios previos y el sidebar. `resident.css`, importado después de `composition.css`, limita la composición a `.resident-experience`; los patrones de acción y skeleton se reutilizan sin alterar operaciones.

### Composición y decisiones UX

- **Inicio:** identidad de casa sobre azul claro y Nueva invitación como único CTA principal. Próxima visita destacada, estado actual y actividad compacta. Contactos frecuentes y gestión de casa quedan en módulos secundarios. El orden del DOM y del móvil sigue contexto, próximas visitas, estado, actividad y accesos secundarios; no se inventan cifras ni se reinterpretan permisos.
- **Invitaciones:** filtros agrupados; filas con icono, visitante/estado, periodo, vehículo/usos y un botón Ver detalle. Contactos es una ayuda contextual separada del CTA principal.
- **Detalle:** nombre y estado; acciones para compartir; datos y QR en columnas de escritorio; vigencia agrupada, vehículo solo cuando existe e información secundaria desplegable. En pantallas amplias compartir ocupa una franja horizontal; en móvil los bloques se apilan. La cancelación está separada y usa rojo. No se muestran UUID internos como información principal. El QR conserva generación, token, tamaño lógico, quiet zone y condiciones de disponibilidad previas.
- **Compartir:** botón azul con icono, WhatsApp tonal y Copiar como acción terciaria. Feedback persistente con `role=status`, copia manual/fallback existentes y ayuda breve desplegable. Nunca se envía WhatsApp automáticamente.
- **Residencia:** casa y estado en cabecera, principal destacado, habitantes como lista semántica, vehículos como entidades con placas y propietario. En escritorio amplio, habitantes/vehículos comparten dos columnas; en móvil se apilan y cada ficha conserva sus datos. Los editores son los mismos. El cierre del detalle devuelve el foco al disparador.
- **Reportes residenciales:** índice en filas; detalle con título/estado/categoría, descripción en superficie blanca y metadata en lateral de seguimiento. Volver es una acción visible con flecha. El avance administrativo conserva su función y autorización.

Hick se aplica mediante una acción primaria y divulgación progresiva; Gestalt mediante regiones y divisores; jerarquía mediante superficies azul claro/blanco, tamaños y acentos amarillos. No se añaden dashboards ficticios, gradientes, emojis ni capas de tarjetas decorativas.

### Componentes, skeletons y accesibilidad

`ActionLink` conserva semántica de enlace para navegación y ofrece variantes primary, secondary, ghost, back y detail. Botones de operaciones siguen siendo `button`. Iconos originales, lineales y decorativos (`aria-hidden`) reutilizan la misma familia. Se añaden flecha de volver, chevron, coche, reloj, compartir, copia y mensaje.

Skeletons nuevos: `invitation-detail`, `residence`, `report`, con proporciones de contenido/columna lateral. Dashboard/lista/formulario reutilizan los existentes. No se añaden cargas artificiales ni skeletons durante refresh silencioso con datos existentes; empty, error y success conservan mensajes diferenciados.

Se reutiliza **React Bits FadeContent ya adaptado** para aparición de cabeceras de residencia, invitaciones y detalle de reporte. Es el mismo patrón de entrada de cabecera existente, 240 ms / 4 px, sin contadores animados ni dependencias adicionales. Continúan licencia MIT + Commons Clause, atribución y fallback sin animación; consultar la sección de licencia más abajo. Microinteracción pressed de 1 px / 160 ms solo con movimiento permitido.

Se mantienen tokens de paleta/espaciado, contraste, foco visible, etiquetas reales y estados textuales. Controles de mínimo 44 px. Información representada con `dl`, listas, headings y regiones; no se simulan tablas con divs. Enlaces de detalle tienen nombre específico por registro. Menú móvil y Disclosure conservan teclado/Escape. La medición en siete anchos y el contraste automático no equivalen a certificación WCAG: zoom real, lector de pantalla y movimiento reducido del sistema siguen pendientes.

### Bundle y validación de 15.3

Sin dependencias nuevas; package.json/lockfile intactos. JS principal 747.72 → **755.17 kB** (gzip 208.84 → **210.39**); CSS 61.40 → **80.99 kB** (gzip 11.46 → **13.93**). JS+CSS comprimidos +4.02 kB. Decoder QR 34.83 / 14.29 gzip sin cambios. Persiste la advertencia >500 kB. La mayor incorporación es CSS local de composición, no una biblioteca de animación.

224/224 pruebas; 37/37 concurrencia; TypeScript/build compartido, deployment check y diff check aprobados. Revisión de seis pantallas a 375/390/430/768/1024/1280/1440 px. Datos de prueba SQL temporales, Auth simulado; no se operó Supabase remoto. Recorrido, capturas y límites en [PROTOTYPE_TESTING.md](PROTOTYPE_TESTING.md).

### Inventario de archivos de 15.3

Nuevos:
- `src/components/ActionLink.tsx`
- `src/styles/resident.css`

Modificados en esta etapa:
- `src/pages/ResidentDashboardPage.tsx`
- `src/pages/ResidencePage.tsx`
- `src/pages/InvitationsPage.tsx`
- `src/pages/InvitationPage.tsx`
- `src/pages/ReportsPage.tsx`
- `src/pages/ReportPage.tsx`
- `src/pages/NewInvitationPage.tsx` y `src/pages/NewReportPage.tsx` (presentación de Volver)
- `src/components/community/ResidenceContent.tsx`
- `src/components/community/ResidenceTables.tsx`
- `src/components/invitations/InvitationShare.tsx`
- `src/components/invitations/CancelInvitation.tsx`
- `src/components/access/RecentAccess.tsx` (enlace de historial con el patrón compartido)
- `src/components/UpcomingInvitations.tsx`
- `src/components/Icon.tsx`
- `src/components/Skeleton.tsx`
- `src/styles/global.css`
- `tests/helpers/invitation-preview.mjs` (rutas de pruebas locales hacia SQL existente)
- `README.md`, `docs/DESIGN_SYSTEM.md`, `docs/PROTOTYPE_STATUS.md`, `docs/PROTOTYPE_TESTING.md`

Los cambios de otras etapas ya presentes en el árbol no pertenecen a este inventario. No se modificó el sidebar, Supabase, migraciones, `.env.local` ni lógica de negocio. No se hizo commit, push o despliegue.

## Sistema de base y refinamiento 15.2

El refinamiento 15.2 conserva el sidebar de escritorio y la arquitectura funcional. Cambia la composición de login, inicio de residente, caseta, administración, servicios y reportes. **No requiere migraciones ni dependencias npm nuevas.** No modifica services, RPC, RLS, Auth, cámara, QR, snapshots, CSV ni datos remotos.

## Principios y composición

- **Jerarquía:** casa e invitación en residencia; escaneo en caseta; actividad y supervisión en administración. Las métricas se agrupan por significado y reciben tamaños distintos.
- **Hick:** una operación dominante; controles secundarios mediante `Disclosure`. Caseta muestra hasta tres entradas abiertas y un enlace a la lista completa. No oculta la salida sin QR.
- **Proximidad:** regiones de actividad, contexto y pendientes, separadas por espacio/divisores. Superficies blancas para entidades y azul/amarillo suaves para contexto. No todo recibe una tarjeta.
- **Percepción de rendimiento:** skeletons por estructura, sin esperas artificiales. El dashboard imita módulo grande + columna secundaria; las listas conservan sus variantes. `useCommunityQuery` conserva datos durante el refresco periódico y no activa skeletons para ese refresco. Un error de autorización/red conserva el tratamiento previo de datos no verificables.

`composition.css` se importa después de `design-system.css` y antes de `resident.css` (15.3). Define los patrones de 15.2 sin redefinir sidebar, navegación o permisos. Se reutilizan tokens y hojas de dominio existentes.

Grid editorial de 12 columnas: 8/4 en escritorio, 7/5 hasta 1150 px, una columna hasta 700 px. Cada rol organiza el contenido según su objetivo; no se impone un dashboard idéntico a todos. El residente mantiene próximos visitantes a la izquierda, estado de residencia a la derecha y actividad compacta debajo. En móvil: contexto, acción, próximas visitas, estado, actividad.

## Paleta, tipografía y superficies

| Token | Valor / función |
| --- | --- |
| `--color-brand-dark` | #123B5D · navegación, identidad, bloque de escaneo |
| `--color-brand-primary` | #1E5A88 · acciones, enlaces, foco |
| `--color-brand-light` | #EAF3F8 · contexto y resumen |
| `--color-accent` | #F2B705 · acentos y acción de escaneo, con texto oscuro |
| `--color-pending-surface` | #FFF4CC · pendientes |
| `--color-surface` | #FFFFFF · entidades/formularios |
| `--color-background` | #F6F8FA · fondo |
| `--color-text` | #17212B |
| `--color-muted` | #5B6672 |
| `--color-control-border` | #778695 |
| `--color-success` / surface | #23603B / #EDF7F0 |
| `--color-danger` / surface | #922B32 / #FFF2F2 |
| `--color-warning` | #634909 sobre amarillo suave |

`tokens.css` conserva los alias históricos (`--primary`, `--action`, etc.). Espaciado: 4/8/12/16/24/32/48 px. Radios: 7/12/16 px para controles/unidades/diálogos. Tipografía del sistema, cuerpo 16 px, secundaria 14 px, h3 18 px, h2 22 px; títulos editoriales fluidos 30–40 px y métricas principales 40–56 px. Cifras tabulares, line-height cómodo, sin uso indiscriminado de negrita.

Tres niveles: fondo gris claro, superficie blanca, superficies tonales. Sombras pequeñas en entidades y una sombra moderada en el mockup. Sin degradados, neón, glassmorphism, fotografías externas ni animación permanente.

## Patrones y componentes

- **`OperationalTimeline`:** lista semántica `ol/li`, hora y fecha en `time`, icono, tipo, nombre, destino/placas, método/responsable y aviso opcional. Admite entrada, salida, servicio, rechazo, invitación y finalización. El caller conserva el orden del backend; el componente no calcula permisos, métricas ni estados. Detalles opcionales usan `Disclosure` nativo.
- **Actividad reciente:** `RecentAccess` usa el timeline en los tres dashboards. El estado vacío es específico. El historial sigue disponible. Caseta limita solo la presentación del resumen a tres pendientes; la lista operativa completa no cambia.
- **Próximas visitas:** `UpcomingInvitations` reutiliza `invitationsService.listInvitations('', 'activa')`, muestra hasta dos invitaciones sin usos ordenadas por inicio. No autoriza accesos ni calcula el estado de vigencia. Fechas con el formateador existente del dispositivo y leyenda explícita. El RPC actual devuelve la colección activa: esta etapa no añade paginación de backend.
- **Módulos de dashboard:** cifra principal, métricas pareadas o filas compactas. Los números son los DTO existentes. No se inventa una cifra de personas dentro para el residente. En caseta, el total de hoy se etiqueta como movimientos porque el backend devuelve entradas y salidas juntas.
- **Servicios:** categoría con radios nativos de 48 px, destino, identificación y campos opcionales desplegables. Las flechas cambian de categoría; texto y selección visible acompañan el color. Registrar llegada conserva la confirmación posterior y nunca concede entrada. Filtros rápidos anuncian `aria-pressed` y conservan el select completo.
- **Reportes:** identificación y periodo; resumen ejecutivo agrupado; pendientes amarillos; incidencias/observaciones; bitácora; CSV. El índice agrupa visitantes, servicios y pendientes. La bitácora distribuye identidad/contexto en columnas desde 1100 px y se apila en móvil; vehículo, horarios y notas se expanden por movimiento. Se conservan paginación, filtro/orden y exportación completa independientemente del filtro.
- **Componentes reutilizados:** Brand, Icon, Skeleton, Disclosure, AccessNotice, EditorForm, ServiceDecision, GuardReportForm, InvitationQr y layouts existentes. Iconos originales de una sola familia; se añaden entrada y flecha. No biblioteca de iconos nueva.

## Login y smartphone original

Layout de altura mínima completa, 48/52 en escritorio, sin tarjeta exterior. Izquierda azul oscuro con identidad, mensaje y composición de producto; derecha clara con formulario directamente sobre la superficie. La autenticación conserva exactamente su service, validación y tratamiento de sesión/error.

`LoginPhone` es HTML/CSS/SVG propio: marco genérico, Casa 24, invitación conceptual y símbolo de escaneo. No representa una sesión, invitación ni QR real; es decorativo, `aria-hidden`, sin controles interactivos, tokens ni enlaces. No copia un dispositivo o captura externa.

Hasta 800 px se apila: cabecera compacta y una fracción pequeña del teléfono, seguida del formulario. No se obliga a recorrer una ilustración grande. La invitación pública conserva su header/footer y decisiones de QR; la variante full-height se limita al login.

## React Bits, licencia y motion

Se usa **una adaptación de FadeContent en dos patrones**: aparición del mockup del login y cabecera de dashboards. Fuente TypeScript sin Tailwind: [React Bits FadeContent, revisión fijada](https://github.com/DavidHDev/react-bits/blob/1eeb6f105c68b964289d85dabbe84a1d551f3797/src/ts-default/Animations/FadeContent/FadeContent.tsx).

La variante upstream usa GSAP/ScrollTrigger. La adaptación `src/components/react-bits/FadeContent.tsx` conserva el patrón de entrada por opacidad, usando Web Animations al montar: **240 ms y 4 px**, sin blur, retraso, observadores de scroll ni repetición durante refresh. No se instala GSAP, Motion, React Bits completo ni Tailwind. Si la API no existe, el contenido permanece visible.

Licencia upstream **MIT + Commons Clause**, copyright 2026 David Haz; no describirla como MIT sin condiciones. Texto íntegro en `src/components/react-bits/LICENSE.md` y copia distribuible `public/licenses/react-bits.txt`. Permite integración en una aplicación, con las condiciones y atribución de esa licencia; no distribuir/vender el componente como biblioteca independiente ignorándolas.

`prefers-reduced-motion` evita la animación inicial y cancela una animación activa si cambia la preferencia; enfocar un control también la cancela. El cleanup libera animación/listeners. CSS conserva feedback hover/pressed de 160 ms y un desplazamiento máximo de 1 px, solo con hover y movimiento permitido. No se animan contadores ni se retrasa feedback operativo. El skeleton sigue pulsando solo durante carga; la regla global de movimiento reducido lo desactiva.

## Accesibilidad y responsive

Se conservan labels, validación nativa, errores asociados y `role=alert`, botones textuales, estados con texto/icono y foco visible de 3 px. Los objetivos táctiles son de al menos 44 px, categorías 48 px y escaneo 60 px. El icono no reemplaza la etiqueta. El mockup no añade ruido al lector de pantalla.

El sidebar y `WorkspaceLayout` se conservaron sin edición en 15.2. Hasta 900 px permanece el drawer modal existente, no una barra con demasiados destinos. Tab/Shift+Tab, Enter/Space y Escape siguen el comportamiento nativo; Escape devuelve el foco al menú. `Disclosure` conserva Escape y devolución de foco. No se añaden modales ni confirmaciones para navegación normal.

Verificaciones realizadas y pendientes se detallan en [PROTOTYPE_TESTING.md](PROTOTYPE_TESTING.md). Se midió ausencia de overflow horizontal en los siete anchos para login, tres dashboards, servicios, reporte detallado y QR público local. Hay capturas inspeccionadas de escritorio y móvil. Esto no equivale a revisar todas las combinaciones de datos, navegadores, estados o tecnologías asistivas, ni a una certificación WCAG 2.2 AA. Zoom real al 200 %, lector de pantalla, preferencia de movimiento del sistema y dispositivos físicos siguen pendientes.

## Validación y performance de 15.2

`npm test`: 224/224 (incluye dos pruebas de contraste). `npm run test:concurrency`: 37/37 en PostgreSQL temporal local. `npm run build:vercel`: aprobado, incluye TypeScript. `npm run deployment:check` y `git diff --check`: aprobados. No hay script independiente de lint/typecheck. Sin cambios en package.json/lockfile.

| Artefacto | Antes de 15.2 | Después de 15.2 | Gzip antes → después |
| --- | ---: | ---: | ---: |
| JS principal | 738.04 kB | 747.72 kB | 206.68 → 208.84 kB |
| CSS | 43.45 kB | 61.40 kB | 8.57 → 11.46 kB |
| Decoder QR diferido | 34.83 kB | 34.83 kB | 14.29 → 14.29 kB |

Aumento de transferencia JS principal ~1.05 %; JS + CSS comprimidos +5.05 kB. La licencia estática no se descarga con cada navegación. Continúa la advertencia conocida de chunk >500 kB; no se hizo un refactor de rutas ni se añadieron dependencias pesadas.

## Archivos de 15.2

Nuevos:
- `src/components/OperationalTimeline.tsx`
- `src/components/UpcomingInvitations.tsx`
- `src/components/LoginPhone.tsx`
- `src/components/react-bits/FadeContent.tsx`
- `src/components/react-bits/LICENSE.md`
- `public/licenses/react-bits.txt`
- `src/styles/composition.css`

Modificados:
- `src/components/access/RecentAccess.tsx`
- `src/components/GuardReportLog.tsx`
- `src/components/GuardReportSummary.tsx`
- `src/components/Icon.tsx`
- `src/components/services/ServiceArrivalForm.tsx`
- `src/components/services/ServiceSummary.tsx`
- `src/layouts/PublicLayout.tsx`
- `src/pages/CondominiumPage.tsx`
- `src/pages/GuardDashboardPage.tsx`
- `src/pages/GuardReportsPage.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/ResidentDashboardPage.tsx`
- `src/pages/ServiceAccessPage.tsx`
- `src/styles/global.css`
- `README.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/PROTOTYPE_STATUS.md`
- `docs/PROTOTYPE_TESTING.md`

El árbol ya contenía cambios de Prompt 15 antes de esta etapa; este inventario distingue los cambios de 15.2. No se revirtieron cambios previos. Las capturas de prueba son locales, en `.test-build/visual-15.2/`, fuera del bundle y de Git.
