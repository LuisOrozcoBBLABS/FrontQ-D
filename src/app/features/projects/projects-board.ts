import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { ProjectsService } from '../../core/projects.service';
import { AssignmentsService } from '../../core/assignments.service';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import {
  ASIG_ESTADOS,
  ETAPAS,
  EtapaProyecto,
  etapaVecina,
  PRIORIDADES,
  Project,
  ProjectStatus,
  SECTORES,
} from '../../core/models';
import { alertaEtapa } from '../../core/tiempos';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { ProjectCard } from './project-card';
import { ProjectPanel } from './project-panel';

/** Fases del flujo, para la banda que agrupa las columnas. */
const FASES = [
  { id: 'embudo', titulo: 'Embudo de innovación' },
  { id: 'desarrollo', titulo: 'Ciclo de desarrollo' },
  { id: 'cierre', titulo: 'Cierre' },
  { id: 'fuera', titulo: 'Fuera del flujo' },
] as const;

/**
 * Tablero de lo que la persona tiene a cargo. Es la vista de quien EJECUTA: el
 * alcance es `asignadoAMi`, no "todo lo que puedo ver". Quien asigna (jefatura,
 * administración) no la usa, porque a esas cuentas no se les asignan proyectos;
 * el componente `Projects` decide cuál de las dos vistas mostrar.
 *
 * Cada columna trae su tanda de 10 y pide más por su cuenta: un tablero que
 * trae todo deja de servir en cuanto hay volumen.
 */
