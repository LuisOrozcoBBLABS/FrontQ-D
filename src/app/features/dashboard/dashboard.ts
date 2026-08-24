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

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, Knob, Tag, ButtonModule],
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
    void this.groups.load();
    void this.assignSvc.load();
    if (this.auth.can('users.manage')) void this.users.load();
  }

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
