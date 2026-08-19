import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Group } from './models';

export interface MiembroResumen {
  id: string;
  nombre: string;
  email: string;
  cargo: string;
  avatarUrl: string | null;
}

interface GroupApi {
  id: string;
  nombre: string;
  lema: string;
  activo: boolean;
  miembros: MiembroResumen[];
  _count?: { proyectos: number };
}

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private readonly _groups = signal<GroupApi[]>([]);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly groups = computed<Group[]>(() =>
    this._groups().map(g => ({ id: g.id, nombre: g.nombre, lema: g.lema })),
  );
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly count = computed(() => this._groups().length);

  async load(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);
    try {
      const lista = await firstValueFrom(
        this.http.get<GroupApi[]>(`${this.base}/groups`, { params: { estado: 'activos' } }),
      );
      this._groups.set(lista);
    } catch {
      this._error.set('No se pudieron cargar los grupos.');
    } finally {
      this._cargando.set(false);
    }
  }

  byId(id: string): Group | undefined {
    return this.groups().find(g => g.id === id);
  }

  /** Integrantes que ya vienen resueltos con el grupo. */
  members(groupId: string): MiembroResumen[] {
    return this._groups().find(g => g.id === groupId)?.miembros ?? [];
  }

  memberCount(groupId: string): number {
    return this.members(groupId).length;
  }

  async create(nombre: string, lema: string): Promise<Group> {
    const creado = await firstValueFrom(
      this.http.post<GroupApi>(`${this.base}/groups`, { nombre, lema }),
    );
    this._groups.update(l => [...l, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return { id: creado.id, nombre: creado.nombre, lema: creado.lema };
  }

  async update(id: string, patch: { nombre?: string; lema?: string }): Promise<void> {
    const actualizado = await firstValueFrom(
      this.http.patch<GroupApi>(`${this.base}/groups/${id}`, patch),
    );
    this._groups.update(l => l.map(g => (g.id === id ? actualizado : g)));
  }

  /** Reemplaza la lista completa de integrantes del grupo. */
  async setMembership(groupId: string, userIds: string[]): Promise<void> {
    const actualizado = await firstValueFrom(
      this.http.put<GroupApi>(`${this.base}/groups/${groupId}/members`, { userIds }),
    );
    this._groups.update(l => l.map(g => (g.id === groupId ? actualizado : g)));
  }

  /** "Eliminar" = archivar. Los integrantes quedan sin grupo, nada se borra. */
  async archivar(id: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/groups/${id}/disable`, {}));
    this._groups.update(l => l.filter(g => g.id !== id));
  }
}
