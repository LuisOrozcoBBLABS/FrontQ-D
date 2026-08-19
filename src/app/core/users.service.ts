import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Permission, User } from './models';

/** Pedido de restablecimiento hecho desde la pantalla de recuperacion. */
export interface SolicitudReset {
  id: string;
  estado: 'pendiente' | 'atendida' | 'descartada';
  nota: string | null;
  createdAt: string;
  user: { id: string; nombre: string; email: string; activo: boolean; avatarUrl: string | null };
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  cargo?: string;
  /** Contraseña inicial: el servidor obliga a cambiarla en el primer ingreso. */
  password: string;
  rol: User['rol'];
  groupId?: string | null;
  permisosExtra?: string[];
  activo?: boolean;
}

export type CambiosUsuario = Partial<
  Pick<User, 'nombre' | 'cargo' | 'rol' | 'groupId' | 'permisosExtra' | 'activo'>
>;

/**
 * Servicio de usuarios contra la API. Mantiene una señal con la lista para que
 * las vistas sigan leyendo de forma reactiva; las mutaciones van al servidor y
 * refrescan esa señal con lo que el servidor devuelve.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private readonly _users = signal<User[]>([]);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _permisos = signal<Permission[]>([]);
  private readonly _solicitudes = signal<SolicitudReset[]>([]);

  readonly users = this._users.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly permisos = this._permisos.asReadonly();
  readonly solicitudes = this._solicitudes.asReadonly();

  readonly count = computed(() => this._users().length);
  readonly activos = computed(() => this._users().filter(u => u.activo).length);

  async load(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);
    try {
      const lista = await firstValueFrom(
        this.http.get<User[]>(`${this.base}/users`, { params: { estado: 'todos', take: 200 } }),
      );
      this._users.set(lista);
    } catch {
      this._error.set('No se pudieron cargar los usuarios.');
    } finally {
      this._cargando.set(false);
    }
  }

  /** Catálogo de permisos, para armar la pantalla de gestión. */
  async loadPermisos(): Promise<void> {
    if (this._permisos().length) return;
    try {
      const p = await firstValueFrom(
        this.http.get<{ id: string; label: string; desc: string; grupo: string }[]>(
          `${this.base}/permissions`,
        ),
      );
      this._permisos.set(p.map(x => ({ id: x.id, label: x.label, desc: x.desc, group: x.grupo })));
    } catch {
      /* la vista cae al catálogo local si esto falla */
    }
  }

  byId(id: string): User | undefined {
    return this._users().find(u => u.id === id);
  }

  byEmail(email: string): User | undefined {
    return this._users().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  async create(data: NuevoUsuario): Promise<User> {
    const creado = await firstValueFrom(this.http.post<User>(`${this.base}/users`, data));
    this._users.update(l => [...l, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return creado;
  }

  async update(id: string, patch: CambiosUsuario): Promise<User> {
    const actualizado = await firstValueFrom(
      this.http.patch<User>(`${this.base}/users/${id}`, patch),
    );
    this.reemplazar(actualizado);
    return actualizado;
  }

  /** Activar o desactivar. La API no borra personas. */
  async toggleActivo(id: string): Promise<void> {
    const u = this.byId(id);
    if (!u) return;
    const ruta = u.activo ? 'disable' : 'enable';
    const actualizado = await firstValueFrom(
      this.http.patch<User>(`${this.base}/users/${id}/${ruta}`, {}),
    );
    this.reemplazar(actualizado);
  }

  /** "Eliminar" en la interfaz = archivar. Los datos quedan. */
  async archivar(id: string): Promise<void> {
    const actualizado = await firstValueFrom(
      this.http.patch<User>(`${this.base}/users/${id}/disable`, {}),
    );
    this.reemplazar(actualizado);
  }

  /** Quienes pidieron que les restablezcan la contrasena. */
  async loadSolicitudes(): Promise<void> {
    try {
      const lista = await firstValueFrom(
        this.http.get<SolicitudReset[]>(`${this.base}/reset-requests`),
      );
      this._solicitudes.set(lista);
    } catch {
      /* sin permiso o sin conexion: la seccion no se muestra */
    }
  }

  /**
   * Asigna una clave temporal. El servidor marca `debeCambiarPassword`, cierra
   * las sesiones de esa persona y da por atendido su pedido.
   */
  async resetPassword(id: string, nueva: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/users/${id}/reset-password`, { nueva }));
    this._solicitudes.update(l => l.filter(s => s.user.id !== id));
    // Vuelve con debeCambiarPassword en true: la tabla lo refleja.
    await this.load();
  }

  /** Descarta un pedido sin tocar la contrasena. */
  async descartarSolicitud(id: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/reset-requests/${id}/dismiss`, {}));
    this._solicitudes.update(l => l.filter(s => s.id !== id));
  }

  private reemplazar(u: User): void {
    this._users.update(l => l.map(x => (x.id === u.id ? u : x)));
  }
}
