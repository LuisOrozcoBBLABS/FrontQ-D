import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FILAS_POR_PAGINA } from '../ui/paginador/paginador';
import { AppSimilar, CambioEstado, ETAPAS, Enrichment, Project, ProjectStatus } from './models';

/** Lo que el servidor necesita para devolver una pagina de proyectos. */
export interface FiltroProyectos {
  q?: string;
  sector?: string;
  estado?: string;
  pagina?: number;

  // ---- Filtros del tablero. Todos se resuelven en el servidor: filtrar en el
  // cliente solo miraria las tarjetas ya cargadas, no el conjunto. ----
  /** Solo lo que tengo a cargo. Es el alcance del tablero. */
  asignadoAMi?: boolean;
  asignadoPor?: string;
  asignadoA?: string;
  prioridad?: string;
  estadoAsignacion?: string;
  /** Fechas de registro, en formato YYYY-MM-DD. */
  desde?: string;
  hasta?: string;
  vencidos?: boolean;
  sinAsignar?: boolean;
  groupId?: string;
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

/** Una entrada de historial tal como la manda la API. */
interface CambioApi {
  estado: ProjectStatus;
  anterior: ProjectStatus | null;
  createdAt: string;
  por?: { id: string; nombre: string } | null;
}

/** Lo que devuelve la API: trae autor, grupo e historial resueltos. */
interface ProjectApi extends Omit<Project, 'grupo' | 'autorId' | 'historial'> {
  groupId: string | null;
  group: { id: string; nombre: string } | null;
  autorId: string;
  autor: { id: string; nombre: string; email: string; avatarUrl: string | null };
  historial?: CambioApi[];
  assignments?: { asignadoA: { id: string; nombre: string } | null; fechaLimite?: string | null }[];
}

/** Cuántas tarjetas trae cada columna por tanda. */
export const POR_COLUMNA = 10;

/**
 * Traduce el filtro a parametros de consulta. Lo usan la lista, cada columna y
 * el conteo por estado: si cada uno armara los suyos, el numero del encabezado
 * dejaria de coincidir con las tarjetas de abajo.
 */
function paramsDe(filtro: FiltroProyectos): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {};
  if (filtro.q) p['q'] = filtro.q;
  if (filtro.sector && filtro.sector !== 'all') p['sector'] = filtro.sector;
  if (filtro.groupId && filtro.groupId !== 'all') p['groupId'] = filtro.groupId;
  if (filtro.asignadoAMi) p['asignadoAMi'] = true;
  if (filtro.asignadoA && filtro.asignadoA !== 'all') p['asignadoA'] = filtro.asignadoA;
  if (filtro.asignadoPor && filtro.asignadoPor !== 'all') p['asignadoPor'] = filtro.asignadoPor;
  if (filtro.prioridad && filtro.prioridad !== 'all') p['prioridad'] = filtro.prioridad;
  if (filtro.estadoAsignacion && filtro.estadoAsignacion !== 'all') {
    // El API usa guion bajo en las asignaciones del lado de Prisma.
    p['estadoAsignacion'] = filtro.estadoAsignacion.replace(/-/g, '_');
  }
  if (filtro.desde) p['desde'] = filtro.desde;
  if (filtro.hasta) p['hasta'] = filtro.hasta;
  if (filtro.vencidos) p['vencidos'] = true;
  if (filtro.sinAsignar) p['sinAsignar'] = true;
  return p;
}

