# AccessHome

Prototipo funcional para una presentación universitaria sobre seguridad residencial.

## Estado actual

Etapa 1: infraestructura del frontend. Incluye React, Vite, TypeScript, React Router, acceso temporal por perfil, layouts público/administrador/residente, navegación adaptable y páginas 404.

El acceso temporal no autentica usuarios. Las rutas de administrador y residente son públicas durante esta etapa. No se requieren credenciales ni se guardan datos. No hay backend, servicios externos ni módulos de gestión.

## Ejecutar

Requisito: Node.js `^20.19.0` o `>=22.12.0` y npm. Entorno de verificación: Node.js 24.11.0 y npm 11.6.1.

```sh
npm install
npm run dev
```

Abre http://127.0.0.1:5173. El puerto es fijo: si está ocupado, detén el proceso que lo utiliza antes de iniciar otra instancia.

```sh
npm run build
npm run preview
```

El build valida TypeScript y genera `dist/`. La vista previa del build está en http://127.0.0.1:4173. Ninguno de estos comandos publica el sitio.

## Rutas y prueba rápida

| Ruta | Resultado |
| --- | --- |
| `/` | Redirige a `/login` |
| `/login` | Selección temporal de perfil |
| `/admin` | Inicio con layout de administrador |
| `/residente` | Inicio con layout de residente |
| Cualquier ruta desconocida | Página 404 |
| `/admin/no-existe` o `/residente/no-existe` | 404 dentro del layout correspondiente |

Desde el acceso temporal, elige **Administrador** o **Residente**. Usa **Cambiar de perfil** para volver y explorar el otro espacio. En teléfono, abre **Abrir menú** para ver la navegación. Recarga cada ruta para comprobar el acceso directo.

Datos de prueba: únicamente los dos perfiles de demostración; no hay correos, contraseñas ni registros precargados.

## Organización

```text
src/
  components/   Marca, navegación y foco entre rutas
  layouts/      Layout público y layouts de perfiles
  pages/        Acceso temporal, inicio de perfil y 404
  services/     Límite de persistencia para futuros módulos
  data/         Configuración de navegación por perfil
  types/        Tipos compartidos
  hooks/        Título de página
  utils/        Reservada para utilidades compartidas
  styles/       Estilos globales, layouts y páginas
  main.tsx      Montaje de React
  router.tsx    Árbol principal de rutas
```

Cuando se añadan datos, las pantallas consumirán servicios asíncronos tipados. Solo `services/` accederá a localStorage; posteriormente se podrá sustituir esa implementación por una API Django conservando los contratos. La etapa actual no necesita persistencia.

La interfaz usa azul oscuro `#123B5D`, azul principal `#1E5A88` y acentos amarillos `#F2B705` sobre amarillo suave `#FFF4CC` en los indicadores de etapa. Los botones principales siguen siendo azules. Utiliza fuentes del sistema, separadores discretos y navegación por teclado. No requiere fuentes, imágenes ni recursos externos en ejecución.

El alcance final contempla condominios, residencias, residentes, vehículos, contactos frecuentes, invitaciones con QR y enlace público, simulación de entrada/salida, historial y reportes. Estas funciones aún no están implementadas; su checklist se mantiene en el documento de estado. La presentación final incluirá `docs/PRESENTATION_DEMO.md`.

## Documentación

Verificado: instalación, `npm run dev`, `npm run build`, vista previa del build, navegación entre perfiles, páginas 404 y adaptación a escritorio y móvil. Consulta el registro de pruebas para el detalle y sus límites.

- [Estado y fases previstas](docs/PROTOTYPE_STATUS.md)
- [Guía acumulativa de pruebas](docs/PROTOTYPE_TESTING.md)

Para un futuro alojamiento estático, configurar la redirección de rutas hacia `index.html` para soportar React Router. No se ha configurado alojamiento en esta etapa.
