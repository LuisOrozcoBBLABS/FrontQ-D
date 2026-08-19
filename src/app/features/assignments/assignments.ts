import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AssignmentsService } from '../../core/assignments.service';
import { AuthService } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { UsersService } from '../../core/users.service';
import { ASIG_ESTADOS, Assignment, AssignmentStatus, PRIORIDADES, Prioridad } from '../../core/models';
import { Empty } from '../../ui/empty';

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
  protected auth = inject(AuthService);

  protected cargando = this.assignSvc.cargando;

  constructor() {
    void this.assignSvc.load();
    void this.assignSvc.loadNotificaciones();
    void this.projectsSvc.load();
    void this.usersSvc.load();
  }

  protected estados = ASIG_ESTADOS;

  protected mias = computed<Assignment[]>(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.forUser(u.id) : [];
  });
  protected todas = computed<Assignment[]>(() => [...this.assignSvc.assignments()]);
  protected notifs = computed(() => [...this.assignSvc.notifications()]);

  canManage(): boolean { return this.auth.can('assignments.create'); }
  projectName(id: string): string { return this.projectsSvc.byId(id)?.nombre ?? '—'; }
  userName(id: string): string { return this.usersSvc.byId(id)?.nombre ?? '—'; }
  estadoLabel(e: AssignmentStatus): string { return ASIG_ESTADOS.find(x => x.value === e)?.label ?? e; }
  prioridadLabel(p: Prioridad): string { return PRIORIDADES.find(x => x.value === p)?.label ?? p; }
  setEstado(a: Assignment, e: AssignmentStatus): void { this.assignSvc.updateEstado(a.id, e); }
}
