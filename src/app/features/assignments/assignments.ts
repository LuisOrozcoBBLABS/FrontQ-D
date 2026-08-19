import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AssignmentsService } from '../../core/assignments.service';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { UsersService } from '../../core/users.service';
import { ToastService } from '../../core/toast.service';
import { ASIG_ESTADOS, Assignment, AssignmentStatus, PRIORIDADES, Prioridad } from '../../core/models';
import { Empty } from '../../ui/empty';

/** Mismo orden que la máquina de estados del backend. */
const SECUENCIA: AssignmentStatus[] = ['pendiente', 'aceptada', 'en-curso', 'completada'];

/** Único avance válido desde cada estado, con el verbo de la acción. */
const SIGUIENTE: Partial<Record<AssignmentStatus, { estado: AssignmentStatus; verbo: string }>> = {
  pendiente: { estado: 'aceptada', verbo: 'Aceptar' },
  aceptada: { estado: 'en-curso', verbo: 'Empezar' },
  'en-curso': { estado: 'completada', verbo: 'Completar' },
};

interface Columna {
  estado: AssignmentStatus;
  titulo: string;
  items: Assignment[];
}

@Component({
  selector: 'app-assignments',
  imports: [RouterLink, FormsModule, Empty],
  templateUrl: './assignments.html',
  styleUrl: './assignments.scss',
})
export class Assignments {
  private assignSvc = inject(AssignmentsService);
  private projectsSvc = inject(ProjectsService);
  private usersSvc = inject(UsersService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected cargando = this.assignSvc.cargando;
  protected moviendo = signal<string | null>(null);

  constructor() {
    void this.assignSvc.load();
    void this.assignSvc.loadNotificaciones();
    void this.projectsSvc.load();
    void this.usersSvc.load();
    // La tabla del area es otra consulta, y solo con permiso.
    if (this.canManage()) void this.assignSvc.loadTodas();
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
   * Tablero por estado. La urgencia sigue mandando: dentro de cada columna van
   * primero las vencidas y despues por prioridad.
   */
  protected columnas = computed<Columna[]>(() => {
    const orden = (x: Assignment[]) =>
      [...x].sort((a, b) => {
        const venceA = this.vencida(a) ? 0 : 1;
        const venceB = this.vencida(b) ? 0 : 1;
        if (venceA !== venceB) return venceA - venceB;
        const peso: Record<Prioridad, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
        return peso[a.prioridad] - peso[b.prioridad];
      });

    return SECUENCIA.map(estado => ({
      estado,
      titulo: this.estadoLabel(estado),
      items: orden(this.mias().filter(a => a.estado === estado)),
    }));
  });

  protected hayVencidas = computed(() => this.mias().some(a => this.vencida(a)));

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
}
