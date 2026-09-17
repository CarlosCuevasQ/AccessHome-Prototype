# Guardia y panel de caseta

Esta etapa reutiliza `profiles.role = 'guard'`, `condominiums`, `invitations` y `access_records`. No crea otro valor de rol ni tablas duplicadas. La UI muestra **Guardia** y utiliza Supabase Auth, los services y el layout existentes. El modo local anterior conserva sus cuentas de administrador y residente; no incluye una cuenta simulada de guardia.

**Estado remoto:** según el contexto proporcionado, las ocho migraciones iniciales y `seed_demo` ya se aplicaron y el login base funciona. La nueva migración de caseta está probada localmente; **no se aplicó ni se comprobó el rol guard remotamente en esta entrega**.

## 1. Aplicar únicamente la incremental, por el responsable

Archivo nuevo: [`20260917000600_guard_workspace.sql`](../supabase/migrations/20260917000600_guard_workspace.sql). Las ocho versiones anteriores permanecen intactas. Esta migración no borra, reinicia, importa ni actualiza filas existentes; añade funciones y amplía `session_profile` para reconocer el rol ya existente.

Con la CLI ya vinculada al proyecto correcto, el responsable puede revisar primero:

```sh
supabase migration list --linked
supabase db push --dry-run
```

Las primeras ocho versiones deben figurar aplicadas; la única pendiente debe ser **20260917000600**. Si aparece otra diferencia, detenerse y reconciliar el historial; no reparar ni volver a ejecutar las ocho por suposición. Cuando el responsable decida aplicar:

```sh
supabase db push
```

