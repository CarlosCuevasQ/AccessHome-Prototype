# Utilidades

`auth.ts` contiene la función pura `getRoleHome`, que mapea cada rol a su inicio. El acceso a persistencia y la validación de credenciales corresponden a services.

`id.ts` expone `generateId()`, compartida por las altas locales y los identificadores de reintento. Detecta funciones disponibles en cada llamada: UUID nativo → UUID v4 con 16 bytes de `getRandomValues` y bits de versión/variante correctos. Si el navegador no ofrece Web Crypto seguro, lanza un error; no usa `Math.random` ni reloj como secreto. Los tokens compartidos se generan en PostgreSQL con 32 bytes de pgcrypto y permanecen separados de los UUID internos. No sustituye IDs existentes ni accede a persistencia.

`clone.ts` expone `cloneJsonData()` para objetos, arrays y valores serializables en JSON. Usa `structuredClone` cuando existe y `JSON.parse(JSON.stringify(...))` cuando falta. Se utiliza en semilla y migraciones; no debe usarse para funciones, referencias circulares, Map, Set ni objetos Date (las fechas persistidas son cadenas ISO).
