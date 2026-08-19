import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { GroupsService } from '../../core/groups.service';
import { ProjectsService } from '../../core/projects.service';
import { AssignmentsService } from '../../core/assignments.service';
import { environment } from '../../../environments/environment';
import { ASIG_ESTADOS, PRIORIDADES, Project } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected auth = inject(AuthService);
  protected users = inject(UsersService);
  protected groups = inject(GroupsService);
  protected projects = inject(ProjectsService);
  private assignSvc = inject(AssignmentsService);

  /** Las funciones de IA estan fuera del MVP. */
  protected readonly ia = environment.funcionesIA;

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

  projectName(id: string): string { return this.projects.byId(id)?.nombre ?? '—'; }
  prioridadLabel(p: string): string { return PRIORIDADES.find(x => x.value === p)?.label ?? p; }
  estadoLabel(e: string): string { return ASIG_ESTADOS.find(x => x.value === e)?.label ?? e; }
}
