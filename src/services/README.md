# Capa services de AccessHome

Las pantallas conservan los contratos de los services. Cada fachada elige, una vez por proceso, la implementación local o la compartida. No hay fallback por operación ni sincronización implícita.

- shared/provider.ts: modo compartido si cualquiera de las dos variables públicas tiene contenido.
- shared/client.ts: cliente Supabase autenticado y cliente público separado, ambos schema accesshome y clave publishable. El público no persiste sesión, no renueva Auth ni lee la sesión del residente.
- shared/auth.ts: signInWithPassword, getSession + perfil desde RPC, logout y eventos diferidos para evitar reentrar en el lock de Auth.
- shared/adapters.ts: contratos existentes → RPCs tipados. No recibe tablas privadas, no guarda bases en localStorage.
- shared/transport.ts: errores y notificaciones después de escribir. Sin caché de dominio; publicRpc usa exclusivamente el cliente anónimo y public_invitation. Token en cuerpo POST, sin logs.
- invitationSharingService.ts: Web Share por gesto del usuario, copia alternativa/manual, cancelación sin acciones adicionales. invitationLinks.ts centraliza el mismo origen y URL para QR, WhatsApp y copia; no envía mensajes.
- demoStorage.ts: exclusivo de local, rechaza cualquier acceso si el proveedor es compartido.

Todos los RPCs expuestos son security invoker. Las operaciones privilegiadas llaman implementaciones security definer del esquema privado con search_path vacío y comprobaciones explícitas de identidad/rol/propiedad. Las funciones privadas de formato no elevan privilegios; las de autorización consultan solo el actor autenticado. No se permite escritura genérica de clientes.

| Contrato | RPCs principales |
| --- | --- |
| authService | session_profile + Supabase Auth |
| communityService / householdService | community_summary, list_residences, residence_details, manage_community, manage_household |
| principalService | assign_principal (cuenta previamente vinculada) |
| contactsService | contact_access, list_contacts, contact_details, manage_contact |
| invitationsService | invitation_context, list_invitations, invitation_details, create_invitation, cancel_invitation |
| publicInvitationService | public_invitation (proyección mínima anónima, límite de frecuencia y operación de vehículo previa conservada) |
| accessService | active_access_invitations, validate_access, list_access |
| accessHistoryService | history_context, list_access |
| reportsService | report_context, list_reports, report_details, create_report, advance_report |
| guardReportsService | guard_reports(operation, input, request_id): context, preview, generate, list, detail; solo compartido, separado de reportes residenciales |
| guardReportsService.log / loadShiftExport | guard_report_log(report_id, kind, page, newest_first); DTO de eventos sin IDs internos, páginas de 50; exportación completa explícita con límite de 10 000 |
| serviceAccessService | service_context, list_services, service_command; llegadas/decisiones/movimientos de caseta, sin aprobación residencial |
| dashboardService | admin_dashboard, resident_dashboard |
| guardService | guard_dashboard, guard_history y validate_access(token, request_id, scan_method); solo compartido, guard activo y condominio autorizado; sin escrituras directas |
| demoService | profile_context; reset rechazado en compartido |

El dominio no cambia de proveedor durante una sesión. Una configuración parcial o caída de red falla explícitamente. El modo local conserva la simulación, pero la selección de cuenta por correo no representa autenticación real.

La hora autoritativa compartida es la del servidor. Hoy/historial diario utilizan la zona del condominio; formularios personalizados y presentación de fechas usan la hora del dispositivo y envían ISO con zona. El token público se genera exclusivamente en servidor con 32 bytes CSPRNG. El UUID para request_id de acceso usa Web Crypto con disponibilidad comprobada. `validateSharedAccess` es el adaptador único para administrador y guardia. Un fallo ambiguo conserva token, método y request_id en memoria para reintentar; recuperar la misma sesión Auth no los borra, pero cambiar de cuenta/cerrar sesión sí. No se guarda historia local. Tras recargar completamente o cambiar de cuenta, revisar historial antes de iniciar otra operación.

