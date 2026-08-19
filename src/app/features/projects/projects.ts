import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../core/projects.service';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { ESTADOS_PROYECTO, Project, ProjectStatus, SECTORES } from '../../core/models';
import { Empty } from '../../ui/empty';

@Component({
  selector: 'app-projects',
  imports: [RouterLink, FormsModule, Empty],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {
  private projectsSvc = inject(ProjectsService);
  private usersSvc = inject(UsersService);
  protected auth = inject(AuthService);

  protected sectores = SECTORES;
  protected estados = ESTADOS_PROYECTO;

  protected query = signal('');
  protected sectorF = signal<string>('all');
  protected estadoF = signal<string>('all');

  protected visible = computed<Project[]>(() => {
    const all = this.projectsSvc.projects();
    if (this.auth.can('projects.viewAll')) return all;
    const me = this.auth.currentUser();
    if (!me) return [];
    return all.filter(p => p.autorId === me.id || (!!me.grupo && p.grupo === me.grupo));
  });

  protected filtered = computed<Project[]>(() => {
    const q = this.query().trim().toLowerCase();
    return this.visible().filter(p => {
      if (this.sectorF() !== 'all' && p.sector !== this.sectorF()) return false;
      if (this.estadoF() !== 'all' && p.estado !== this.estadoF()) return false;
      if (q && !(p.nombre + ' ' + p.problema + ' ' + p.sector).toLowerCase().includes(q)) return false;
      return true;
    });
  });

  estadoLabel(e: ProjectStatus): string { return ESTADOS_PROYECTO.find(x => x.value === e)?.label ?? e; }
  autorNombre(id: string): string { return this.usersSvc.byId(id)?.nombre ?? '—'; }
}
