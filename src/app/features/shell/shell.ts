import { Component, ElementRef, DestroyRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { NavRail } from '../../ui/nav-rail/nav-rail';

/**
 * Marco de la aplicación. Ya no hay barra superior: el riel lateral lleva la
 * marca, los módulos y las utilidades, y el fondo lleva la marca de agua del
 * área. Un solo patrón de navegación, sin identidad duplicada.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, NavRail],
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