**Reportes de caseta:** sus campos datetime-local representan explícitamente la zona del condominio; envían `start`/`end` sin conversión del navegador y SQL convierte con AT TIME ZONE. `generate` envía solo esos dos campos y notes/incidents; `generateSharedShift` añade request_id criptográfico y conserva el ID en memoria ante errores. No acepta ni transmite totales/autor/condominio/hora de generación. SQL vuelve a calcular y guarda un snapshot finalizado con referencias fuente; misma solicitud recupera el mismo reporte. Nueva solicitud para mismo guardia/periodo se rechaza por unicidad. Ver reglas de fechas/ambigüedad, métricas y permisos en [GUARD_REPORTS.md](../../docs/GUARD_REPORTS.md).

El guardia lista solo sus cierres; admin lista los del propio condominio con fecha de inicio/guardia y páginas de 50. El resumen se conserva; la bitácora usa `guard_report_log` sin SELECT directo y sin recibir source_ids/request_id/command_input/tokens ni UUID de usuarios/eventos. SQL decide pertenencia mediante referencias guardadas. Cierres nuevos incluyen referencias de contexto para conservar la secuencia al cierre; cierres antiguos se proyectan con contexto limitado y aviso. No consulta estados vivos para inventar horas.

`loadShiftExport` recorre páginas autorizadas de todos los tipos en orden ascendente solo por acción explícita; limita a 10 000 filas, verifica total y descarta descarga si falla o se cancela. `shiftCsv` crea 20 columnas estables, UTF-8/BOM/CRLF, escapa fórmulas, comillas y saltos, y selecciona cada propiedad explícitamente (sin serializar JSON/IDs). Fechas y horas se formatean en zona del reporte; horas relacionadas incluyen fecha. La UI muestra pendientes al generar, nunca los cierra. No hay caché local ni fallback local para servicios/cierres.

`guardScanSession` acepta tokens de 64 caracteres hexadecimales o enlaces `/invitacion/TOKEN`, sin navegar URLs ni registrar su contenido. Bloquea frames/solicitudes mientras valida, conserva el resultado hasta Siguiente y bloquea nuevas lecturas ante una respuesta incierta. `qrCamera` abre solo por gesto, carga `qr/decode.js` bajo demanda, procesa imágenes localmente y libera todos los tracks al detener, detectar, salir o esconder la página. Ninguno decide permisos o vigencia: esa autoridad permanece en SQL.

La incremental `20260918000100` conserva el RPC administrativo de dos argumentos como adaptador al mismo motor de tres argumentos. Este verifica guard/admin activo, condominio, residencia, token, vigencia, usos y secuencia histórica. El resultado guard limita el movimiento a ID, visitante, residencia, vehículo, tipo, método, fecha y nombre de operador. Reintentos confirmados llevan `replayed: true`: la UI los muestra en amarillo como recuperación de un registro, sin autorizar un nuevo paso. Concurrencia y ráfagas también muestran advertencias sin insertar. No existe escritura React de `authorized`.

Los hooks refrescan al consultar, recuperar foco/conexión o tras mutación. El polling existente pasa a 10 segundos en compartido y se pausa con pestaña oculta. Caseta/historial guard usan 30 segundos; el historial guard limita a siete días con páginas de 50 movimientos. Las consultas filtradas son nuevas cada vez. Los otros listados completos todavía no ofrecen paginación visible; usar datos de ensayo.

PublicInvitation contiene exactamente token, visitorName, residenceName, condominiumName, startsAt, expiresAt y status. La vista pública no presenta datos de anfitrión, contacto o vehículo. El DTO nuevo requiere la incremental 20260917000700; no cambiar las migraciones aplicadas. La firma pública conserva su parámetro `vehicle` para compatibilidad, pero la incremental lo rechaza como escritura: no se ofrece `addVehicle` en el modo compartido y el residente define el vehículo al crear la invitación. El modo local de demostración mantiene su contrato separado y no mezcla datos con Supabase.

Validación: regresión local, PostgreSQL/PGlite, PostgreSQL nativo concurrente y SDK con HTTP simulado. Prompt 14 funciona según el responsable. La incremental 15 de detalle y su aceptación remota/física siguen pendientes; ver [GUARD_REPORTS.md](../../docs/GUARD_REPORTS.md). No se ejecutaron nuevas pruebas contra Supabase ni despliegues.

