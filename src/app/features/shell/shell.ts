import { Component, ElementRef, DestroyRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { NavRail } from '../../ui/nav-rail/nav-rail';

/**
 * Marco de la aplicación: tira de marca arriba, riel de navegación a la
 * izquierda, marca de agua del área en el fondo y crédito de la plataforma
 * abajo.
 *
 * La tira y el pie no navegan (salvo el logotipo, que va a inicio, la única
 * convención que se conserva de cuando la marca vivía dentro del riel): son
 * identidad, no chrome. Toda la navegación sigue estando en un solo lugar.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, NavRail],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly router = inject(Router);
  private readonly contenido = viewChild<ElementRef<HTMLElement>>('contenido');

  constructor() {
    /**
     * Al cambiar de ruta, el foco se mueve al <main>.
     *
     * Sin esto el foco se queda en el ítem del riel que se acaba de pulsar, o
     * se pierde al <body>. Para quien ve la pantalla el cambio es obvio; para
     * quien usa lector de pantalla no pasó nada, y encima la View Transitions
     * API hace que la pantalla se reemplace sin ninguna señal para la
     * tecnología asistiva.
     *
     * `skip(1)` deja pasar la navegación inicial: en la primera carga el foco
     * tiene que quedarse donde lo puso el navegador, no saltar solo.
     */
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.contenido()?.nativeElement.focus({ preventScroll: true }));
  }
}
