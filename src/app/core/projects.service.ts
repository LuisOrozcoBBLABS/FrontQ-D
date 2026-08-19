import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppSimilar, Enrichment, Project, ProjectStatus } from './models';

export interface NuevoProyecto {
  nombre: string;
  sector: string;
  problema?: string;
  dolores?: string;
  solucion?: string;
  plusIA?: string;
  similares?: AppSimilar[];
  groupId?: string | null;
  estado?: ProjectStatus;
}

/** Lo que devuelve la API: trae autor y grupo resueltos. */
interface ProjectApi extends Omit<Project, 'grupo' | 'autorId'> {
  groupId: string | null;
  group: { id: string; nombre: string } | null;
  autorId: string;
  autor: { id: string; nombre: string; email: string; avatarUrl: string | null };
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private readonly _projects = signal<Project[]>([]);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly projects = this._projects.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly count = computed(() => this._projects().length);

  async load(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);
    try {
      const lista = await firstValueFrom(
        this.http.get<ProjectApi[]>(`${this.base}/projects`, { params: { take: 200 } }),
      );
      this._projects.set(lista.map(aProyecto));
    } catch {
      this._error.set('No se pudieron cargar los proyectos.');
    } finally {
      this._cargando.set(false);
    }
  }

  byId(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  /** Trae uno del servidor (para entrar directo por URL sin pasar por la lista). */
  async fetchOne(id: string): Promise<Project | null> {
    try {
      const p = await firstValueFrom(this.http.get<ProjectApi>(`${this.base}/projects/${id}`));
      const proyecto = aProyecto(p);
      this._projects.update(l => (l.some(x => x.id === id) ? l.map(x => (x.id === id ? proyecto : x)) : [proyecto, ...l]));
      return proyecto;
    } catch {
      return null;
    }
  }

  async create(data: NuevoProyecto): Promise<Project> {
    const creado = aProyecto(
      await firstValueFrom(this.http.post<ProjectApi>(`${this.base}/projects`, data)),
    );
    this._projects.update(l => [creado, ...l]);
    return creado;
  }

  async update(id: string, patch: Partial<NuevoProyecto>): Promise<Project> {
    const actualizado = aProyecto(
      await firstValueFrom(this.http.patch<ProjectApi>(`${this.base}/projects/${id}`, patch)),
    );
    this._projects.update(l => l.map(p => (p.id === id ? actualizado : p)));
    return actualizado;
  }

  /** Guarda resultados del motor de IA (hoy sin uso: la IA está fuera del MVP). */
  async saveAi(id: string, datos: { enriquecido?: boolean; score?: number; enrichment?: Enrichment }): Promise<void> {
    const actualizado = aProyecto(
      await firstValueFrom(this.http.patch<ProjectApi>(`${this.base}/projects/${id}/ai`, datos)),
    );
    this._projects.update(l => l.map(p => (p.id === id ? actualizado : p)));
  }

  /** "Eliminar" en la interfaz = archivar: sale de las listas, no se pierde. */
  async archivar(id: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/projects/${id}/archive`, {}));
    this._projects.update(l => l.filter(p => p.id !== id));
  }
}

function aProyecto(p: ProjectApi): Project {
  return {
    id: p.id,
    nombre: p.nombre,
    sector: p.sector,
    problema: p.problema,
    dolores: p.dolores,
    solucion: p.solucion,
    plusIA: p.plusIA,
    similares: p.similares ?? [],
    grupo: p.group?.nombre ?? null,
    groupId: p.groupId,
    autorId: p.autorId,
    autorNombre: p.autor?.nombre ?? null,
    estado: p.estado,
    createdAt: p.createdAt,
    enriquecido: p.enriquecido,
    score: p.score ?? undefined,
    enrichment: p.enrichment,
  };
}
