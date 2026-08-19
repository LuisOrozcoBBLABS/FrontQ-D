import { Injectable, computed, inject, signal } from '@angular/core';
import { ROLES, User } from './models';
import { UsersService } from './users.service';

const SESSION_KEY = 'plataforma-id.session';

export interface LoginResult { ok: boolean; error?: string; user?: User; }

/**
 * Autenticación SIMULADA (mock):
 * - No hay contraseñas reales ni tokens. Se valida que el email exista y esté activo.
 * - currentUser es un computed sobre UsersService => los cambios de perfil se reflejan en toda la app.
 * - En producción: NestJS + JWT/refresh, hash de contraseña (argon2/bcrypt), o proveedor externo.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private users = inject(UsersService);
  private currentId = signal<string | null>(this.restore());

  readonly currentUser = computed<User | null>(() => {
    const id = this.currentId();
    return id ? this.users.byId(id) ?? null : null;
  });
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.rol === 'admin');

  /** Permisos efectivos = permisos del rol + permisos extra del usuario. */
  readonly permissions = computed<string[]>(() => {
    const u = this.currentUser();
    if (!u) return [];
    const base = ROLES[u.rol]?.permissions ?? [];
    return Array.from(new Set([...base, ...u.permisosExtra]));
  });

  private restore(): string | null {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  }

  login(email: string, password: string): LoginResult {
    const user = this.users.byEmail(email);
    if (!user) return { ok: false, error: 'No existe una cuenta con ese correo.' };
    if (!user.activo) return { ok: false, error: 'La cuenta está desactivada. Contacta a un administrador.' };
    if (!password.trim()) return { ok: false, error: 'Ingresa tu contraseña.' };
    this.currentId.set(user.id);
    try { localStorage.setItem(SESSION_KEY, user.id); } catch { /* ignore */ }
    return { ok: true, user };
  }

  logout(): void {
    this.currentId.set(null);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  can(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  /** Actualiza el usuario actualmente autenticado (perfil / onboarding). */
  updateCurrent(patch: Partial<User>): void {
    const id = this.currentId();
    if (id) this.users.update(id, patch);
  }
}
