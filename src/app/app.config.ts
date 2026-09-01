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

      /**
       * Los desplegables se cuelgan del <body>, no del componente que los abre.
       *
       * Arregla un defecto concreto: `/proyectos` —la tabla y el tablero— fija
       * `height: 100dvh` con `overflow: hidden`, a proposito, para que el
       * scroll viva dentro de la lista y no se lleve el encabezado y los
       * filtros. Pero el panel de un p-select se dibuja DENTRO del componente,
       * asi que ese mismo `overflow: hidden` lo recortaba: al abrir un filtro
       * se veia media lista de opciones y el resto quedaba fuera, sin forma de
       * clickearlo.
       *
       * ⚠️ La opcion es `overlayAppendTo`, arriba de todo, y NO
       * `overlayOptions: { appendTo }`. Las dos existen y se leen igual de
       * bien, pero PrimeNG 21 resuelve esto con
       * `this.appendTo() || this.config.overlayAppendTo()`
       * (primeng-select.mjs), asi que `overlayOptions.appendTo` se acepta sin
       * chistar y NO HACE NADA. El defecto por defecto es `'self'`, que es
       * justamente el que recorta.
       *
       * Va global y no `appendTo="body"` select por select porque el problema
       * no es de esos dos selects: es de cualquier overlay dentro de un
       * contenedor recortado, y la proxima pantalla con scroll propio lo iba a
       * repetir. PrimeNG maneja el z-index de los overlays por su cuenta, asi
       * que salir del contenedor no los mete debajo del riel.
       */
      overlayAppendTo: 'body',
    }),
    MessageService,
    ConfirmationService,
  ],
};
