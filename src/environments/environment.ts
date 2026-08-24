/**
 * Configuración de desarrollo.
 *
 * `apiUrl` es relativa a propósito: el dev server reenvía todo lo que empieza
 * por /api al backend según proxy.conf.json. Con eso las peticiones salen del
 * mismo origen que la página y el navegador no aplica CORS, así que se puede
 * trabajar en local contra la API desplegada sin que su lista de orígenes
 * permitidos tenga que incluir localhost.
 *
 * Para trabajar contra un BackQ-D local, se cambia el `target` de
 * proxy.conf.json a http://localhost:3000 y no hace falta tocar este archivo.
 *
 * Nada de esto llega a producción: el proxy solo existe en `ng serve`, y el
 * build de producción usa environment.prod.ts con la URL absoluta.
 */
export const environment = {
  production: false,

  /** El dev server la reenvía; en producción se reemplaza por la URL absoluta. */
  apiUrl: '/api',
};
