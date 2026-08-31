import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenStore } from './api/token.store';
import { User } from './models';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface LoginResponse extends TokenPair {
  debeCambiarPassword: boolean;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  debeCambiarPassword?: boolean;
}

/**
 * Autenticación real contra BackQ-D. Los permisos NO se calculan acá: llegan
 * resueltos en `permisosEfectivos` desde el servidor, que es quien decide.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private tokens = inject(TokenStore);
  private base = environment.apiUrl;

  private readonly _user = signal<User | null>(null);
  /** Ya se intentó resolver la sesión guardada (para que los guards no corran antes). */
  private readonly _resuelto = signal(false);

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.rol === 'admin');
  readonly permissions = computed<string[]>(() => this._user()?.permisosEfectivos ?? []);
  readonly debeCambiarPassword = computed(() => this._user()?.debeCambiarPassword === true);

  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.base}/auth/login`, { email, password }),
      );
      this.tokens.guardar(res.accessToken, res.refreshToken);
      await this.cargarUsuario();
      return { ok: true, debeCambiarPassword: res.debeCambiarPassword };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e, 'No se pudo iniciar sesión.') };
    }
  }

  /**
   * Pide que un administrador restablezca la contraseña. El backend responde
   * igual exista o no la cuenta, para no revelar qué correos están registrados.
   */
  async forgotPassword(email: string, nota?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/auth/forgot-password`, { email, nota: nota || undefined }),
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e, 'No se pudo registrar el pedido.') };
    }
  }

  async logout(): Promise<void> {
    try {
      // Invalida el refresh en el servidor; si falla, igual limpiamos local.
      await firstValueFrom(this.http.post(`${this.base}/auth/logout`, {}));
    } catch {
      /* ignorar */
    }
    this.tokens.limpiar();
    this._user.set(null);
  }

  /** Trae el perfil con los permisos efectivos. */
  async cargarUsuario(): Promise<User | null> {
    if (!this.tokens.hayTokens()) {
      this._user.set(null);
      this._resuelto.set(true);
      return null;
    }
    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.base}/auth/me`));
      this._user.set(user);
      return user;
    } catch {
      this.tokens.limpiar();
      this._user.set(null);
      return null;
    } finally {
      this._resuelto.set(true);
    }
  }

  /** Resuelve la sesión guardada una sola vez, antes de que decidan los guards. */
  async asegurarSesion(): Promise<boolean> {
    if (this._resuelto()) return this.isAuthenticated();
    await this.cargarUsuario();
    return this.isAuthenticated();
  }

  async changePassword(actual: string, nueva: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/auth/change-password`, { actual, nueva }),
      );
      // El backend cierra las sesiones abiertas: hay que entrar de nuevo.
      this.tokens.limpiar();
      this._user.set(null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e, 'No se pudo cambiar la contraseña.') };
    }
  }

  can(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  /**
   * Quién puede modificar o eliminar algo propio: su autor o un administrador.
   *
   * Espeja exactamente la regla del servidor (`soloAutorOAdmin`). Antes cada
   * pantalla lo resolvía a su manera y el detalle usaba `projects.viewAll`,
   * que es un permiso de LECTURA: la jefatura veía el botón de eliminar y la
   * API le devolvía 403. Un solo lugar evita que vuelva a desalinearse.
   */
  esAutorOAdmin(autorId: string | null | undefined): boolean {
    const u = this.currentUser();
    if (!u || !autorId) return false;
    return u.id === autorId || u.rol === 'admin';
  }

  /** Actualiza el perfil propio (lo usan perfil y onboarding). */
  async updateCurrent(patch: Partial<User>): Promise<void> {
    const actualizado = await firstValueFrom(
      this.http.patch<User>(`${this.base}/me/profile`, patch),
    );
    this._user.set(actualizado);
  }
}

/** Saca el mensaje que manda el backend, sin exponer detalles internos. */
export function mensajeDeError(e: unknown, porDefecto: string): string {
  const posible = e as { error?: { message?: string | string[] }; status?: number };
  const m = posible?.error?.message;
  if (Array.isArray(m) && m.length) return m[0];
  if (typeof m === 'string' && m) return m;
  if (posible?.status === 0) return 'No hay conexión con el servidor.';
  return porDefecto;
}
