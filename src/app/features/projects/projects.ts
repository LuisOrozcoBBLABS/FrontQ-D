import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ProjectModal } from './project-modal';
import { ProjectsBoard } from './projects-board';
import { ProjectsMaestro } from './projects-maestro';

/**
 * `/proyectos` no muestra lo mismo a todos, porque no es el mismo trabajo:
 *
 * - Quien **ejecuta** ve el tablero de punta a punta con lo que tiene a cargo,
 *   y mueve sus tarjetas de etapa.
 * - Quien **asigna** (jefatura de innovación) y la **administración** ven la
 *   tabla del área: a esas cuentas no se les asignan proyectos, así que un
 *   tablero de "lo mío" les saldría vacío. Necesitan listar, filtrar y paginar
 *   todo el conjunto.
 *
 * El criterio es el permiso `assignments.create`: quien puede asignar, asigna.
 * El rol admin queda fuera del tablero de forma explícita.
 *
 * Además monta el modal de alta y edición, y lo monta **una sola vez** acá y no
 * dentro de cada vista: es el mismo modal para la tabla y para el tablero, y
 * duplicarlo garantizaría que las dos copias se separen.
 *
 * **El modal se abre desde la URL** (`?nuevo=1`, `?editar=<id>`) y no desde una
 * bandera interna. Así el enlace del dashboard sigue llevando a registrar una
 * idea, `/proyectos/nuevo` puede redirigir acá en vez de morir en un 404, y
 * volver atrás con el navegador cierra el diálogo en lugar de sacar a la
 * persona de la pantalla.
 *
 * La plantilla va en línea a propósito: es solo la bifurcación y el modal.
 */
@Component({
  selector: 'app-projects',
  imports: [ProjectsBoard, ProjectsMaestro, ProjectModal],
  template: `
    @if (verTablero()) {
      <app-projects-board />
    } @else {
      <app-projects-maestro />
    }

    <app-project-modal
      [abierto]="modalAbierto()"
      (abiertoChange)="alCambiarModal($event)"
      [id]="editandoId()"
    />
  `,
})
export class Projects {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected verTablero = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return false;
    if (u.rol === 'admin') return false;
    return !this.auth.can('assignments.create');
  });

  private params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected modalAbierto = computed(
    () => this.params().has('nuevo') || !!this.params().get('editar'),
  );
  protected editandoId = computed(() => this.params().get('editar'));

  /**
   * Cerrar el modal es sacar el parámetro de la URL, no apagar una bandera: la
   * URL es la que manda. `replaceUrl` para que cerrar no deje una entrada
   * intermedia en el historial y "atrás" no vuelva a abrirlo.
   */
  protected alCambiarModal(abierto: boolean): void {
    if (abierto) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { nuevo: null, editar: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
