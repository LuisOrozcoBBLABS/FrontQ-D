import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FILAS_POR_PAGINA } from '../ui/paginador/paginador';
import { AppSimilar, CambioEstado, ETAPAS, Project, ProjectStatus } from './models';

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

  /**
   * Orden. Va al servidor y no al cliente a proposito: con paginacion en el
   * servidor, ordenar la pagina cargada solo reordena esas 8 filas y el usuario
   * cree que ordeno todo el conjunto.
   */
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface NuevoProyecto {
  nombre: string;
  sector: string;
  cliente?: string;
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

/** Cifras reales del servidor para la pantalla de inicio. */
export interface ResumenProyectos {
  /** Total que la persona puede ver, no el total absoluto de la base. */
  total: number;
  /** Sin nadie asignado: es trabajo pendiente de reparto, no un dato de color. */
  sinAsignar: number;
  /** Registrados en los ultimos 7 dias. Es el delta con el que se compara. */
  nuevos7: number;
  /** Un valor por dia, 14 dias, el mas viejo primero. Alimenta el sparkline. */
  serie: number[];
  /** Cuando se leyo el dato, no cuando se cargo la pagina. */
  at: Date;
}

/**
 * Cuenta cuantos elementos cayeron en cada uno de los ultimos `dias` dias.
 *
 * Devuelve siempre `dias` posiciones, incluidos los ceros: un sparkline que
 * omite los dias sin actividad comprime el tiempo y muestra una tendencia que
 * no existe.
 */
function serieDiaria(fechas: string[], dias: number): number[] {
  const cubos = new Array<number>(dias).fill(0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (const f of fechas) {
    const t = Date.parse(f);
    if (Number.isNaN(t)) continue;
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    const atras = Math.round((hoy.getTime() - d.getTime()) / 86_400_000);
    const i = dias - 1 - atras;
    if (i >= 0 && i < dias) cubos[i]++;
  }
  return cubos;
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
  if (filtro.sort) { p['sort'] = filtro.sort; p['dir'] = filtro.dir ?? 'asc'; }
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
  /** Cifras del dashboard. Null mientras no llegan o si fallaron. */
  private readonly _resumen = signal<ResumenProyectos | null>(null);
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
  readonly resumen = this._resumen.asReadonly();
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

  /**
   * Datos del dashboard. Va aparte de `load()` a proposito: `load()` es el
   * estado de la tabla y pisarlo desde el inicio haria que volver a /proyectos
   * muestre lo que pidio el dashboard.
   *
   * Son tres consultas livianas y todas devuelven cifras REALES del servidor:
   * ningun numero de esta pantalla se estima en el cliente.
   */
  async cargarResumen(): Promise<void> {
    const hace = (dias: number) => {
      const d = new Date();
      d.setDate(d.getDate() - dias);
      return d.toISOString().slice(0, 10);
    };

    const contar = async (params: Record<string, string | number | boolean>) => {
      // take=1 porque solo interesa la cabecera con el total.
      const r = await firstValueFrom(
        this.http.get<ProjectApi[]>(`${this.base}/projects`, {
          params: { ...params, take: 1 },
          observe: 'response',
        }),
      );
      return Number(r.headers.get('X-Total-Count') ?? 0);
    };

    try {
      const [total, sinAsignar, recientes] = await Promise.all([
        contar({}),
        contar({ sinAsignar: true }),
        // La ventana de 14 dias entera: de aca sale la serie y el delta de 7.
        firstValueFrom(
          this.http.get<ProjectApi[]>(`${this.base}/projects`, {
            params: { desde: hace(13), take: 200 },
          }),
        ),
      ]);

      const porDia = serieDiaria((recientes ?? []).map(p => p.createdAt), 14);
      const nuevos7 = porDia.slice(-7).reduce((a, b) => a + b, 0);

      this._resumen.set({ total, sinAsignar, nuevos7, serie: porDia, at: new Date() });
    } catch {
      this._resumen.set(null);
      this._error.set('No se pudo cargar el resumen.');
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
    cliente: p.cliente ?? null,
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
