import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { authInterceptor } from './core/api/auth.interceptor';
import { BlackbirdPreset } from './theme/blackbird-preset';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // La View Transitions API cruza la vista vieja con la nueva en el
    // compositor. El estilo del cruce vive en styles.scss (::view-transition-*),
    // y los navegadores sin soporte simplemente navegan como antes.
    //
    // skipInitialTransition: en el primer arranque la aplicación todavía está
    // resolviendo la sesión y redirige (/ -> /login o /inicio). Animar eso hacía
    // que el navegador abortara la transición con InvalidStateError, y además no
    // aporta nada: no hay una vista anterior con la que cruzar.
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    provideHttpClient(withInterceptors([authInterceptor])),

    // PrimeNG 21 no depende de @angular/animations: sus transiciones son CSS,
    // así que no hace falta el paquete de animaciones ni su provider.
    providePrimeNG({
      theme: {
        preset: BlackbirdPreset,
        options: {
          // El tema lo alterna ThemeService escribiendo data-theme en <html>.
          darkModeSelector: '[data-theme="dark"]',
          // PrimeNG queda dentro de una capa: las reglas propias del proyecto,
          // que no están en ninguna capa, ganan sin necesidad de !important.
          cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
        },
      },
      ripple: true,
    }),
    MessageService,
    ConfirmationService,
  ],
};
