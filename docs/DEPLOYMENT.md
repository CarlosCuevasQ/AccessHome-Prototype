# Compartir invitaciones y desplegar el ensayo en Vercel

## Estado de esta entrega

Código preparado y probado localmente. **No se creó un deployment, no se aplicó SQL remoto ni se modificó `.env.local`.** El frontend actual incluye el escáner y requiere la incremental `20260918000100_guard_scanning.sql`, además de caseta `20260917000600` y consulta pública `20260917000700`. Las ocho iniciales ya están aplicadas según su confirmación; verificar qué incrementales faltan en el historial. No repetir versiones ni ejecutar `seed_demo` o reset.

No hay un dominio configurado o inventado en el repositorio. Los botones y el QR utilizan `window.location.origin`: el origen real desde el cual se abrió el deployment, seguido de `/invitacion/` y el token. No hace falta una variable adicional para la URL pública. El build de Vercel exige HTTPS y un nombre de dominio al generar enlaces; rechaza localhost, IP y nombres locales. El modo de desarrollo conserva sus enlaces locales con una advertencia explícita.

## 1. Preparar el mismo Supabase de ensayo

1. En Supabase Dashboard, seleccionar el proyecto exclusivo de ensayo que ya contiene las cuentas y Casa 24. Comprobar la referencia del proyecto y el historial antes de ejecutar SQL.
2. Revisar las versiones aplicadas. Con CLI ya vinculada por el responsable, `supabase migration list` y `supabase db push --dry-run` permiten revisar qué falta. Si se usó SQL Editor, consultar el registro de aplicación y reconciliar el historial antes de usar CLI. No aplicar todas las versiones de nuevo.
3. Si falta `20260917000600_guard_workspace.sql`, completar primero su aplicación conforme a [GUARD_SETUP.md](GUARD_SETUP.md). No volver a provisionar perfiles existentes.
4. Si falta, aplicar [20260917000700_public_invitation_sharing.sql](../supabase/migrations/20260917000700_public_invitation_sharing.sql), completa, desde SQL Editor como propietario controlado o mediante el procedimiento CLI revisado. Tiene transacción propia; no actualiza filas, tokens, cuentas ni invitaciones.
5. Aplicar la incremental de escaneo `20260918000100_guard_scanning.sql` según [GUARD_SCANNING.md](GUARD_SCANNING.md), solo si está pendiente. No editar ni repetir las diez anteriores. Esta versión amplía el registro/motor existente sin reescribir movimientos.
6. Ejecutar la auditoría de solo lectura [security_baseline.sql](../supabase/tests/security_baseline.sql), correspondiente a las once migraciones. Debe finalizar sin excepciones. Mantener únicamente `accesshome` expuesto para la app; `accesshome_private` debe seguir fuera de Data API y Extra search path.
7. Ejecutar `npm run backend:check` desde el equipo configurado. Debe informar base AccessHome, esquema 9, `guardWorkspaceVersion: 1`, **`publicInvitationVersion: 2`** y **`guardScanningVersion: 1`**. El número de esquema base se conserva por compatibilidad; no cuenta archivos de migración. Este chequeo no prueba login ni cámaras/navegadores y no se ejecutó remotamente en esta entrega.

La incremental sustituye la proyección del RPC público: visitante, casa, condominio, fechas, estado y el mismo token. Retira del resultado público anfitrión, vehículo, usos y permiso de edición; no expone teléfono o correo. Conserva la firma del RPC para clientes anteriores, pero `vehicle` distinto de `null` devuelve un error de solo lectura y no actualiza filas. La pantalla pública muestra únicamente la consulta solicitada; el residente prepara cualquier vehículo al crear la invitación. Aplicar backend y frontend en la misma ventana de prueba, porque la proyección anterior contenía más campos.

## 2. Importar el repositorio desde GitHub

El responsable debe revisar y publicar estos cambios en su repositorio cuando lo autorice. Importar ahora una revisión antigua de GitHub no incluiría esta preparación. Esta tarea no hizo commit ni push.

