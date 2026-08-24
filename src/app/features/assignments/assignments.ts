import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AssignmentsService } from '../../core/assignments.service';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { UsersService } from '../../core/users.service';
import { ToastService } from '../../core/toast.service';
import { ASIG_ESTADOS, Assignment, AssignmentStatus, PRIORIDADES, Prioridad } from '../../core/models';
import { FILAS_POR_PAGINA, Paginador } from '../../ui/paginador/paginador';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { SECUENCIA, SIGUIENTE, esFinal, puedeIr, retrocesoDe } from '../../core/transiciones';



@Component({
  selector: 'app-assignments',
  imports: [RouterLink, FormsModule, Paginador, TableModule, ButtonModule, SelectButton, Tag, Tooltip],
  templateUrl: './assignments.html',
  styleUrl: './assignments.scss',
})
export class Assignments {
  private assignSvc = inject(AssignmentsService);
  private projectsSvc = inject(ProjectsService);
  private usersSvc = inject(UsersService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  protected cargando = this.assignSvc.cargando;
  protected moviendo = signal<string | null>(null);

  constructor() {
    void this.assignSvc.load();
    void this.assignSvc.loadNotificaciones();
    void this.projectsSvc.load();
    void this.usersSvc.load();
    // La tabla del area es otra consulta, y solo con permiso.
    if (this.canManage()) void this.assignSvc.loadTodas();

    // Si llegamos desde un aviso, resaltamos esa fila y la traemos a la vista.
    const id = this.route.snapshot.queryParamMap.get('a');
    if (id) {
      this.destacada.set(id);
      setTimeout(() => {
        document.getElementById('asg-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 400);
      // El resaltado se apaga solo: sirve para ubicar, no para quedarse.
      setTimeout(() => this.destacada.set(null), 4000);
    }
  }

  protected estados = ASIG_ESTADOS;
  protected secuencia = SECUENCIA;

  protected mias = computed<Assignment[]>(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.forUser(u.id) : [];
  });
  protected todas = computed<Assignment[]>(() => [...this.assignSvc.todas()]);
  protected notifs = computed(() => [...this.assignSvc.notifications()]);

  protected pendientesDeMias = computed(
    () => this.mias().filter(a => a.estado !== 'completada').length,
  );

  /**
   * Lo vencido primero, despues por prioridad, y lo completado al final: la
   * tabla se lee de arriba hacia abajo en orden de urgencia.
   */
  protected misOrdenadas = computed<Assignment[]>(() => {
    const peso: Record<Prioridad, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
    return [...this.mias()].sort((a, b) => {
      const cerradaA = a.estado === 'completada' ? 1 : 0;
      const cerradaB = b.estado === 'completada' ? 1 : 0;
      if (cerradaA !== cerradaB) return cerradaA - cerradaB;

      const venceA = this.vencida(a) ? 0 : 1;
      const venceB = this.vencida(b) ? 0 : 1;
      if (venceA !== venceB) return venceA - venceB;

      return peso[a.prioridad] - peso[b.prioridad];
    });
  });

  protected hayVencidas = computed(() => this.mias().some(a => this.vencida(a)));

  /** Id que llega por ?a=... desde un aviso: la fila se resalta un momento. */
  protected destacada = signal<string | null>(null);

  /** Paginacion en el cliente: la API de asignaciones no pagina, y son listas
   *  cortas por naturaleza (lo propio de una persona, o lo del area). */
  protected readonly porPagina = FILAS_POR_PAGINA;
  protected pagMias = signal(1);
  protected pagTodas = signal(1);

  /**
   * Orden elegido por la persona, por tabla. Se aplica al conjunto COMPLETO y
   * despues se corta la pagina: ordenar la porcion visible reordenaria 8 filas
   * y pareceria haber ordenado todo.
   *
   * Null = vale el orden por defecto, que en "mis asignaciones" no es alfabetico
   * sino por urgencia (lo vencido primero, despues por prioridad, lo cerrado al
   * final). Un buen defecto ahorra mas que cualquier control de orden.
   */
  protected ordenMias = signal<{ campo: string; dir: 'asc' | 'desc' } | null>(null);
  protected ordenTodas = signal<{ campo: string; dir: 'asc' | 'desc' } | null>(null);

  ordenarMias(e: { field?: string; order?: number }): void {
    this.aplicarOrden(this.ordenMias, this.pagMias, e);
  }
  ordenarTodas(e: { field?: string; order?: number }): void {
    this.aplicarOrden(this.ordenTodas, this.pagTodas, e);
  }

  private aplicarOrden(
    destino: WritableSignal<{ campo: string; dir: 'asc' | 'desc' } | null>,
    pagina: WritableSignal<number>,
    e: { field?: string; order?: number },
  ): void {
    if (!e.field) return;
    const dir: 'asc' | 'desc' = e.order === -1 ? 'desc' : 'asc';
    const actual = destino();
    if (actual?.campo === e.field && actual.dir === dir) return;
    pagina.set(1);
    destino.set({ campo: e.field, dir });
  }

  /** Peso de la prioridad: urgente pesa mas que baja, no alfabeticamente. */
  private readonly pesoPrioridad: Record<string, number> = {
    urgente: 0, alta: 1, media: 2, baja: 3,
  };

  /**
   * Valor comparable de una fila para un campo. Devuelve numero o texto segun
   * el campo, porque ordenar prioridades o fechas como texto da un orden que
   * parece correcto y no lo es ("alta" antes que "urgente").
   */
  private valorDe(a: Assignment, campo: string): string | number {
    switch (campo) {
      case 'proyecto': return this.projectName(a).toLowerCase();
      case 'responsable': return this.responsable(a).toLowerCase();
      case 'asignadoPor': return this.asignadoPor(a).toLowerCase();
      case 'prioridad': return this.pesoPrioridad[a.prioridad] ?? 99;
      case 'estado': return SECUENCIA.indexOf(a.estado);
      // Sin plazo va al final: no tener fecha no es tener la fecha mas antigua.
      case 'plazo': return a.fechaLimite ? Date.parse(a.fechaLimite) : Number.MAX_SAFE_INTEGER;
      default: return 0;
    }
  }

  /** Ordena una lista completa segun el orden elegido. */
  private ordenar(lista: Assignment[], orden: { campo: string; dir: 'asc' | 'desc' } | null): Assignment[] {
    if (!orden) return lista;
    const signo = orden.dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = this.valorDe(a, orden.campo);
      const vb = this.valorDe(b, orden.campo);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * signo;
      return String(va).localeCompare(String(vb), 'es') * signo;
    });
  }

  protected miasPagina = computed(() => {
    const completo = this.ordenar(this.misOrdenadas(), this.ordenMias());
    const desde = (this.pagMias() - 1) * this.porPagina;
    return completo.slice(desde, desde + this.porPagina);
  });
  protected todasPagina = computed(() => {
    const completo = this.ordenar(this.todas(), this.ordenTodas());
    const desde = (this.pagTodas() - 1) * this.porPagina;
    return completo.slice(desde, desde + this.porPagina);
  });

  /** Recorta la nota para usarla de subtitulo sin romper la altura de la fila. */
  recorte(texto: string, max = 72): string {
    const limpio = texto.trim();
    return limpio.length > max ? limpio.slice(0, max).trimEnd() + '\u2026' : limpio;
  }

  canManage(): boolean {
    return this.auth.can('assignments.create');
  }

  siguientePaso(a: Assignment): { estado: AssignmentStatus; verbo: string } | null {
    return SIGUIENTE[a.estado] ?? null;
  }

  /** Índice en la secuencia, para pintar el progreso. */
  pasoActual(a: Assignment): number {
    return SECUENCIA.indexOf(a.estado);
  }

  async avanzar(a: Assignment): Promise<void> {
    const paso = this.siguientePaso(a);
    if (!paso || this.moviendo()) return;

    this.moviendo.set(a.id);
    try {
      await this.assignSvc.updateEstado(a.id, paso.estado);
      this.toast.success(`Ahora está ${this.estadoLabel(paso.estado).toLowerCase()}`);
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo cambiar el estado.'));
    } finally {
      this.moviendo.set(null);
    }
  }

  /** null = sin fecha. Negativo = vencida. */
  diasRestantes(fecha: string | null): number | null {
    if (!fecha) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(fecha + 'T00:00:00');
    return Math.round((limite.getTime() - hoy.getTime()) / 86_400_000);
  }

  /** Texto humano del plazo: importa si falta o si ya se pasó. */
  plazo(fecha: string | null): string {
    const d = this.diasRestantes(fecha);
    if (d === null) return 'Sin fecha límite';
    if (d < -1) return `Vencida hace ${Math.abs(d)} días`;
    if (d === -1) return 'Venció ayer';
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    if (d <= 7) return `Vence en ${d} días`;
    return `Vence el ${fecha}`;
  }

  vencida(a: Assignment): boolean {
    const d = this.diasRestantes(a.fechaLimite);
    return d !== null && d < 0 && a.estado !== 'completada';
  }

  /** Prefiere el nombre que ya vino con la asignacion; la lista es el respaldo. */
  projectName(a: Assignment): string {
    return a.projectNombre ?? this.projectsSvc.byId(a.projectId)?.nombre ?? 'Proyecto';
  }
  responsable(a: Assignment): string {
    return a.asignadoANombre ?? this.usersSvc.byId(a.asignadoA)?.nombre ?? '—';
  }
  asignadoPor(a: Assignment): string {
    return a.asignadoPorNombre ?? this.usersSvc.byId(a.asignadoPor)?.nombre ?? '—';
  }
  iniciales(nombre: string): string {
    return nombre.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }
  estadoLabel(e: AssignmentStatus): string {
    return ASIG_ESTADOS.find(x => x.value === e)?.label ?? e;
  }
  prioridadLabel(p: Prioridad): string {
    return PRIORIDADES.find(x => x.value === p)?.label ?? p;
  }

  // ----------------------------------------------------------------- tablero
  /** La vista elegida se recuerda: quien trabaja con el tablero lo quiere de entrada. */
  protected vista = signal<'tabla' | 'tablero'>(leerVista());

  /** Las dos formas de ver el trabajo propio. */
  protected readonly opcionesVista = [
    { label: 'Tabla', value: 'tabla' as const, icono: 'pi pi-list' },
    { label: 'Tablero', value: 'tablero' as const, icono: 'pi pi-th-large' },
  ];

  /** La prioridad se pinta con el color que le corresponde en la escala. */
  severidadPrioridad(p: Prioridad): 'danger' | 'warn' | 'info' | 'secondary' {
    switch (p) {
      case 'urgente': return 'danger';
      case 'alta': return 'warn';
      case 'media': return 'info';
      default: return 'secondary';
    }
  }

  /** Lo cerrado se lee distinto de lo que sigue abierto. */
  severidadEstado(e: AssignmentStatus): 'success' | 'info' | 'warn' | 'secondary' {
    switch (e) {
      case 'completada': return 'success';
      case 'en-curso': return 'info';
      case 'aceptada': return 'warn';
      default: return 'secondary';
    }
  }

  protected cambiarVista(v: 'tabla' | 'tablero'): void {
    this.vista.set(v);
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      /* sin localStorage la preferencia dura lo que la sesión */
    }
  }

