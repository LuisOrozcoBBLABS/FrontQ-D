import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectsService } from '../../core/projects.service';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { GroupsService } from '../../core/groups.service';
import { AppSimilar, SECTORES } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';

/**
 * Registra un proyecto nuevo o edita uno existente. Es el mismo formulario en
 * los dos casos: los campos son idénticos y duplicarlo garantizaría que las dos
 * versiones se separen con el tiempo.
 *
 * En edición solo entra el autor o un administrador, la misma regla que aplica
 * el servidor. Si alguien llega por URL sin permiso, se lo devuelve al detalle
 * con el motivo, en lugar de dejarlo llenar un formulario que el PATCH va a
 * rechazar.
 */
@Component({
  selector: 'app-project-form',
  imports: [FormsModule, ButtonModule, InputText, Textarea, Select, Tooltip],
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss',
})
export class ProjectForm {
  private projectsSvc = inject(ProjectsService);
  private auth = inject(AuthService);
  private groupsSvc = inject(GroupsService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected sectores = SECTORES;
  protected grupos = this.groupsSvc.groups;

  /** PrimeNG trabaja con listas de opciones, no con <option>. */
  protected readonly opcionesSector = SECTORES.map(x => ({ label: x, value: x }));
  protected opcionesGrupo = computed(() => [
    { label: 'Sin grupo', value: null as string | null },
    ...this.grupos().map(g => ({ label: `Grupo ${g.nombre}`, value: g.id as string | null })),
  ]);

  /** Id cuando se está editando; cadena vacía cuando es uno nuevo. */
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly editando = this.id !== '';

  nombre = signal('');
  sector = signal<string>('');
  problema = signal('');
  dolores = signal('');
  solucion = signal('');
  plusIA = signal('');
  grupo = signal<string | null>(this.auth.currentUser()?.groupId ?? null);
  similares = signal<AppSimilar[]>([{ name: '', url: '' }]);
  error = signal<string | null>(null);
  /** Mientras trae el proyecto a editar, o mientras guarda. */
  cargando = signal(false);
  guardando = signal(false);

  constructor() {
    void this.groupsSvc.load();

    // El prellenado desde una "oportunidad" salio con la capa simulada.
    if (this.editando) void this.cargar();
  }

  /** Trae el proyecto y llena el formulario con lo que ya tiene. */
  private async cargar(): Promise<void> {
    this.cargando.set(true);
    const p = await this.projectsSvc.fetchOne(this.id);
    this.cargando.set(false);

    if (!p) {
      this.toast.error('No se encontró el proyecto.');
      await this.router.navigateByUrl('/proyectos');
      return;
    }
    if (!this.auth.esAutorOAdmin(p.autorId)) {
      this.toast.error('Solo quien lo registró puede editarlo.');
      await this.router.navigate(['/proyectos', this.id]);
      return;
    }

    this.nombre.set(p.nombre);
    this.sector.set(p.sector);
    this.problema.set(p.problema);
    this.dolores.set(p.dolores);
    this.solucion.set(p.solucion);
    this.plusIA.set(p.plusIA);
    this.grupo.set(p.groupId ?? null);
    // Siempre una fila vacía al final, para poder agregar sin un clic extra.
    this.similares.set(p.similares.length ? [...p.similares] : [{ name: '', url: '' }]);
  }

  protected titulo = computed(() => (this.editando ? 'Editar proyecto' : 'Registrar un proyecto'));
  protected verbo = computed(() => (this.editando ? 'Guardar cambios' : 'Registrar el proyecto'));

  addSimilar(): void { this.similares.set([...this.similares(), { name: '', url: '' }]); }
  removeSimilar(i: number): void { this.similares.set(this.similares().filter((_, idx) => idx !== i)); }
  patchSimilar(i: number, key: keyof AppSimilar, val: string): void {
    this.similares.set(this.similares().map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  }



  async save(): Promise<void> {
    this.error.set(null);
    if (!this.nombre().trim() || !this.sector() || !this.problema().trim()) {
      this.error.set('Completa al menos el nombre de la solución, el sector y el problema.');
      return;
    }
    if (this.guardando()) return;

    const datos = {
      nombre: this.nombre().trim(),
      sector: this.sector(),
      problema: this.problema().trim(),
      dolores: this.dolores().trim(),
      solucion: this.solucion().trim(),
      plusIA: this.plusIA().trim(),
      similares: this.similares().filter(s => s.name.trim() || s.url.trim()),
      groupId: this.grupo(),
    };

    this.guardando.set(true);
    try {
      // El estado no se toca al editar: lo mueve el tablero, y mandarlo acá
      // pisaría la etapa y ensuciaría el historial con una entrada falsa.
      const p = this.editando
        ? await this.projectsSvc.update(this.id, datos)
        : await this.projectsSvc.create({ ...datos, estado: 'idea' });

      this.toast.success(this.editando ? 'Cambios guardados' : 'Proyecto creado');
      await this.router.navigate(['/proyectos', p.id]);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo guardar el proyecto.'));
    } finally {
      this.guardando.set(false);
    }
  }

  cancel(): void {
    if (this.editando) void this.router.navigate(['/proyectos', this.id]);
    else void this.router.navigateByUrl('/proyectos');
  }
}
