/**
 * Configuración de producción. angular.json reemplaza environment.ts por este
 * archivo cuando el build corre con --configuration production.
 *
 * `apiUrl` todavía no apunta a ningún servidor real: BackQ-D no está
 * desplegado. Mientras siga así, el sitio publicado muestra la interfaz pero
 * el login falla al enviar. Cuando exista la API, se cambia esta línea y el
 * siguiente push a main republica el sitio.
 */
export const environment = {
  production: true,

  /** Base de la API de BackQ-D en producción. Pendiente de definir. */
  apiUrl: 'https://API-URL-SIN-DEFINIR/api',

  /** Las funciones de IA siguen fuera del MVP. */
  funcionesIA: false,
};
