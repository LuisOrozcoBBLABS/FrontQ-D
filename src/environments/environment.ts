/**
 * Configuración por entorno. El valor de producción se reemplaza en el build
 * (fileReplacements en angular.json) cuando exista el despliegue.
 */
export const environment = {
  production: false,

  /** Base de la API de BackQ-D. */
  apiUrl: 'http://localhost:3000/api',

  /**
   * Las 7 funciones de IA quedan fuera del MVP: sus resultados son simulados.
   * Se reactivan poniendo esto en true cuando exista el motor en el backend.
   */
  funcionesIA: false,
};
