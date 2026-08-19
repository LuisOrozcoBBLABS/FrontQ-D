import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FILAS_POR_PAGINA } from '../ui/paginador/paginador';
import { AppSimilar, Enrichment, Project, ProjectStatus } from './models';

/** Lo que el servidor necesita para devolver una pagina de proyectos. */
export interface FiltroProyectos {
  q?: string;
  sector?: string;
  estado?: string;
  pagina?: number;
}

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
  /** Total que cumple los filtros en el servidor, no lo que hay cargado. */
  private readonly _total = signal(0);
  private readonly _porEstado = signal<Record<string, number>>({});

  readonly projects = this._projects.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly total = this._total.asReadonly();
  readonly porEstado = this._porEstado.asReadonly();
  readonly count = computed(() => this._total());

  /**
   * Trae una pagina. El total viene en la cabecera: sin eso no se pueden
   * numerar las paginas.
   */
  async load(filtro: FiltroProyectos = {}): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);

    const pagina = Math.max(1, filtro.pagina ?? 1);
    const params: Record<string, string | number> = {
      take: FILAS_POR_PAGINA,
      skip: (pagina - 1) * FILAS_POR_PAGINA,
    };
    if (filtro.q) params['q'] = filtro.q;
    if (filtro.sector && filtro.sector !== 'all') params['sector'] = filtro.sector;
    if (filtro.estado && filtro.estado !== 'all') params['estado'] = filtro.estado;

    try {
      const res = await firstValueFrom(
        this.http.get<ProjectApi[]>(`${this.base}/projects`, { params, observe: 'response' }),
      );
      this._projects.set((res.body ?? []).map(aProyecto));
      this._total.set(Number(res.headers.get('X-Total-Count') ?? 0));
    } catch {
      this._error.set('No se pudieron cargar los proyectos.');
    } finally {
      this._cargando.set(false);
    }
  }

  /** Conteo por estado para las pastillas: lo calcula el servidor. */
  async loadPorEstado(filtro: FiltroProyectos = {}): Promise<void> {
    const params: Record<string, string> = {};
    if (filtro.q) params['q'] = filtro.q;
    if (filtro.sector && filtro.sector !== 'all') params['sector'] = filtro.sector;
    try {
      const conteo = await firstValueFrom(
        this.http.get<Record<string, number>>(`${this.base}/projects/stats`, { params }),
      );
      this._porEstado.set(conteo);
    } catch {
      this._porEstado.set({});
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
