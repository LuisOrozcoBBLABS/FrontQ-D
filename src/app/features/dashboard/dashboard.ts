import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { GroupsService } from '../../core/groups.service';
import { ProjectsService } from '../../core/projects.service';
import { AssignmentsService } from '../../core/assignments.service';
import { ASIG_ESTADOS, PRIORIDADES, Prioridad, Project } from '../../core/models';
import { Knob } from 'primeng/knob';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Sparkline } from '../../ui/sparkline';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, Knob, Tag, ButtonModule, Skeleton, Sparkline],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected auth = inject(AuthService);
  protected users = inject(UsersService);
  protected groups = inject(GroupsService);
  protected projects = inject(ProjectsService);
  private assignSvc = inject(AssignmentsService);

  constructor() {
    void this.projects.load();
    void this.projects.cargarResumen();
    void this.groups.load();
    void this.assignSvc.load();
    if (this.auth.can('users.manage')) void this.users.load();
  }

  /** Cifras reales del servidor. Null mientras cargan o si fallaron. */
  protected resumen = this.projects.resumen;

  // ---------------- Lo tuyo: para que existe esta pantalla ----------------

  /** Abiertas = todo lo que no esta cerrado. Es lo que hay que hacer. */
  protected abiertas = computed(
    () => this.todasMisAsignaciones().filter(a => a.estado !== 'completada').length,
  );

  /** Vencidas: plazo pasado y sin cerrar. Una completada tarde ya no urge. */
  protected vencidas = computed(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return this.todasMisAsignaciones().filter(a => {
      if (a.estado === 'completada' || !a.fechaLimite) return false;
      const limite = Date.parse(a.fechaLimite + 'T00:00:00');
      return !Number.isNaN(limite) && limite < hoy.getTime();
    }).length;
  });

  /** Urgentes abiertas: la otra razon por la que algo pasa primero. */
  protected urgentes = computed(
    () => this.todasMisAsignaciones()
      .filter(a => a.estado !== 'completada' && a.prioridad === 'urgente').length,
  );

  /**
   * La frase de arriba. Dice que hacer, no cuantas cosas hay: es la diferencia
   * entre enterarse de algo y saber por donde empezar.
   */
  protected consigna = computed(() => {
    if (this.vencidas() > 0) {
      const n = this.vencidas();
      return n === 1 ? 'Tenés 1 asignación con el plazo pasado.' : `Tenés ${n} asignaciones con el plazo pasado.`;
    }
    if (this.urgentes() > 0) {
      const n = this.urgentes();
      return n === 1 ? 'Tenés 1 asignación urgente abierta.' : `Tenés ${n} asignaciones urgentes abiertas.`;
    }
    if (this.abiertas() > 0) {
      const n = this.abiertas();
      return n === 1 ? 'Tenés 1 asignación abierta, sin nada vencido.' : `Tenés ${n} asignaciones abiertas, sin nada vencido.`;
    }
    if (this.totalAsignado() > 0) return 'Cerraste todo lo que tenías asignado.';
    return 'Todavía no tenés trabajo asignado.';
  });

  /** El tono acompaña a la consigna. Un cero no se pinta. */
  protected tonoConsigna = computed<'mal' | 'atencion' | 'calma'>(() => {
    if (this.vencidas() > 0) return 'mal';
    if (this.urgentes() > 0) return 'atencion';
    return 'calma';
  });

  // ---------------- Delta de proyectos ----------------

  /** Texto del sparkline: la conclusion, no la lista de numeros. */
  protected tendenciaProyectos = computed(() => {
    const r = this.resumen();
    if (!r) return 'Tendencia';
    return `Proyectos registrados por día en los últimos 14 días. ${r.nuevos7} en los últimos 7.`;
  });

  /** Fecha del dato, no de la carga de la pagina. */
  protected actualizado = computed(() => {
    const at = this.resumen()?.at;
    if (!at) return null;
    return at.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  });


  protected nombre = computed(() => this.auth.currentUser()?.nombre?.split(' ')[0] ?? '');

  protected recientes = computed<Project[]>(() => {
    const all = this.projects.projects();
    const list = this.auth.can('projects.viewAll')
      ? all
      : all.filter(p => p.autorId === this.auth.currentUser()?.id || (!!this.auth.currentUser()?.grupo && p.grupo === this.auth.currentUser()?.grupo));
    return list.slice(0, 4);
  });

  protected misAsignaciones = computed(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.forUser(u.id).slice(0, 3) : [];
  });

  /** Todo el trabajo asignado a la persona, sin recortar a tres. */
  private todasMisAsignaciones = computed(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.forUser(u.id) : [];
  });

  protected totalAsignado = computed(() => this.todasMisAsignaciones().length);
  protected completadas = computed(
    () => this.todasMisAsignaciones().filter(a => a.estado === 'completada').length,
  );

  /** Porcentaje cerrado, para el indicador circular. Sin trabajo asignado es 0. */
  protected avance = computed(() => {
    const total = this.totalAsignado();
    return total === 0 ? 0 : Math.round((this.completadas() / total) * 100);
  });

  /** El color del aro sigue el avance: no es decoración, informa. */
  protected colorAvance = computed(() => {
    const v = this.avance();
    if (v >= 80) return 'var(--accent)';
    if (v >= 40) return 'var(--bb-mint)';
    return 'var(--text-dim)';
  });

  /** La prioridad se pinta con el color que le corresponde en la escala. */
  severidadPrioridad(p: Prioridad): 'danger' | 'warn' | 'info' | 'secondary' {
    switch (p) {
      case 'urgente': return 'danger';
      case 'alta': return 'warn';
      case 'media': return 'info';
      default: return 'secondary';
    }
  }

  projectName(id: string): string { return this.projects.byId(id)?.nombre ?? '—'; }
  prioridadLabel(p: string): string { return PRIORIDADES.find(x => x.value === p)?.label ?? p; }
  estadoLabel(e: string): string { return ASIG_ESTADOS.find(x => x.value === e)?.label ?? e; }
}
