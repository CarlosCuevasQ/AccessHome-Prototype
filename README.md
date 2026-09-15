# AccessHome

Prototipo funcional para una presentación universitaria sobre seguridad residencial.

## Estado actual

Etapa 2: autenticación simulada. Incluye React, Vite, TypeScript, React Router, login por correo y contraseña, logout, sesión persistente, protección de rutas por rol, restauración de datos demo y los layouts responsive de la etapa 1.

La autenticación es exclusivamente de demostración: los datos y contraseñas demo están disponibles en el frontend y se guardan localmente. Las restricciones de navegación no constituyen seguridad real. No utilizar cuentas ni datos personales reales. No hay backend ni servicios externos.

## Ejecutar

Requisito: Node.js `^20.19.0` o `>=22.12.0` y npm. Entorno de verificación: Node.js 24.11.0 y npm 11.6.1.

```sh
npm install
npm run dev
```

Abre http://127.0.0.1:5173. El puerto es fijo: si está ocupado, detén el proceso que lo utiliza antes de iniciar otra instancia.

```sh
npm run build
npm test
npm run preview
```

El build valida TypeScript y genera `dist/`. La vista previa del build está en http://127.0.0.1:4173. Ninguno de estos comandos publica el sitio.

## Rutas y prueba rápida

| Ruta | Resultado |
| --- | --- |
| `/` | Lleva al login o al inicio del perfil si existe sesión |
| `/login` | Formulario de acceso; con sesión redirige al inicio del perfil |
| `/admin` | Inicio exclusivo del administrador |
| `/residente` | Inicio exclusivo del residente |
| Cualquier ruta desconocida | Página 404 |
| `/admin/no-existe` o `/residente/no-existe` | 404 dentro del layout correspondiente, solo con el rol adecuado |

Sin sesión, cualquier ruta de perfil redirige al login. Con un rol distinto, redirige al inicio propio con un aviso de acceso restringido.

### Datos de prueba

| Perfil | Nombre | Correo | Contraseña |
| --- | --- | --- | --- |
| Administrador | Administrador Demo | `admin@accesshome.demo` | `Access123` |
| Residente | Daniel Cuevas | `residente@accesshome.demo` | `Access123` |

Semilla centralizada en `src/data/demo.ts`: Residencial Los Encinos, Casa 24 y Casa 25, con dos vehículos asociados a Casa 24 (`DEMO-024`, Nissan Versa gris; `DEMO-124`, Toyota Corolla blanco). Daniel está asociado a Casa 24. Son datos ficticios; esta etapa muestra el contexto de perfil, sin implementar gestión de residencias ni vehículos.

1. En el login, prueba la contraseña `incorrecta`: debe aparecer **Correo o contraseña incorrectos**.
2. Ingresa como administrador con `Access123`: debe abrir `/admin` y mostrar Administrador Demo.
3. Pulsa **Cerrar sesión** en el menú: vuelve al login. En móvil, primero pulsa **Abrir menú**.
4. Ingresa como residente: debe abrir `/residente`, mostrar Daniel Cuevas y Casa 24.
5. Escribe `/admin` en la dirección: vuelve a `/residente` con un aviso; no muestra administración.
6. Recarga: la sesión y el perfil se conservan.

### Restaurar la demostración

Cierra sesión y pulsa **Restaurar datos demo** en el login, después **Confirmar restauración**. Reemplaza todos los datos del prototipo por la semilla original y elimina la sesión compartida entre las pestañas del mismo origen. No modifica datos de otras aplicaciones. La función es `demoService.resetDemoData()`.

La persistencia usa únicamente la clave `accesshome.demo.v1`. La sesión dura hasta cerrar sesión, restaurar o borrar los datos del navegador. Se comparte entre pestañas del mismo origen; `localhost`, `127.0.0.1` y distintos puertos tienen almacenamientos separados. No se sobrescriben automáticamente datos corruptos: se ofrece restauración explícita. Si el navegador bloquea localStorage, se muestra un error y no se simula un guardado exitoso.

## Organización

```text
src/
  components/   Marca, navegación, protección de rutas y herramientas demo
  layouts/      Layout público y layouts de perfiles
  pages/        Login, inicio de perfil y 404
  services/     Autenticación, restauración, validación y persistencia local
  data/         Semilla demo y navegación por perfil
  types/        Tipos compartidos
  hooks/        Estado de sesión y título de página
  utils/        Destino inicial por rol
  styles/       Estilos globales, layouts y páginas
  main.tsx      Montaje de React
  router.tsx    Árbol principal de rutas
```

Las pantallas consumen los servicios asíncronos `authService` y `demoService`. Solo `services/demoStorage.ts` accede a localStorage. `AuthProvider` mantiene el estado de presentación y se suscribe a cambios del servicio; `ProtectedRoute` aplica la navegación por rol. La sesión persistida contiene únicamente `userId`; el servicio resuelve los datos del usuario y nunca devuelve la contraseña en el objeto de sesión. Una futura API Django podrá sustituir los servicios conservando sus contratos.

La interfaz usa azul oscuro `#123B5D`, azul principal `#1E5A88` y acentos amarillos `#F2B705` sobre amarillo suave `#FFF4CC` en los indicadores de etapa. Los botones principales siguen siendo azules. Utiliza fuentes del sistema, separadores discretos y navegación por teclado. No requiere fuentes, imágenes ni recursos externos en ejecución.

Los módulos de gestión, contactos frecuentes, invitaciones con QR y enlace público, simulación de entrada/salida, historial y reportes quedan pendientes. Su checklist se mantiene en el documento de estado. La presentación final incluirá `docs/PRESENTATION_DEMO.md`.

## Documentación

Pruebas automatizadas sin dependencias adicionales: `npm test` compila los servicios en `.test-build/` y ejecuta 11 pruebas con el ejecutor nativo de Node. Cubren credenciales, persistencia, logout, restauración, aislamiento de datos y fallos de almacenamiento. La guía acumulativa registra además las pruebas en navegador, incluidas restricciones por rol y sesión entre pestañas.

- [Estado y fases previstas](docs/PROTOTYPE_STATUS.md)
- [Guía acumulativa de pruebas](docs/PROTOTYPE_TESTING.md)

Para un futuro alojamiento estático, configurar la redirección de rutas hacia `index.html` para soportar React Router. No se ha configurado alojamiento en esta etapa.
