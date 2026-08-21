/**
 * Configuración de producción. angular.json reemplaza environment.ts por este
 * archivo cuando el build corre con --configuration production.
 *
 * La API vive en Render con plan gratuito: si estuvo inactiva unos minutos, la
 * primera petición despierta la instancia y puede tardar cerca de un minuto.
 * Las siguientes responden normal.
 */
export const environment = {
  production: true,

  /** API de BackQ-D en producción. Swagger: https://backq-d.onrender.com/api/docs */
  apiUrl: 'https://backq-d.onrender.com/api',
};
