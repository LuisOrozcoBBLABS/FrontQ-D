import { Injectable, computed, signal } from '@angular/core';

const ACCESS_KEY = 'plataforma-id.access';
const REFRESH_KEY = 'plataforma-id.refresh';

/**
 * Guarda el par de tokens. Van a localStorage para que la sesión sobreviva a un
 * refresco de página; es la misma decisión que ya tomaba la versión anterior con
 * la sesión, y para una herramienta interna es un intercambio aceptable. Si más
 * adelante se quiere endurecer, el refresh debería pasar a cookie httpOnly y eso
 * se cambia solo acá.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly _access = signal<string | null>(leer(ACCESS_KEY));
  private readonly _refresh = signal<string | null>(leer(REFRESH_KEY));

  readonly access = this._access.asReadonly();
  readonly hayTokens = computed(() => this._access() !== null);

  get refreshToken(): string | null {
    return this._refresh();
  }

  guardar(accessToken: string, refreshToken: string): void {
    this._access.set(accessToken);
    this._refresh.set(refreshToken);
    escribir(ACCESS_KEY, accessToken);
    escribir(REFRESH_KEY, refreshToken);
  }

  limpiar(): void {
    this._access.set(null);
    this._refresh.set(null);
    borrar(ACCESS_KEY);
    borrar(REFRESH_KEY);
  }
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* modo privado o cuota llena: la sesión vive solo en memoria */
  }
}

function borrar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* ignorar */
  }
}
