/**
 * Configuración de producción. angular.json reemplaza environment.ts por este
 * archivo cuando el build corre con --configuration production.
 *
 * La API vive en Render con plan gratuito: si estuvo inactiva unos minutos, la
 * primera petición despierta la instancia y puede tardar cerca de un minuto.
 * Las siguientes responden normal.
 *
 * ⚠️ NO VOLVER A backq-d.onrender.com (sin sufijo).
 * Esa instancia sigue viva y responde, pero quedó bajo una cuenta personal a la
 * que la empresa ya no tiene acceso: no se puede desplegar, ni configurar, ni
 * apagar. Sus datos están congelados en la foto del 1 de septiembre de 2026,
 * que es lo que se migró acá. Apuntar el front allá otra vez haría que la
 * plataforma pareciera funcionar mientras muestra datos viejos y escribe en una
 * base que nadie controla — el peor de los dos mundos, y sin ningún síntoma
 * visible.
 */
export const environment = {
  production: true,

  /** API de BackQ-D en producción. Swagger: https://backq-d-y6sq.onrender.com/api/docs */
  apiUrl: 'https://backq-d-y6sq.onrender.com/api',
};
