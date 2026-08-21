import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { authInterceptor } from './core/api/auth.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // La View Transitions API cruza la vista vieja con la nueva en el
    // compositor. El estilo del cruce vive en styles.scss (::view-transition-*),
    // y los navegadores sin soporte simplemente navegan como antes.
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