En Vercel: **Add New → Project → Import Git Repository**, conectar GitHub y seleccionar el repositorio existente de AccessHome. Elegir la rama/revisión revisada. La importación y los deployments posteriores pueden integrarse con Git; revisar qué rama dispara el despliegue de ensayo. [Guía de Vercel con Git](https://vercel.com/docs/git).

Configurar:

| Opción | Valor |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | Raíz del repositorio, donde está `package.json` |
| Install Command | `npm ci` |
| Build Command | `npm run build:vercel` |
| Output Directory | `dist` |
| Node.js | 24.x |

`vercel.json` ya fija framework, build y salida. `build:vercel` comprueba TypeScript, compila en modo `shared` y revisa el artefacto. Falla si faltan las variables públicas; así no se publica accidentalmente la demo local. No ejecuta migraciones ni necesita funciones Vercel, servidor Node persistente o una segunda base de datos.

## 3. Variables públicas

En Settings → Environment Variables, copiar **exactamente** los nombres de [.env.example](../.env.example):

| Nombre | Valor que debe aportar el responsable |
| --- | --- |
| `VITE_SUPABASE_URL` | URL HTTPS del proyecto Supabase de ensayo seleccionado |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Su clave pública con prefijo `sb_publishable_` |

Obtener ambos valores del mismo proyecto, en su panel Connect/API Keys. Seleccionar los entornos Vercel que se usarán: Preview y, si la URL estable de este proyecto de ensayo será la de Production, también Production. El nombre Production de Vercel no obliga a usar una base Supabase productiva. No cargar `.env.local` en Git ni copiar valores en capturas, tickets o documentación.

No añadir `service_role`, `sb_secret_*`, contraseña de PostgreSQL, JWT secret o credenciales Auth a ninguna variable `VITE_*`. El build rechaza claves heredadas/privilegiadas y nombres VITE adicionales. Los metadatos automáticos `VITE_VERCEL_*` se toleran pero no se incluyen en el frontend; no son configuración requerida. La app solo expone las dos variables anteriores. Cambiar variables requiere un nuevo build/deployment.

El login actual usa correo/contraseña de Supabase y no requiere OAuth ni un callback nuevo para esta etapa. Conservar las cuentas existentes, RLS y autorización SQL. No habilitar registro abierto para permitir al visitante entrar: su consulta es anónima y limitada por token.

## 4. Publicar y elegir la dirección real

Después de revisar migración, variables y pruebas, **el responsable** puede pulsar Deploy. No se realizó desde esta tarea. Usar la URL HTTPS que Vercel muestre realmente en el deployment o en Settings → Domains. Para enlaces duraderos, abrir la app desde el dominio estable del proyecto antes de compartir; un enlace creado desde una URL de preview seguirá apuntando a esa preview y dejará de servir si se elimina.

Comprobar desde incógnito que el dominio elegido abre la aplicación sin pedir una cuenta Vercel. Deployment Protection puede anteponer su propio login, especialmente en previews: el responsable debe elegir/configurar deliberadamente un deployment de ensayo accesible para los visitantes. No añadir contraseñas de bypass o secretos a los enlaces. RLS y los permisos de AccessHome siguen siendo obligatorios. [Protección de deployments](https://vercel.com/docs/deployment-protection).

React Router resuelve `/invitacion/:token` fuera de las rutas protegidas. La reescritura de `vercel.json` entrega `index.html` para rutas SPA, por lo que un enlace directo o F5 pueden cargar React y consultar Supabase. Los archivos estáticos siguen siendo servidos por Vercel. Verificarlo después del deployment; la prueba local no prueba su CDN. [Vite y rutas SPA en Vercel](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas).

## 5. Revisar el artefacto y proteger los enlaces

Antes de publicar:

```sh
npm test
npm run test:concurrency
npm run build
npm run build:vercel
npm run deployment:check
```

Los dos builds son locales: no suben archivos ni hacen llamadas a Supabase. `deployment:check` inspecciona `dist` y falla ante claves `sb_secret_*`, JWT con rol `service_role`, claves privadas, conexiones PostgreSQL con contraseña o archivos `.env`/SQL/claves privadas. No imprime coincidencias ni valores. No es un detector universal de contraseñas arbitrarias: revisar además las variables Vercel, el diff y que el deployment publique únicamente `dist`. URL de proyecto y clave publishable sí deben estar en el bundle; son públicas y la protección está en SQL/RLS.

Después del deployment, revisar el build log para confirmar `build:vercel` y la inspección del artefacto, sin volcar variables. En DevTools → Network, verificar que los assets pertenecen al deployment y las llamadas RPC al Supabase de ensayo. No exportar HAR ni copiar encabezados Auth o cuerpos de solicitudes. Comprobar que la consulta usa POST a `public_invitation`, no tokens como parámetros de URL del endpoint.

Los tokens existentes son capacidades públicas aleatorias de 32 bytes, generadas con pgcrypto y separadas del ID interno. Cualquiera con el enlace puede consultar esa visita. La aplicación no los registra, no incorpora analítica y genera el QR localmente con `qrcode.react`; no envía el token a un proveedor de QR. Compartir nativo o WhatsApp solo ocurre por una acción explícita del residente. Web Share necesita soporte del navegador/contexto seguro; al faltar, se intenta copiar y, si el portapapeles falla, se ofrece selección manual. Cancelar el menú no dispara un envío alternativo. [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

El frontend envía `Referrer-Policy: no-referrer` y `noindex`; sus rutas de invitación añaden `Cache-Control: no-store`. El RPC también devuelve `Cache-Control: no-store`. Noindex no sustituye autorización. No agregar analítica, grabación de sesión ni captura de URLs completas en estas rutas. Hosting, WhatsApp y el navegador necesariamente procesan la dirección compartida; no se garantiza que sus registros externos omitan la ruta. Revisar las opciones de logs/drains del proveedor y evitar exportar rutas con tokens, capturas de enlaces reales o QR a herramientas de análisis. Usar invitaciones desechables de ensayo en las comprobaciones.

## 6. Aceptación manual después del deployment

Datos: residente real principal de Casa 24, invitado ficticio sin información sensible, dos navegadores sin sesión compartida y un teléfono. Ambos dispositivos usan el mismo deployment y proyecto de ensayo.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Iniciar sesión como residente y crear una visita de 24 horas | Detalle con destino correcto, estado Activa y QR; fila persistida en Supabase |
| 2 | Pulsar Enviar por WhatsApp | Abre WhatsApp con mensaje breve y enlace HTTPS del dominio real; elegir destinatario y enviar sigue siendo decisión manual |
| 3 | Pulsar Copiar enlace; probar también Compartir invitación | Copia exactamente `/invitacion/TOKEN` con origen público; menú nativo si existe o copia alternativa; ningún localhost/LAN |
| 4 | Pegar el enlace en otro navegador/incógnito sin sesión | Abre directamente la visita, sin login; no requiere localStorage del residente |
| 5 | Abrir ese enlace desde un teléfono, preferentemente con datos móviles | Misma visita, controles legibles y sin desplazamiento horizontal |
| 6 | Escanear el QR con otro dispositivo | Abre la misma visita en el dominio real. Solo aparecen visitante, destino, vigencia, estado e instrucciones; no anfitrión, teléfono, correo ni vehículo |
| 7 | Cancelar desde el residente y confirmar | Detalle Cancelada, sin QR utilizable; cancelación compartida guardada |
| 8 | En el visitante pulsar Actualizar estado o F5 | Nueva consulta a Supabase; no depende de caché/localStorage de dominio |
| 9 | Revisar ambas pantallas | Cancelada y QR retirado en ambas. Con página visible también refresca cada 10 s; al recuperar foco/conexión consulta de nuevo |
| 10 | Abrir/recargar directamente `/invitacion/TOKEN` en el hosting | Sin 404 de Vercel ni redirección a login; muestra el estado actual |

Adicionalmente, dejar vencer una invitación corta y completar otra mediante el flujo administrativo ya existente: deben mostrar Expirada/Completada y retirar el QR. Un token inexistente muestra Invitación no disponible sin revelar otras visitas. Ante fallo de consulta se retiran los datos/QR y se permite reintentar. Un QR guardado en una captura no demuestra vigencia: el backend debe validar el estado al operar el acceso.

Estas comprobaciones remotas, WhatsApp real, Web Share nativo y cámara física **siguen pendientes**. Las pruebas locales aprobadas y sus límites se registran en [PROTOTYPE_TESTING.md](PROTOTYPE_TESTING.md).

Para el escáner, abrir `/guardia/escanear` directamente desde el dominio HTTPS publicado y completar E-01–E-13 de esa guía. No hace falta una ruta API de Vercel ni infraestructura de video: solo cámara local, el decodificador estático y el RPC Supabase existente. No habilitar cámara automáticamente ni desactivar restricciones de seguridad del navegador para la prueba.
