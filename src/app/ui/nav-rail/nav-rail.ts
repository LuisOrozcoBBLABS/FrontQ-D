import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';

export type RailIcon =
  | 'inicio'
  | 'proyectos'
  | 'asignaciones'
  | 'conocimiento'
  | 'oportunidades'
  | 'grupos'
  | 'usuarios';

export interface RailItem {
  path: string;
  label: string;
  icon: RailIcon;
  show: boolean;
}

/**
 * Dock flotante de módulos: solo iconos, con el nombre desplegándose al pasar el
 * cursor (o al enfocar con teclado). El indicador activo es una pieza que se
 * desliza entre posiciones, así el cambio de sección se lee como movimiento
 * y no como un salto.
 */
@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
})
export class NavRail {
  private auth = inject(AuthService);
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected items = computed<RailItem[]>(() =>
    [
      { path: '/inicio', label: 'Inicio', icon: 'inicio' as RailIcon, show: true },
      { path: '/proyectos', label: 'Proyectos', icon: 'proyectos' as RailIcon, show: true },
      { path: '/asignaciones', label: 'Asignaciones', icon: 'asignaciones' as RailIcon, show: true },
      { path: '/conocimiento', label: 'Conocimiento', icon: 'conocimiento' as RailIcon, show: true },
      {
        path: '/oportunidades',
        label: 'Oportunidades',
        icon: 'oportunidades' as RailIcon,
        show: this.auth.can('reports.view'),
      },
      { path: '/grupos', label: 'Grupos', icon: 'grupos' as RailIcon, show: this.auth.can('groups.manage') },
      { path: '/usuarios', label: 'Usuarios', icon: 'usuarios' as RailIcon, show: this.auth.can('users.manage') },
    ].filter(i => i.show),
  );

  /** Posición del indicador. -1 = ninguna sección del dock está activa (ej. /perfil). */
  protected activeIndex = computed<number>(() => {
    const actual = this.url();
    return this.items().findIndex(i => actual === i.path || actual.startsWith(i.path + '/'));
  });
}
