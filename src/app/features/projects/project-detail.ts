import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../core/projects.service';
import { UsersService } from '../../core/users.service';
import { AuthService } from '../../core/auth.service';
import { AssignmentsService } from '../../core/assignments.service';
import { AiService, PLANTILLAS } from '../../core/ai.service';
import { CANALES, Canal, CanalEnvio, ESTADOS_PROYECTO, PRIORIDADES, Prioridad, Project, ProjectStatus, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { mensajeDeError } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, FormsModule, TrapFocus],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail {
  private route = inject(ActivatedRoute);
  private projectsSvc = inject(ProjectsService);
  private usersSvc = inject(UsersService);
  private assignSvc = inject(AssignmentsService);
  private ai = inject(AiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  constructor() {
    // Entrar por URL directa tiene que funcionar sin pasar por la lista.
    void this.projectsSvc.fetchOne(this.route.snapshot.paramMap.get('id') ?? '');
    // La lista de personas solo hace falta para asignar, y requiere permiso.
    if (this.auth.can('assignments.create') || this.auth.can('users.manage')) {
      void this.usersSvc.load();
    }
  }
  protected auth = inject(AuthService);

  protected estados = ESTADOS_PROYECTO;
  protected prioridades = PRIORIDADES;
  protected canales = CANALES;
  protected plantillas = PLANTILLAS;

  // ---- IA ----
  protected aiView = signal<'none' | 'enrich' | 'score' | 'committee' | 'docs'>('none');
  protected docPlantilla = signal<string>(PLANTILLAS[0]);
  protected enrichResult = computed(() => { const p = this.project(); return p ? this.ai.enrich(p) : null; });
  protected scoreResult = computed(() => { const p = this.project(); return p ? this.ai.score(p) : null; });
  protected committeeResult = computed(() => { const p = this.project(); return p ? this.ai.committee(p) : null; });
  protected docResult = computed(() => { const p = this.project(); return p ? this.ai.generateDoc(p, this.docPlantilla()) : null; });

  private id = this.route.snapshot.paramMap.get('id') ?? '';
  protected project = computed<Project | null>(() => this.projectsSvc.byId(this.id) ?? null);
  protected tab = signal<'resumen' | 'ia' | 'gestion'>('resumen');

  // ---- Asignar ----
  protected assignOpen = signal(false);
  protected assignee = signal<string>('');
  protected prioridad = signal<Prioridad>('media');
  protected nota = signal('');
  protected fechaLimite = signal<string>('');
  protected canalesSel = signal<Canal[]>(['correo']);
  protected result = signal<CanalEnvio[] | null>(null);

  /** La API ya trae el autor resuelto; la lista de usuarios es el respaldo. */
  autor(): string {
    const p = this.project();
    return p?.autorNombre ?? this.usersSvc.byId(p?.autorId ?? '')?.nombre ?? '—';
  }
  estadoLabel(e: ProjectStatus): string { return ESTADOS_PROYECTO.find(x => x.value === e)?.label ?? e; }
  assignableUsers(): User[] { return this.usersSvc.users().filter(u => u.activo); }
  userName(id: string): string { return this.usersSvc.byId(id)?.nombre ?? '—'; }

  /**
   * Espeja `soloAutorOAdmin` del servidor. Antes usaba `projects.viewAll`, que
   * es un permiso de LECTURA: la jefatura veía los botones de editar y eliminar
   * y la API le devolvía 403.
   */
  canManage(): boolean {
    return this.auth.esAutorOAdmin(this.project()?.autorId);
  }
  canAssign(): boolean { return this.auth.can('assignments.create'); }

  async setEstado(e: ProjectStatus): Promise<void> {
    if (!this.project()) return;
    await this.projectsSvc.update(this.id, { estado: e });
    this.toast.success('Estado actualizado');
  }
  async editar(): Promise<void> {
    await this.router.navigate(['/proyectos', this.id, 'editar']);
  }

  async remove(): Promise<void> {
    const p = this.project();
    if (!p) return;
    const ok = await this.confirm.ask({
      title: 'Eliminar proyecto',
      message: `¿Eliminar “${p.nombre}”? Desaparece de las listas y del tablero. Queda archivado, así que un administrador puede recuperarlo.`,
      danger: true,
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    try {
      await this.projectsSvc.archivar(this.id);
      this.toast.success('Proyecto eliminado');
      await this.router.navigateByUrl('/proyectos');
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo eliminar el proyecto.'));
    }
  }

  openAssign(): void {
    this.assignee.set(''); this.prioridad.set('media'); this.nota.set(''); this.fechaLimite.set('');
    this.canalesSel.set(['correo']); this.result.set(null); this.assignOpen.set(true);
  }
  toggleCanal(c: Canal): void {
    const has = this.canalesSel().includes(c);
    this.canalesSel.set(has ? this.canalesSel().filter(x => x !== c) : [...this.canalesSel(), c]);
  }
  /** Las funciones de IA estan fuera del MVP. */
  protected readonly ia = environment.funcionesIA;

  protected asignando = signal(false);

  async doAssign(): Promise<void> {
    if (!this.assignee() || this.asignando()) return;
    this.asignando.set(true);
    try {
      // El estado de cada canal lo decide el despachador del backend.
      const { envios } = await this.assignSvc.assign(
        this.id, this.assignee(), this.auth.currentUser()?.id ?? '',
        this.prioridad(), this.nota().trim(), this.fechaLimite() || null, this.canalesSel(),
      );
      this.result.set(envios);
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo crear la asignación.'));
    } finally {
      this.asignando.set(false);
    }
  }
  closeAssign(): void { this.assignOpen.set(false); }

  // ---- IA ----
  openAi(v: 'enrich' | 'score' | 'committee' | 'docs'): void { this.aiView.set(v); }
  closeAi(): void { this.aiView.set('none'); }
  async applyEnrich(): Promise<void> {
    const e = this.enrichResult();
    if (e) {
      await this.projectsSvc.saveAi(this.id, { enriquecido: true, enrichment: e });
      this.toast.success('Proyecto enriquecido con IA');
    }
    this.closeAi();
  }
  async applyScore(): Promise<void> {
    const s = this.scoreResult();
    if (s) {
      await this.projectsSvc.saveAi(this.id, { score: s.total });
      this.toast.success('Score guardado');
    }
    this.closeAi();
  }
  downloadDoc(): void {
    const d = this.docResult(); if (!d) return;
    const text = d.titulo + '\n\n' + d.secciones.map(s => s.h.toUpperCase() + '\n' + s.body).join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = d.titulo.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.txt';
    a.click(); URL.revokeObjectURL(url);
  }
}
