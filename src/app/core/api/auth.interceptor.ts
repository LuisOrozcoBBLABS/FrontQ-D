import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, take, throwError } from 'rxjs';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStore } from './token.store';

/** Rutas que no llevan token ni deben disparar renovación. */
const PUBLICAS = ['/auth/login', '/auth/refresh', '/health'];

/**
 * Estado compartido de la renovación. Si varias peticiones reciben 401 a la vez,
 * solo una llama a /auth/refresh y las demás esperan el token nuevo: sin esto,
 * la rotación del backend invalidaría la sesión al recibir refresh repetidos.
 */
let renovando = false;
const tokenNuevo$ = new Subject<string | null>();

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const tokens = inject(TokenStore);
  const router = inject(Router);

  const esNuestra = req.url.startsWith(environment.apiUrl);
  const esPublica = PUBLICAS.some(p => req.url.includes(p));

  if (!esNuestra || esPublica) return next(req);

  const conToken = (token: string | null): HttpRequest<unknown> =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(conToken(tokens.access())).pipe(
    catchError((error: unknown) => {
      const es401 = error instanceof HttpErrorResponse && error.status === 401;
      if (!es401 || !tokens.refreshToken) return throwError(() => error);

      // Ya hay una renovación en curso: esperar su resultado y reintentar.
      //
      // El `null` que emite la rama de fallo SE ATIENDE, no se filtra. Antes
      // había un `filter(t => t !== null)` acá: el null se descartaba, y como
      // `tokenNuevo$` es un Subject que nunca completa ni emite error, estas
      // peticiones no emitían, no completaban y no fallaban NUNCA. Quedaban
      // colgadas para siempre, con su promesa sin resolver y su señal de
      // "cargando" en true. Y no era un caso raro: el tablero pide una consulta
      // por columna, así que una sesión vencida dejaba nueve peticiones colgadas
      // mientras la décima se iba a /login.
      if (renovando) {
        return tokenNuevo$.pipe(
          take(1),
          switchMap(t => (t ? next(conToken(t)) : throwError(() => error))),
        );
      }

      renovando = true;
      return renovar(tokens).pipe(
        switchMap(token => {
          renovando = false;
          tokenNuevo$.next(token);
          return next(conToken(token));
        }),
        catchError((e: unknown) => {
          renovando = false;
          tokenNuevo$.next(null);
          tokens.limpiar();
          void router.navigateByUrl('/login');
          return throwError(() => e);
        }),
      );
    }),
  );
}

/**
 * Llama a /auth/refresh con fetch en lugar de HttpClient a propósito: así la
 * petición no vuelve a pasar por este interceptor y no hay riesgo de recursión.
 */
function renovar(tokens: TokenStore): Observable<string> {
  return new Observable<string>(observador => {
    fetch(`${environment.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
      .then(async res => {
        if (!res.ok) throw new Error('La sesión expiró.');
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        tokens.guardar(data.accessToken, data.refreshToken);
        observador.next(data.accessToken);
        observador.complete();
      })
      .catch((e: unknown) => observador.error(e));
  });
}
