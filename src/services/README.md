# Servicios

Los componentes consumen contratos asíncronos de servicios. El acceso a localStorage está encapsulado en esta carpeta.

- `authService`: `getSession()`, `login(credentials)`, `logout()` y `subscribe(listener)`.
- `demoService`: credenciales para la ayuda del login, contexto del perfil y `resetDemoData()`.
- `demoStorage`: lectura/escritura de `accesshome.demo.v1` y notificaciones entre componentes y pestañas.
- `demoValidation`: valida estructura, roles y referencias antes de utilizar datos persistidos.

La semilla original se define en `data/demo.ts` y cada restauración obtiene una copia independiente. La escritura de la base y la sesión se realiza con un único `setItem`; un fallo no se anuncia como operación exitosa. Restaurar reemplaza esa clave completa y cierra la sesión, sin usar `localStorage.clear()`.

El identificador de sesión se resuelve contra los usuarios almacenados. No hay autenticación real: las contraseñas demo son visibles en la semilla y en los datos locales. Los objetos de sesión que reciben las pantallas excluyen contraseñas.

La futura integración con una API Django sustituirá la implementación de autenticación y datos conservando los contratos usados por las pantallas; las utilidades de restauración son exclusivas del prototipo.
