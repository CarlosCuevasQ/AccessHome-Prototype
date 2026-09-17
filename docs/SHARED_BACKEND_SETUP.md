# Configurar el backend compartido de AccessHome

Esta guía describe la instalación base en un proyecto nuevo. El responsable ya confirmó que la base existente está activada, con ocho migraciones y semilla aplicadas. **No repetir estos pasos en ese proyecto.** Para la etapa actual seguir [GUARD_SETUP.md](GUARD_SETUP.md): únicamente la incremental de caseta, pendiente de aplicación remota. No es necesario compartir contraseñas ni claves administrativas con el agente.

Los ocho archivos base incluyen la [revisión SQL, permisos y concurrencia](SQL_MIGRATION_REVIEW.md). Conservan nombres y orden, incluyen el control de superposición y no dejan SECURITY DEFINER en el esquema expuesto. Para una instalación nueva de la versión actual, añadir después `20260917000600_guard_workspace.sql` antes de ejecutar la auditoría `security_baseline.sql`.

## 1. Preparar el proyecto y las dos variables

Crear un proyecto Supabase nuevo, exclusivo de pruebas. Guardar su contraseña de PostgreSQL en un gestor de contraseñas. En Dashboard obtener Project URL y la clave publishable que comienza por `sb_publishable_`.

Copiar .env.example a .env.local solo si este último todavía no existe; no sobrescribir la configuración del usuario. Completar únicamente:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Los valores están vacíos deliberadamente: deben ser los del proyecto real. .env.local está ignorado por Git. Todas las variables VITE son públicas; la configuración admite únicamente estas dos y rechaza claves secretas/JWT heredados. Reiniciar Vite después de editar.

`npm run dev` usa esa configuración. `npm run dev:local` conserva una demostración sin backend en 127.0.0.1:5174, sin tocar el archivo ni el almacenamiento del puerto 5173.

## 2. Aplicar SQL cuando se autorice la fase remota

No ejecutar este paso hasta confirmar el proyecto y autorizar las migraciones. Revisar que sea el proyecto nuevo de ensayo. Si ya contiene tablas AccessHome, detenerse y reconciliar su historial; no resetear ni repetir indiscriminadamente.

Ejecutar como propietario de migraciones, cada archivo completo una sola vez, en este orden:

1. 20260916000100_community.sql
2. 20260916000200_visits_and_reports.sql
3. 20260916000300_read_policies.sql
4. 20260917000100_shared_community.sql
5. 20260917000200_shared_invitations.sql
6. 20260917000300_shared_public_and_access.sql
7. 20260917000400_shared_reports_and_dashboards.sql
8. 20260917000500_controlled_demo_provisioning.sql

Se pueden ejecutar por SQL Editor, registrando nombre/fecha/resultado en el historial operativo, o con el mecanismo versionado de Supabase cuando esté configurado. No se instaló CLI ni se vinculó un proyecto desde este trabajo. No usar db reset.

La cuarta migración comprueba pgcrypto en el esquema extensions. Si está instalado en otro esquema, reconciliarlo antes de continuar; no cambiarlo a ciegas.

Después, ejecutar `supabase/tests/security_baseline.sql`: es una auditoría de solo lectura y debe terminar sin excepción. Exponer únicamente `accesshome` como esquema de esta aplicación en Data API. No exponer accesshome_private ni auth. No habilitar tablas completas para anon ni escrituras generales para authenticated.

Dejar también `accesshome_private` fuera de Extra search path. Su USAGE para clientes es intencional: permite que los wrappers SECURITY INVOKER resuelvan implementaciones privadas con EXECUTE limitado. No añade tablas/RPCs privados a Data API ni permite crear objetos. No agregar grants generales si una llamada falla.

## 3. Crear usuarios Auth sin guardar contraseñas en el repositorio

En Auth, habilitar email/contraseña y desactivar registro abierto y anonymous sign-in. Mediante Dashboard, el responsable crea cuentas confirmadas de ensayo con correos controlados y contraseñas fuertes, distintas y guardadas en su gestor. No reutilizar antiguas credenciales locales. No usar user_metadata para asignar roles.

Crear al menos:

| Clave de provisión | Identidad conceptual | Destino |
| --- | --- | --- |
| admin | Administrador Demo | Condominio, rol admin |
| daniel | Daniel Cuevas | Casa 24, principal |
| ana | Ana López | Casa 12, principal |
| mariana (recomendado) | Mariana Torres | Casa 24, consulta |

Las claves opcionales jorge, luis y elena vinculan las personas de esas casas a cuentas existentes. Sin esos UUID, siguen siendo habitantes sin cuenta. Andrea y Carlos son habitantes sin cuenta. La cuenta de guardia se vincula por separado mediante [GUARD_SETUP.md](GUARD_SETUP.md), sin repetir esta semilla.

Los correos pueden diferir de los de la demo local: conservar las identidades conceptuales. Comunicar las credenciales al participante por un canal privado, no por README, tickets, commits ni scripts seed. Configurar Site URL del frontend y redirects exactos para los futuros flujos de Auth; esta etapa utiliza signInWithPassword y no procesa callbacks de recuperación/confirmación en la app. La recuperación de cuentas queda a cargo del responsable mediante Dashboard.

## 4. Asignación inicial controlada y semilla

Obtener los UUID Auth desde Dashboard. Verificar cuidadosamente la correspondencia cuenta/persona antes de ejecutar SQL. Los UUID no son contraseñas, pero no publicar la lista de identidades de participantes.

