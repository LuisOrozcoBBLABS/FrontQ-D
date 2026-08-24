import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Permission, Role, RoleId, User } from './models';
import { FILAS_POR_PAGINA } from '../ui/paginador/paginador';

/** Pedido de restablecimiento hecho desde la pantalla de recuperacion. */
export interface SolicitudReset {
  id: string;
  estado: 'pendiente' | 'atendida' | 'descartada';
  nota: string | null;
  createdAt: string;
  user: { id: string; nombre: string; email: string; activo: boolean; avatarUrl: string | null };
}

/** Lo que el servidor necesita para devolver una pagina de usuarios. */
export interface FiltroUsuarios {
  q?: string;
  rol?: string;
  estado?: string;
  pagina?: number;
  /** Orden en el servidor: la tabla pagina alla, asi que ordenar acá mentiria. */
  sort?: string;
  dir?: 'asc' | 'desc';
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
  private readonly _roles = signal<Role[]>([]);
  private readonly _solicitudes = signal<SolicitudReset[]>([]);
  /** Total que cumple los filtros en el servidor. */
  private readonly _total = signal(0);
  /** Ultimo filtro usado, para poder recargar la misma pagina tras un cambio. */
  private ultimoFiltro: FiltroUsuarios = {};
  /**
   * Todas las personas activas, sin paginar. Va aparte de `_users` porque esa
   * senal es la pagina de la tabla: el selector de integrantes necesita ver a
   * las 17, no a las 8 de la primera pagina, y pisar `_users` desde un dialogo
   * dejaria la tabla mostrando otra cosa al cerrarlo.
   */
  private readonly _todos = signal<User[]>([]);

  readonly users = this._users.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly permisos = this._permisos.asReadonly();
  readonly roles = this._roles.asReadonly();
  readonly solicitudes = this._solicitudes.asReadonly();
  readonly total = this._total.asReadonly();

  readonly todos = this._todos.asReadonly();
  readonly count = computed(() => this._total());
  readonly activos = computed(() => this._users().filter(u => u.activo).length);

  async load(filtro: FiltroUsuarios = this.ultimoFiltro): Promise<void> {
    this.ultimoFiltro = filtro;
    this._cargando.set(true);
    this._error.set(null);

    const pagina = Math.max(1, filtro.pagina ?? 1);
    const params: Record<string, string | number> = {
      estado: filtro.estado && filtro.estado !== 'all' ? filtro.estado : 'todos',
      take: FILAS_POR_PAGINA,
      skip: (pagina - 1) * FILAS_POR_PAGINA,
    };
    if (filtro.q) params['q'] = filtro.q;
    if (filtro.rol && filtro.rol !== 'all') params['rol'] = filtro.rol;
    if (filtro.sort) { params['sort'] = filtro.sort; params['dir'] = filtro.dir ?? 'asc'; }

    try {
      const res = await firstValueFrom(
        this.http.get<User[]>(`${this.base}/users`, { params, observe: 'response' }),
      );
      this._users.set(res.body ?? []);
      this._total.set(Number(res.headers.get('X-Total-Count') ?? 0));
    } catch {
      this._error.set('No se pudieron cargar los usuarios.');
    } finally {
      this._cargando.set(false);
    }
  }

  /**
   * Trae a todas las personas activas de una sola vez, para pantallas que
   * necesitan el conjunto completo (elegir integrantes, asignar trabajo).
   * Se guarda una vez por sesion salvo que se pida refrescar: la lista de
   * gente del area cambia poco y no vale una consulta por apertura.
   */
  async cargarTodos(refrescar = false): Promise<void> {
    if (!refrescar && this._todos().length) return;
    try {
      const res = await firstValueFrom(
        this.http.get<User[]>(`${this.base}/users`, {
          params: { estado: 'activos', take: 200, sort: 'nombre', dir: 'asc' },
        }),
      );
      this._todos.set(res ?? []);
    } catch {
      this._todos.set([]);
      this._error.set('No se pudo cargar la lista de personas.');
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
      this._error.set('No se pudo cargar el catálogo de permisos.');
    }
  }

  /**
   * Catálogo de roles con sus permisos base. La API los devuelve como filas de
   * la tabla puente, por eso se aplanan a una lista de ids.
   */
  async loadRoles(): Promise<void> {
    if (this._roles().length) return;
    try {
      const r = await firstValueFrom(
        this.http.get<{ id: RoleId; label: string; permissions: { permissionId: string }[] }[]>(
          `${this.base}/roles`,
        ),
      );
      this._roles.set(
        r.map(x => ({ id: x.id, label: x.label, permissions: x.permissions.map(rp => rp.permissionId) })),
      );
    } catch {
      this._error.set('No se pudo cargar el catálogo de roles.');
    }
  }

  byId(id: string): User | undefined {
    return this._users().find(u => u.id === id);
  }

  /** Trae una persona puntual, para cuando no esta en la pagina cargada. */
  async fetchOne(id: string): Promise<User | null> {
    try {
      return await firstValueFrom(this.http.get<User>(`${this.base}/users/${id}`));
    } catch {
      return null;
    }
  }

  byEmail(email: string): User | undefined {
    return this._users().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  async create(data: NuevoUsuario): Promise<User> {
    const creado = await firstValueFrom(this.http.post<User>(`${this.base}/users`, data));
    // La lista es una pagina del servidor: se recarga en lugar de insertar a mano.
    await this.load();
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
