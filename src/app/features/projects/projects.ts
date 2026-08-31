import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
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
 * Los roles admin y comercial quedan fuera del tablero de forma explícita: a
 * ninguno de los dos se le asignan proyectos.
 *
 * La plantilla va en línea a propósito: es solo la bifurcación, y separarla en
 * un archivo esconde la única decisión que toma este componente.
 */
@Component({
  selector: 'app-projects',
  imports: [ProjectsBoard, ProjectsMaestro],
  template: `
    @if (verTablero()) {
      <app-projects-board />
    } @else {
      <app-projects-maestro />
    }
  `,
})
export class Projects {
  private auth = inject(AuthService);

  protected verTablero = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return false;
    // Ni admin ni comercial reciben asignaciones, asi que un tablero de "lo mio"
    // les saldria vacio: los dos van a la tabla del area. Comercial ademas es de
    // solo lectura, y la tabla es justo lo que necesita — listar y filtrar.
    if (u.rol === 'admin' || u.rol === 'comercial') return false;
    return !this.auth.can('assignments.create');
  });
}