Como propietario de las migraciones, usar SQL Editor en el proyecto de ensayo:

```sql
select accesshome_private.seed_demo(jsonb_build_object(
  'admin', 'REEMPLAZAR_POR_UUID_AUTH_ADMIN',
  'daniel', 'REEMPLAZAR_POR_UUID_AUTH_DANIEL',
  'ana', 'REEMPLAZAR_POR_UUID_AUTH_ANA',
  'mariana', 'REEMPLAZAR_POR_UUID_AUTH_MARIANA'
));
```

Son marcadores deliberadamente no ejecutables; reemplazarlos por UUID existentes. La función requiere admin/daniel/ana distintos, valida que cada UUID exista en auth.users y rechaza toda base que ya tenga un condominio. No utiliza UPSERT, no sobrescribe, no cambia contraseñas y no crea identidades Auth. Todo el lote se confirma o revierte junto.

Genera Residencial Los Robles, casas 12/24/37/51, ocho habitantes, cinco vehículos permanentes y tres contactos privados de Daniel con vehículos. Devuelve los UUID del condominio y Casa 24. No crea invitaciones: se generarán al probar los flujos.

Después de aplicar, comprobar los perfiles y principales desde SQL Editor y la aplicación. Conservar el registro de quién verificó/aplicó esta asignación. Las funciones seed_demo/provision_resident no se conceden a anon, authenticated ni service_role y su esquema no es público en Data API.

## 5. Vincular otra cuenta de residente y cambiar principal

El principal puede crear un habitante sin cuenta en su casa. El responsable crea luego su usuario Auth fuera del frontend y verifica su identidad/residencia. Para vincularlo, ejecutar como propietario:

```sql
select accesshome_private.provision_resident(
  'REEMPLAZAR_POR_UUID_AUTH_EXISTENTE'::uuid,
  'REEMPLAZAR_POR_UUID_HABITANTE_SIN_CUENTA'::uuid
);
```

La función rechaza un habitante inactivo/ya vinculado y un usuario que ya tenga perfil. No permite mover una identidad entre residencias ni autoasignar admin. Una vinculación nueva siempre es resident. Para otros roles, esta etapa solo provee el admin inicial de la semilla; no existe autoservicio de elevación.

El administrador de AccessHome puede después seleccionar un habitante activo **con cuenta ya vinculada a esa casa** como principal. Esta operación no crea usuarios Auth; guarda un registro privado de principal anterior, nuevo, operador y fecha. El principal anterior conserva consulta y pierde gestión inmediatamente en SQL.

## 6. Comprobar conexión y sesión

Solo después de autorizar/aplicar las migraciones y exponer accesshome:

```sh
npm run backend:check
npm run dev
```

El chequeo solo llama backend_health con la clave publishable y debe mostrar:
`Conexión correcta: AccessHome, esquema 9.`
No consulta perfiles ni modifica datos. No ejecutarlo todavía si se quiere evitar toda conexión remota.

Interpretación de errores:

- Configuración incompleta: completar las dos variables y reiniciar.
- HTTP 401/403: revisar proyecto, clave publishable y grants.
- Esquema no expuesto/RPC no encontrado: revisar Data API y orden de migraciones; no abrir todas las tablas.
- Login correcto en Auth pero perfil no habilitado: revisar UUID, rol, active, residencia y habitante activo. La app no concede rol por defecto.
- Fallo de red: resolverlo y volver a consultar. Nunca se cambia a datos locales.

Iniciar sesión con Daniel. Debe mostrar Casa 24 y Modo compartido. Cerrar sesión y comprobar que las rutas protegidas vuelven al login. Probar una contraseña incorrecta sin que aparezca una cuenta demo local.

La prueba definitiva entre dispositivos está en PROTOTYPE_TESTING.md. Ambos deben utilizar un frontend que apunte al mismo proyecto. localhost en un teléfono apunta al propio teléfono: para dos dispositivos se necesita una dirección de frontend accesible por ambos, preferiblemente HTTPS. No se publicó ni configuró hosting en esta entrega.

## Seguridad y límites de esta etapa

Los tokens de 64 caracteres hex se generan con 32 bytes de pgcrypto y se almacenan en una tabla privada. El visitante solo recibe un objeto limitado por token. No registrar URLs de invitaciones en analítica, capturas públicas o logs; index.html configura no-referrer, y el futuro servidor de hosting debería emitir también esa cabecera.

El RPC público limita frecuencia con 256 buckets fijos y 240 solicitudes por minuto/bucket. También cobra los tokens inválidos; las colisiones de bucket pueden limitar varias visitas juntas. Es una protección básica adecuada para pruebas controladas, no mitigación completa de DoS ni límite por IP. No se habilitó una ruta alternativa que eluda ese control.

Listados filtran y ordenan en SQL dentro del alcance autorizado. Dashboards usan agregados y cinco accesos recientes; los listados completos del prototipo todavía no tienen paginación visible y conviene usar volúmenes de demostración.

Pendientes de validar en el proyecto: Auth real y sus políticas, PostgREST, refresco/expiración de JWT y dos dispositivos a través de la API. PGlite usa una sola conexión; las carreras de invitaciones se prueban adicionalmente con PostgreSQL 17.10 local y conexiones TCP independientes mediante `npm run test:concurrency`. Ambos entornos simulan Auth, por lo que no sustituyen la validación remota.

Referencias oficiales: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [usuarios Auth](https://supabase.com/docs/guides/auth/managing-user-data), [eventos de sesión](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).