/** Un tablero vacío: todas las etapas presentes, sin tarjetas. */
function tableroVacio(): Record<ProjectStatus, Project[]> {
  const vacio = {} as Record<ProjectStatus, Project[]>;
  for (const e of ETAPAS) vacio[e.value] = [];
  return vacio;
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
  /** Tarjetas cargadas por columna. Cada columna pagina por su cuenta. */
  private readonly _tablero = signal<Record<ProjectStatus, Project[]>>(tableroVacio());
  private readonly _cargandoTablero = signal(false);
  /** Columnas que están trayendo su siguiente tanda. */
  private readonly _cargandoColumna = signal<ProjectStatus[]>([]);

  readonly projects = this._projects.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly total = this._total.asReadonly();
  readonly porEstado = this._porEstado.asReadonly();
  readonly count = computed(() => this._total());
  readonly tablero = this._tablero.asReadonly();
  readonly cargandoTablero = this._cargandoTablero.asReadonly();
  readonly cargandoColumna = this._cargandoColumna.asReadonly();

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
    Object.assign(params, paramsDe(filtro));
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
    const params = paramsDe(filtro);
    try {
      const conteo = await firstValueFrom(
        this.http.get<Record<string, number>>(`${this.base}/projects/stats`, { params }),
      );
      this._porEstado.set(conteo);
    } catch {
      this._porEstado.set({});
    }
  }

  /**
   * Trae la primera tanda de cada columna. Una consulta por etapa: el tablero
   * no puede pedir "todo" porque con volumen alto traeria miles de filas, y
   * cada columna tiene que poder pedir mas por su cuenta.
   */
  async cargarTablero(filtro: FiltroProyectos = {}): Promise<void> {
    this._cargandoTablero.set(true);
    this._error.set(null);
    try {
      const tandas = await Promise.all(
        ETAPAS.map(async e => [e.value, await this.pedirColumna(e.value, filtro, 0)] as const),
      );
      const tablero = tableroVacio();
      for (const [estado, filas] of tandas) tablero[estado] = filas;
      this._tablero.set(tablero);
    } catch {
      this._error.set('No se pudo cargar el tablero.');
    } finally {
      this._cargandoTablero.set(false);
    }
  }

  /** Siguiente tanda de una sola columna, sin tocar las demas. */
  async cargarMas(estado: ProjectStatus, filtro: FiltroProyectos = {}): Promise<void> {
    if (this._cargandoColumna().includes(estado)) return;
    this._cargandoColumna.update(l => [...l, estado]);
    try {
      const ya = this._tablero()[estado] ?? [];
      const nuevas = await this.pedirColumna(estado, filtro, ya.length);
      // Filtra por id: si algo se movio entre tandas, no se duplica la tarjeta.
      const vistos = new Set(ya.map(p => p.id));
      this._tablero.update(t => ({ ...t, [estado]: [...ya, ...nuevas.filter(p => !vistos.has(p.id))] }));
    } catch {
      this._error.set('No se pudieron traer mas proyectos de esa columna.');
    } finally {
      this._cargandoColumna.update(l => l.filter(e => e !== estado));
    }
  }

  private async pedirColumna(
    estado: ProjectStatus,
    filtro: FiltroProyectos,
    skip: number,
  ): Promise<Project[]> {
    const params = { ...paramsDe(filtro), estado, take: POR_COLUMNA, skip };
    const filas = await firstValueFrom(this.http.get<ProjectApi[]>(`${this.base}/projects`, { params }));
    return (filas ?? []).map(aProyecto);
  }

  /**
   * Mueve una tarjeta de columna. Actualiza primero en pantalla y guarda
   * despues: si el servidor rechaza, se restaura el tablero tal como estaba.
   * Se devuelve el motivo para poder mostrarlo, en lugar de un fallo mudo.
   */
  async moverEstado(id: string, destino: ProjectStatus): Promise<void> {
    const antes = this._tablero();
    const origen = (Object.keys(antes) as ProjectStatus[]).find(e => antes[e].some(p => p.id === id));
    if (!origen || origen === destino) return;

    const tarjeta = antes[origen].find(p => p.id === id)!;
    // Optimista: la tarjeta aparece arriba de la columna destino al instante.
    this._tablero.set({
      ...antes,
      [origen]: antes[origen].filter(p => p.id !== id),
      [destino]: [{ ...tarjeta, estado: destino }, ...antes[destino]],
    });
    this._porEstado.update(c => ({
      ...c,
      [origen]: Math.max(0, (c[origen] ?? 1) - 1),
      [destino]: (c[destino] ?? 0) + 1,
    }));

    try {
      // Endpoint dedicado: mover la etapa tiene permiso propio, mas amplio que
      // editar el proyecto, porque lo hace quien tiene el trabajo a cargo.
      const guardado = aProyecto(
        await firstValueFrom(
          this.http.patch<ProjectApi>(`${this.base}/projects/${id}/estado`, { estado: destino }),
        ),
      );
      // La respuesta trae el historial nuevo: sin esto la tarjeta seguiria
      // diciendo el tiempo de la etapa anterior.
      this._tablero.update(t => ({
        ...t,
        [destino]: t[destino].map(p => (p.id === id ? guardado : p)),
      }));
      this._projects.update(l => l.map(p => (p.id === id ? guardado : p)));
    } catch (e) {
      this._tablero.set(antes);
      this._porEstado.update(c => ({
        ...c,
        [origen]: (c[origen] ?? 0) + 1,
        [destino]: Math.max(0, (c[destino] ?? 1) - 1),
      }));
      throw e;
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

  /**
   * "Eliminar" en la interfaz = archivar: sale de las listas y del tablero,
   * pero no se pierde. La API no tiene DELETE destructivo.
   *
   * Hay que sacarlo de las dos estructuras: la lista de la tabla y el tablero.
   * Si solo se limpiara una, la tarjeta seguiría ahí hasta recargar.
   */
  async archivar(id: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/projects/${id}/archive`, {}));
    this._projects.update(l => l.filter(p => p.id !== id));

    const tablero = this._tablero();
    const estado = (Object.keys(tablero) as ProjectStatus[]).find(e =>
      tablero[e].some(p => p.id === id),
    );
    if (estado) {
      this._tablero.update(t => ({ ...t, [estado]: t[estado].filter(p => p.id !== id) }));
      this._porEstado.update(c => ({ ...c, [estado]: Math.max(0, (c[estado] ?? 1) - 1) }));
    }
    this._total.update(n => Math.max(0, n - 1));
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
    historial: (p.historial ?? []).map(
      (c): CambioEstado => ({
        estado: c.estado,
        anterior: c.anterior,
        createdAt: c.createdAt,
        porNombre: c.por?.nombre ?? null,
      }),
    ),
    responsables: p.assignments
      ? [...new Set(p.assignments.map(a => a.asignadoA?.nombre).filter((n): n is string => !!n))]
      : undefined,
    finEstimado: p.assignments ? plazoMasLejano(p.assignments) : undefined,
    enriquecido: p.enriquecido,
    score: p.score ?? undefined,
    enrichment: p.enrichment,
  };
}

/**
 * El fin estimado del proyecto es el plazo más lejano de sus asignaciones: si
 * quedan tareas con fecha, el proyecto no termina antes de la última.
 */
function plazoMasLejano(asignaciones: { fechaLimite?: string | null }[]): string | null {
  const fechas = asignaciones
    .map(a => a.fechaLimite)
    .filter((f): f is string => !!f && !Number.isNaN(Date.parse(f)));
  if (!fechas.length) return null;
  return fechas.reduce((max, f) => (Date.parse(f) > Date.parse(max) ? f : max));
}
