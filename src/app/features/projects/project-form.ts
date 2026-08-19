import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectsService } from '../../core/projects.service';
import { AuthService } from '../../core/auth.service';
import { GroupsService } from '../../core/groups.service';
import { environment } from '../../../environments/environment';
import { AiService, DupMatch } from '../../core/ai.service';
import { AppSimilar, SECTORES } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-project-form',
  imports: [FormsModule],
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss',
})
export class ProjectForm {
  private projectsSvc = inject(ProjectsService);
  private auth = inject(AuthService);
  private groupsSvc = inject(GroupsService);
  private ai = inject(AiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected sectores = SECTORES;
  protected grupos = this.groupsSvc.groups;
  /** Las funciones de IA estan fuera del MVP. */
  protected readonly ia = environment.funcionesIA;

  nombre = signal('');
  sector = signal<string>('');
  problema = signal('');
  dolores = signal('');
  solucion = signal('');
  plusIA = signal('');
  grupo = signal<string | null>(this.auth.currentUser()?.groupId ?? null);
  similares = signal<AppSimilar[]>([{ name: '', url: '' }]);
  error = signal<string | null>(null);
  dupResults = signal<DupMatch[] | null>(null);

  constructor() {
    void this.groupsSvc.load();

    // Prellenado desde una oportunidad (#5)
    const d = this.ai.draft();
    if (d) {
      if (d.nombre) this.nombre.set(d.nombre);
      if (d.sector) this.sector.set(d.sector);
      if (d.problema) this.problema.set(d.problema);
      this.ai.draft.set(null);
    }
  }

  addSimilar(): void { this.similares.set([...this.similares(), { name: '', url: '' }]); }
  removeSimilar(i: number): void { this.similares.set(this.similares().filter((_, idx) => idx !== i)); }
  patchSimilar(i: number, key: keyof AppSimilar, val: string): void {
    this.similares.set(this.similares().map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  }

  pct(n: number): number { return Math.round(n * 100); }

  /** #2 Detección de duplicados (búsqueda semántica simulada). */
  checkDuplicates(): void {
    const text = [this.nombre(), this.problema(), this.solucion(), this.plusIA()].join(' ');
    this.dupResults.set(this.ai.duplicates(text));
  }

  async save(): Promise<void> {
    this.error.set(null);
    if (!this.nombre().trim() || !this.sector() || !this.problema().trim()) {
      this.error.set('Completa al menos el nombre de la solución, el sector y el problema.');
      return;
    }
    const p = await this.projectsSvc.create({
      nombre: this.nombre().trim(),
      sector: this.sector(),
      problema: this.problema().trim(),
      dolores: this.dolores().trim(),
      solucion: this.solucion().trim(),
      plusIA: this.plusIA().trim(),
      similares: this.similares().filter(s => s.name.trim() || s.url.trim()),
      groupId: this.grupo(),
      estado: 'idea',
    });
    this.toast.success('Proyecto creado');
    await this.router.navigate(['/proyectos', p.id]);
  }

  cancel(): void { this.router.navigateByUrl('/proyectos'); }
}
