import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { TokenStore } from './token.store';

/**
 * El interceptor es single-flight: si varias peticiones reciben 401 a la vez,
 * solo una llama a /auth/refresh y las demás esperan el token nuevo. Lo que no
 * estaba cubierto —y por eso el bug vivió— es qué les pasa a las que esperan
 * cuando la renovación FALLA.
 *
 * Importa más de lo que parece: el tablero pide una consulta por columna, así
 * que una sesión vencida produce diez 401 concurrentes. Nueve esperan.
 */
describe('interceptor de autenticación', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokens: TokenStore;
  let fetchOriginal: typeof globalThis.fetch;

  const url = (p: string) => `${environment.apiUrl}${p}`;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        // /login tiene que existir: al fallar la renovación el interceptor
        // navega ahí, y sin la ruta el router deja una promesa rechazada suelta
        // que Vitest reporta como error de la corrida.
        provideRouter([{ path: 'login', children: [] }]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStore);
    tokens.guardar('access-viejo', 'refresh-viejo');
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    localStorage.clear();
  });

  it('si la renovación falla, la petición que esperaba FALLA en vez de quedar colgada', async () => {
    // El servidor rechaza el refresh: es lo que pasa cuando el token ya rotó,
    // por ejemplo porque la persona entró desde otro dispositivo.
    globalThis.fetch = (() =>
      Promise.resolve({ ok: false, status: 401 } as Response)) as typeof globalThis.fetch;

    const primera = firstValueFrom(http.get(url('/projects')));
    const segunda = firstValueFrom(http.get(url('/users')));

    // Las dos reciben 401: la primera dispara la renovación, la segunda espera.
    const pendientes = httpMock.match(r => r.url.startsWith(environment.apiUrl));
    expect(pendientes).toHaveLength(2);
    pendientes.forEach(p => p.flush(null, { status: 401, statusText: 'Unauthorized' }));

    // Ninguna de las dos puede quedarse sin resolver. Antes del arreglo, la
    // segunda no emitía, no completaba y no fallaba: este await no terminaba.
    await expect(primera).rejects.toBeTruthy();
    await expect(segunda).rejects.toBeTruthy();
  });

  it('si la renovación funciona, la petición que esperaba se reintenta con el token nuevo', async () => {
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ accessToken: 'access-nuevo', refreshToken: 'refresh-nuevo' }),
      } as Response)) as typeof globalThis.fetch;

    const primera = firstValueFrom(http.get(url('/projects')));
    const segunda = firstValueFrom(http.get(url('/users')));

    const pendientes = httpMock.match(r => r.url.startsWith(environment.apiUrl));
    expect(pendientes).toHaveLength(2);
    pendientes.forEach(p => p.flush(null, { status: 401, statusText: 'Unauthorized' }));

    // Se deja correr la microcola para que el fetch del refresh resuelva.
    await Promise.resolve();
    await Promise.resolve();

    const reintentos = httpMock.match(r => r.url.startsWith(environment.apiUrl));
    expect(reintentos).toHaveLength(2);
    // Las dos van con el token nuevo: la que renovó y la que esperaba.
    reintentos.forEach(r => {
      expect(r.request.headers.get('Authorization')).toBe('Bearer access-nuevo');
      r.flush({ ok: true });
    });

    await expect(primera).resolves.toBeTruthy();
    await expect(segunda).resolves.toBeTruthy();
  });

  it('/auth/refresh no lleva token ni dispara otra renovación', () => {
    void firstValueFrom(http.post(url('/auth/refresh'), {})).catch(() => undefined);
    const req = httpMock.expectOne(url('/auth/refresh'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    // Si hubiera intentado renovar, habría una petición mas en cola.
    httpMock.verify();
  });

  it('sin refresh token guardado no intenta renovar', async () => {
    tokens.limpiar();
    tokens.guardar('access-suelto', '');

    const peticion = firstValueFrom(http.get(url('/projects')));
    httpMock.expectOne(url('/projects')).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(peticion).rejects.toBeTruthy();
    httpMock.verify();
  });
});
