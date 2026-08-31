import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { BorradorProyecto, aNuevoProyecto, borradorVacio, validarBorrador } from '../../core/borrador-proyecto';
import { ProjectsService } from '../../core/projects.service';
import { ToastService } from '../../core/toast.service';
import { ProjectFields } from './project-fields';

/**
 * Registrar un proyecto a mano. Los campos viven en <app-project-fields>, que
 * comparte con /documentos, así que las reglas y los topes son los mismos.
 *
 * Acá se corrigieron dos cosas que faltaban: el guardado no manejaba el error de
 * la API (si el POST fallaba, la excepción quedaba sin atrapar y el botón nunca
 * volvía a habilitarse) y no había guard de reentrada, así que dos clics rápidos
 * creaban dos proyectos. Patrones copiados de features/profile/profile.ts.
 */
@Component({
  selector: 'app-project-form',
  imports: [ProjectFields],
  templateUrl: './project-form.html',
})
export class ProjectForm {
  private projectsSvc = inject(ProjectsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected borrador = signal<BorradorProyecto>(
    borradorVacio(this.auth.currentUser()?.groupId ?? null),
  );
  protected error = signal<string | null>(null);
  protected guardando = signal(false);

  /** Guardar entra por POST /projects, que exige projects.create — no ai.use. */
  protected puedeCrear = computed(() => this.auth.can('projects.create'));
  protected puedeGuardar = computed(() => !this.guardando() && this.puedeCrear());

  async save(): Promise<void> {
    if (this.guardando()) return; // guard de reentrada: dos clics, un proyecto

    const problema = validarBorrador(this.borrador());
    this.error.set(problema);
    if (problema) return;

    this.guardando.set(true);
    try {
      const p = await this.projectsSvc.create(aNuevoProyecto(this.borrador()));
      this.toast.success('Proyecto creado');
      await this.router.navigate(['/proyectos', p.id]);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo crear el proyecto.'));
      this.toast.error(mensajeDeError(e, 'No se pudo crear el proyecto.'));
    } finally {
      this.guardando.set(false);
    }
  }

  cancel(): void {
    void this.router.navigateByUrl('/proyectos');
  }
}