@Component({
  selector: 'app-projects-board',
  imports: [
    RouterLink,
    FormsModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    ButtonModule,
    Select,
    DatePicker,
    IconField,
    InputIcon,
    InputText,
    ProjectCard,
    ProjectPanel,
  ],
  templateUrl: './projects-board.html',
  styleUrl: './projects-board.scss',
})
export class ProjectsBoard {
  private projectsSvc = inject(ProjectsService);
  private assignSvc = inject(AssignmentsService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected etapas = ETAPAS;
  protected fases = FASES;
  protected sectores = SECTORES;
  protected prioridades = PRIORIDADES;
  protected estadosAsignacion = ASIG_ESTADOS;

  protected tablero = this.projectsSvc.tablero;
  protected cargando = this.projectsSvc.cargandoTablero;
  protected errorCarga = this.projectsSvc.error;
  protected conteo = this.projectsSvc.porEstado;

  // ---------------- Filtros ----------------
  protected query = signal('');
  private queryDebounce = signal('');
  private temporizador?: ReturnType<typeof setTimeout>;

  protected sectorF = signal('all');
  protected prioridadF = signal('all');
  protected estadoAsigF = signal('all');
  protected asignadoPorF = signal('all');
  protected desdeF = signal('');
  protected hastaF = signal('');
  protected vencidosF = signal(false);
  /** Este es el único que se resuelve en el cliente: sale de los tiempos. */
  protected demoradosF = signal(false);

  /** Panel de filtros avanzados desplegado. */
  protected filtrosAbiertos = signal(false);

  // ---- PrimeNG trabaja con listas de opciones, no con <option> ----
  protected readonly opcionesSector = [
    { label: 'Todos', value: 'all' },
    ...SECTORES.map(x => ({ label: x, value: x })),
  ];
  protected readonly opcionesPrioridad = [
    { label: 'Cualquiera', value: 'all' },
    ...PRIORIDADES.map(x => ({ label: x.label, value: x.value as string })),
  ];
  protected readonly opcionesEstadoAsig = [
    { label: 'Cualquiera', value: 'all' },
    ...ASIG_ESTADOS.map(x => ({ label: x.label, value: x.value as string })),
  ];
  protected opcionesJefe = computed(() => [
    { label: 'Cualquiera', value: 'all' },
    ...this.jefes().map(j => ({ label: j.nombre, value: j.id })),
  ]);

  /** El filtro guarda ISO (aaaa-mm-dd); el calendario trabaja con Date. */
  private aDato(iso: string): Date | null {
    return iso ? new Date(iso + 'T00:00:00') : null;
  }
  private aIso(d: Date | null): string {
    return d ? d.toISOString().slice(0, 10) : '';
  }
  protected desdeComoDato = computed(() => this.aDato(this.desdeF()));
  protected hastaComoDato = computed(() => this.aDato(this.hastaF()));
  protected fijarDesde(d: Date | null): void { this.desdeF.set(this.aIso(d)); }
  protected fijarHasta(d: Date | null): void { this.hastaF.set(this.aIso(d)); }

  protected abierta = signal<Project | null>(null);
  protected moviendo = signal<string | null>(null);

  constructor() {
    // Las asignaciones propias alimentan el selector de "quién me asignó" y la
    // prioridad que se muestra en la tarjeta.
    void this.assignSvc.load();

    effect(() => {
      const filtro = this.filtro();
      void this.projectsSvc.cargarTablero(filtro);
      void this.projectsSvc.loadPorEstado(filtro);
    });
  }

  /** El filtro completo, tal como viaja al servidor. */
  protected filtro = computed(() => ({
    asignadoAMi: true,
    q: this.queryDebounce(),
    sector: this.sectorF(),
    prioridad: this.prioridadF(),
    estadoAsignacion: this.estadoAsigF(),
    asignadoPor: this.asignadoPorF(),
    desde: this.desdeF(),
    hasta: this.hastaF(),
    vencidos: this.vencidosF(),
  }));

  /** Quiénes me asignaron cosas: sale de mis asignaciones, no de /users
   *  (un colaborador no puede listar usuarios). */
  protected jefes = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return [];
    const vistos = new Map<string, string>();
    for (const a of this.assignSvc.forUser(u.id)) {
      if (a.asignadoPor && !vistos.has(a.asignadoPor)) {
        vistos.set(a.asignadoPor, a.asignadoPorNombre ?? 'Sin nombre');
      }
    }
    return [...vistos].map(([id, nombre]) => ({ id, nombre }));
  });

  /** Prioridad de mi asignación en ese proyecto, para pintarla en la tarjeta. */
  prioridadDe(p: Project): string | null {
    const u = this.auth.currentUser();
    if (!u) return null;
    const mia = this.assignSvc.forUser(u.id).find(a => a.projectId === p.id);
    return mia?.prioridad ?? null;
  }

  escribir(valor: string): void {
    this.query.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.queryDebounce.set(valor.trim()), 300);
  }

  limpiarTodo(): void {
    this.query.set('');
    this.queryDebounce.set('');
    this.sectorF.set('all');
    this.prioridadF.set('all');
    this.estadoAsigF.set('all');
    this.asignadoPorF.set('all');
    this.desdeF.set('');
    this.hastaF.set('');
    this.vencidosF.set(false);
    this.demoradosF.set(false);
  }

  /** Filtros puestos, para las pastillas que se quitan con un clic. */
  protected activos = computed(() => {
    const lista: { clave: string; etiqueta: string }[] = [];
    if (this.queryDebounce()) lista.push({ clave: 'q', etiqueta: `“${this.queryDebounce()}”` });
    if (this.sectorF() !== 'all') lista.push({ clave: 'sector', etiqueta: this.sectorF() });
    if (this.prioridadF() !== 'all') {
      const p = PRIORIDADES.find(x => x.value === this.prioridadF());
      lista.push({ clave: 'prioridad', etiqueta: `Prioridad ${p?.label ?? ''}` });
    }
    if (this.estadoAsigF() !== 'all') {
      const e = ASIG_ESTADOS.find(x => x.value === this.estadoAsigF());
      lista.push({ clave: 'estadoAsignacion', etiqueta: `Asignación ${e?.label ?? ''}` });
    }
    if (this.asignadoPorF() !== 'all') {
      const j = this.jefes().find(x => x.id === this.asignadoPorF());
      lista.push({ clave: 'asignadoPor', etiqueta: `Asignó ${j?.nombre ?? ''}` });
    }
    if (this.desdeF()) lista.push({ clave: 'desde', etiqueta: `Desde ${this.desdeF()}` });
    if (this.hastaF()) lista.push({ clave: 'hasta', etiqueta: `Hasta ${this.hastaF()}` });
    if (this.vencidosF()) lista.push({ clave: 'vencidos', etiqueta: 'Con plazo vencido' });
    if (this.demoradosF()) lista.push({ clave: 'demorados', etiqueta: 'Demorados en su etapa' });
    return lista;
  });

  quitar(clave: string): void {
    switch (clave) {
      case 'q': this.query.set(''); this.queryDebounce.set(''); break;
      case 'sector': this.sectorF.set('all'); break;
      case 'prioridad': this.prioridadF.set('all'); break;
      case 'estadoAsignacion': this.estadoAsigF.set('all'); break;
      case 'asignadoPor': this.asignadoPorF.set('all'); break;
      case 'desde': this.desdeF.set(''); break;
      case 'hasta': this.hastaF.set(''); break;
      case 'vencidos': this.vencidosF.set(false); break;
      case 'demorados': this.demoradosF.set(false); break;
    }
  }

  // ---------------- Columnas ----------------

  /**
   * Tarjetas de una columna. El único filtro que se aplica acá es "demorados",
   * porque depende de los tiempos calculados en el cliente; todo lo demás ya
   * vino filtrado del servidor.
   */
  columna(estado: ProjectStatus): Project[] {
    const filas = this.tablero()[estado] ?? [];
    return this.demoradosF() ? filas.filter(p => alertaEtapa(p) === 'demorado') : filas;
  }

  /** Total del servidor. Con "demorados" puesto ya no aplica: se cuenta lo visible. */
  total(estado: ProjectStatus): number {
    return this.demoradosF() ? this.columna(estado).length : this.conteo()[estado] ?? 0;
  }

  faltan(estado: ProjectStatus): number {
    if (this.demoradosF()) return 0;
    return Math.max(0, this.total(estado) - (this.tablero()[estado] ?? []).length);
  }

  cargandoColumna(estado: ProjectStatus): boolean {
    return this.projectsSvc.cargandoColumna().includes(estado);
  }

  async cargarMas(estado: ProjectStatus): Promise<void> {
    await this.projectsSvc.cargarMas(estado, this.filtro());
  }

  /** Cuántas columnas tiene cada fase, para el ancho de la banda superior. */
  columnasDeFase(fase: string): number {
    return ETAPAS.filter(e => e.fase === fase).length;
  }

  idColumna(e: EtapaProyecto): string {
    return 'col-' + e.value;
  }

  // ---------------- Resumen ----------------
  protected aCargo = computed(() =>
    ETAPAS.reduce((n, e) => n + (this.conteo()[e.value] ?? 0), 0),
  );

  protected enCurso = computed(() =>
    ETAPAS.filter(e => e.fase === 'desarrollo').reduce((n, e) => n + (this.conteo()[e.value] ?? 0), 0),
  );

  protected demorados = computed(() =>
    ETAPAS.reduce(
      (n, e) => n + (this.tablero()[e.value] ?? []).filter(p => alertaEtapa(p) === 'demorado').length,
      0,
    ),
  );

  // ---------------- Arrastre ----------------

  /**
   * Espeja el permiso de `PATCH /projects/:id/estado`: puede moverla quien la
   * tiene a cargo, el autor o un administrador. Se refleja acá para no
   * arrastrar hacia un 403: es más honesto impedir el gesto que dejarlo hacer
   * y después deshacerlo.
   */
  puedeMover(p: Project): boolean {
    const u = this.auth.currentUser();
    if (!u) return false;
    if (p.autorId === u.id || u.rol === 'admin') return true;
    return this.assignSvc.forUser(u.id).some(a => a.projectId === p.id);
  }

  /**
   * Region viva que anuncia el resultado de un movimiento por teclado.
   *
   * El toast no alcanza para esto: se va solo a los 3.2 segundos, que no dan
   * para que un lector de pantalla llegue al mensaje, lo lea y la persona
   * reaccione. Y como el movimiento por teclado no tiene la confirmacion visual
   * del arrastre, sin anuncio no hay ninguna senal de que algo paso.
   */
  protected anuncio = signal('');

  /** Arrastre, teclado y selector del panel terminan acá: una sola definicion. */
  async mover(proyecto: Project, destino: ProjectStatus): Promise<void> {
    this.moviendo.set(proyecto.id);
    try {
      await this.projectsSvc.moverEstado(proyecto.id, destino);
      const i = ETAPAS.findIndex(e => e.value === destino);
      const etapa = ETAPAS[i];
      this.toast.success(`“${proyecto.nombre}” pasó a ${etapa?.columna ?? destino}.`);
      this.anuncio.set(
        `${proyecto.nombre} movido a ${etapa?.columna ?? destino}, columna ${i + 1} de ${ETAPAS.length}.`,
      );
      if (this.abierta()?.id === proyecto.id) {
        this.abierta.set(this.columna(destino).find(p => p.id === proyecto.id) ?? null);
      }
    } catch (e) {
      const msg = mensajeDeError(e, 'No se pudo mover el proyecto. Volvió a su columna.');
      this.toast.error(msg);
      this.anuncio.set(msg);
    } finally {
      this.moviendo.set(null);
    }
  }

  async soltar(evento: CdkDragDrop<ProjectStatus>): Promise<void> {
    const destino = evento.container.data;
    const origen = evento.previousContainer.data;
    const proyecto = evento.item.data as Project;

    // Mismo contenedor: el orden dentro de la columna no se persiste.
    if (origen === destino) return;

    await this.mover(proyecto, destino);
  }

  /**
   * Alternativa por teclado al arrastre. `direccion` es -1 o +1 sobre el orden
   * de ETAPAS, que es el mismo orden en que se pintan las columnas: lo que el
   * ojo ve a la izquierda es lo que la flecha izquierda alcanza.
   */
  async moverPorTeclado(proyecto: Project, direccion: -1 | 1): Promise<void> {
    if (!this.puedeMover(proyecto) || this.moviendo()) return;
    const destino = etapaVecina(proyecto.estado, direccion);
    if (!destino) {
      // Sin destino no se dice nada por toast —seria ruido en cada intento— pero
      // si se anuncia, porque quien no ve el tablero no sabe que llego al borde.
      this.anuncio.set(
        direccion === 1 ? 'Ya está en la última columna.' : 'Ya está en la primera columna.',
      );
      return;
    }
    await this.mover(proyecto, destino);
  }

  abrir(p: Project): void {
    this.abierta.set(p);
  }

  cerrarPanel(): void {
    this.abierta.set(null);
  }

  protected vacio = computed(
    () => !this.cargando() && ETAPAS.every(e => this.columna(e.value).length === 0),
  );

  protected hayFiltro = computed(() => this.activos().length > 0);
}