  /** Una columna por estado, en el orden de la máquina de estados. */
  protected columnas = computed(() =>
    SECUENCIA.map(estado => ({
      estado,
      label: this.estadoLabel(estado),
      items: this.misOrdenadas().filter(a => a.estado === estado),
    })),
  );

  /** Tarjeta que se está arrastrando; null cuando no hay arrastre en curso. */
  protected arrastrando = signal<Assignment | null>(null);
  protected columnaSobre = signal<AssignmentStatus | null>(null);

  protected puedeSoltar(destino: AssignmentStatus): boolean {
    const a = this.arrastrando();
    return !!a && puedeIr(a.estado, destino);
  }

  protected alIniciarArrastre(a: Assignment, e: DragEvent): void {
    // Completada es final: sus tarjetas no se mueven.
    if (esFinal(a.estado)) {
      e.preventDefault();
      return;
    }
    this.arrastrando.set(a);
    e.dataTransfer?.setData('text/plain', a.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  protected alTerminarArrastre(): void {
    this.arrastrando.set(null);
    this.columnaSobre.set(null);
  }

  protected alPasarSobre(destino: AssignmentStatus, e: DragEvent): void {
    if (!this.puedeSoltar(destino)) return;
    // Sin preventDefault el navegador no considera la zona como destino válido.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.columnaSobre.set(destino);
  }

  protected alSalirDeColumna(destino: AssignmentStatus): void {
    if (this.columnaSobre() === destino) this.columnaSobre.set(null);
  }

  protected async alSoltar(destino: AssignmentStatus, e: DragEvent): Promise<void> {
    e.preventDefault();
    const a = this.arrastrando();
    this.alTerminarArrastre();
    if (!a || a.estado === destino) return;
    await this.mover(a, destino);
  }

  /** Paso hacia atrás válido, si el estado actual admite volver. */
  protected retroceso(a: Assignment): AssignmentStatus | null {
    return retrocesoDe(a.estado);
  }

  /**
   * Mueve una tarjeta. El tablero ya filtró los destinos imposibles, pero el
   * servidor manda: si rechaza, se muestra su mensaje tal cual.
   */
  protected async mover(a: Assignment, estado: AssignmentStatus): Promise<void> {
    if (this.moviendo()) return;
    this.moviendo.set(a.id);
    try {
      await this.assignSvc.updateEstado(a.id, estado);
      this.toast.success(`${this.projectName(a)} · ahora está ${this.estadoLabel(estado).toLowerCase()}`);
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo cambiar el estado.'));
    } finally {
      this.moviendo.set(null);
    }
  }
}

const CLAVE_VISTA = 'plataforma-id.asignaciones-vista';

function leerVista(): 'tabla' | 'tablero' {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'tablero' ? 'tablero' : 'tabla';
  } catch {
    return 'tabla';
  }
}