Estos comandos son instrucciones manuales; no se ejecutaron en esta entrega. El comportamiento de dry-run y aplicación incremental está descrito en la [referencia CLI de Supabase](https://supabase.com/docs/reference/cli/supabase-db-push). No volver a ejecutar `seed_demo`, `db reset` ni archivos de fixtures contra el proyecto remoto. No modificar `.env.local`: se conservan exactamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

Mantener `accesshome` en **Data API → Exposed schemas**. **No agregar `accesshome_private` a Exposed schemas ni Extra search path**. No conceder `ALL` ni permisos adicionales para resolver errores.

Después de aplicar, ejecutar `npm run backend:check`: debe seguir informando esquema 9 y ahora **guardWorkspaceVersion: 1**. Es una consulta pública de salud, no una prueba de login. El 9 es la versión del contrato base existente, no el número de archivos SQL. Ejecutar también [`supabase/tests/security_baseline.sql`](../supabase/tests/security_baseline.sql) en SQL Editor con el propietario: es una auditoría de solo lectura y debe terminar sin excepciones.

## 2. Crear la cuenta Auth

El responsable del proyecto, desde **Authentication → Users → Add user → Create new user**, crea una cuenta individual con el correo del guardia y una contraseña fuerte y exclusiva. Para una cuenta de ensayo creada por el responsable, confirmar el correo mediante la opción de confirmación del Dashboard; de lo contrario completar la verificación de correo antes del login. Entregar las credenciales directamente al titular por un canal privado. No escribir contraseñas en SQL, código, issues, commits, documentación ni variables `VITE_*`.

Si ya existe la cuenta Auth correcta, reutilizarla y copiar su **User UID**. Crear una cuenta Auth no asigna rol automáticamente. No utilizar `user_metadata` para asignar roles. No transformar una cuenta de administrador o residente en guardia; usar una cuenta de personal independiente. Referencia: [gestión de usuarios y perfiles de Supabase](https://supabase.com/docs/guides/auth/managing-user-data).

## 3. Vincular perfil y condominio

Solo el responsable con acceso al SQL Editor y rol propietario de las migraciones (`postgres` en el proyecto habitual) realiza este procedimiento. Un administrador de la aplicación no tiene este permiso. No se requiere ninguna clave privilegiada en el frontend.

Identificar el condominio existente, sin crear otro:

```sql
select id, name from accesshome.condominiums order by name;
```

Reemplazar los marcadores siguientes por el User UID comprobado, el ID del condominio y el nombre real. No ejecutar marcadores literalmente:

```sql
select accesshome_private.provision_guard(
  'UUID_AUTH_DEL_GUARDIA'::uuid,
  'UUID_CONDOMINIO_EXISTENTE'::uuid,
  'Nombre del guardia'
);
```

Resultado: perfil `guard`, activo, con ese condominio y `residence_id` nulo. No crea residentes/habitantes ni cambia permisos ajenos. Verificar:

```sql
select user_id, display_name, role, condominium_id, residence_id, active
from accesshome.profiles
where user_id = 'UUID_AUTH_DEL_GUARDIA'::uuid;
```

La provisión valida Auth y condominio. Repetir los mismos tres datos es idempotente y **no reactiva** una cuenta desactivada. Un perfil existente de otro rol, otro condominio o con otro nombre provoca error; no se sobrescribe ni se traslada. Las llamadas concurrentes serializan sobre el usuario Auth para evitar altas duplicadas.

## 4. Activar o desactivar

Solo el mismo responsable, con usuario y condominio explícitos:

```sql
select accesshome_private.set_guard_active(
  'UUID_AUTH_DEL_GUARDIA'::uuid,
  'UUID_CONDOMINIO_EXISTENTE'::uuid,
  false
);
```

Para reactivar, repetir con `true`. La función únicamente modifica un perfil `guard` del condominio indicado. No elimina cuentas, historial ni otros datos. El estado se comprueba en cada consulta SQL; un JWT emitido anteriormente no mantiene acceso después de desactivar. Una consulta que ya terminó antes de la desactivación puede haber mostrado información: ninguna revocación puede retirar datos ya entregados. El panel vuelve a consultar cada 30 segundos visible, al recuperar foco/conexión y mediante **Actualizar**; ante error retira los datos consultados. `session_profile` deja de devolver el perfil inactivo.

## 5. Alcance de caseta y permisos

| Función | Alcance |
| --- | --- |
| `/guardia` | Guardia, condominio, reloj sincronizado con servidor en zona del condominio, total de entradas y salidas de hoy |
| Actividad | Cinco entradas y cinco salidas más recientes del propio condominio |
| Pendientes de salida | Total de entradas sin salida y las diez más antiguas; incluye visitas canceladas o vencidas con entrada registrada |
| `/guardia/historial` | Últimos siete días de calendario incluido hoy, filtro entrada/salida, 50 movimientos por página; solo consulta |
| `/guardia/escanear` | Acción principal y aviso **Próxima etapa**; todavía no abre cámara, valida QR ni registra movimientos |
| `/guardia/servicios` y `/guardia/reportes` | Estados de próxima etapa con navegación funcional; no simulan altas ni muestran reportes privados de residentes |

Las proyecciones de acceso incluyen únicamente ID del movimiento, visitante, nombre de casa, entrada/salida, método, fecha y placas. No incluyen tokens, teléfonos, correos, notas, anfitrión ni identificadores de cuentas, invitaciones o residencias. El condominio se obtiene de `auth.uid()` y el perfil activo, nunca de parámetros controlados por el navegador.

Las políticas RLS existentes se conservan: el guardia solo puede leer directamente su perfil y condominio. No recibe listados de residentes, vehículos, invitaciones, accesos completos ni reportes. No tiene escrituras SQL directas. Los RPCs administrativos/residenciales conservan `require_actor` y rechazan `guard`; incluso `validate_access` continúa reservado al flujo administrativo ya existente.

`guard_dashboard` y `guard_history` expuestos son `SECURITY INVOKER`. Sus implementaciones privilegiadas viven en el esquema privado con `search_path` vacío y autorizan internamente cada llamada. Solo `authenticated` puede ejecutar esas dos interfaces/implementaciones; `PUBLIC`, `anon` y `service_role` no. `require_guard`, la proyección interna y las funciones de provisión no reciben EXECUTE de cliente. La autorización procede del perfil SQL, nunca de metadata editable. Este diseño sigue las recomendaciones de [funciones de Supabase](https://supabase.com/docs/guides/database/functions) y [RLS y funciones privadas](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 6. Verificación

Recorrido manual y resultados esperados en [PROTOTYPE_TESTING.md, etapa 10](PROTOTYPE_TESTING.md#etapa-10--guardia-y-caseta). Las pruebas SQL locales utilizan Auth simulado en bases desechables; no sustituyen el login real, PostgREST ni el chequeo remoto de Exposed schemas. La activación remota y esas comprobaciones quedan a cargo del responsable después de aplicar la incremental.
