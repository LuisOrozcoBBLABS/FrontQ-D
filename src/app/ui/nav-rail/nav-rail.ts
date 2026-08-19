import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AssignmentsService } from '../../core/assignments.service';
import { AuthService } from '../../core/auth.service';
import { NotificationItem } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { environment } from '../../../environments/environment';

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
 * Única pieza de navegación de la aplicación: un riel flotante con la marca, los
 * módulos y las utilidades (avisos, tema, perfil, salir). Reemplaza a la barra
 * superior, que dejaba el contenido pegado al borde y duplicaba la identidad.
 *
 * Solo iconos; el nombre se despliega al pasar el cursor o al enfocar con
 * teclado. El indicador activo se desliza entre posiciones.
 */
@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
})
export class NavRail {
  protected auth = inject(AuthService);
  private assignSvc = inject(AssignmentsService);
  private tema = inject(ThemeService);
  private router = inject(Router);

  protected notifOpen = signal(false);

  constructor() {
    void this.assignSvc.loadNotificaciones();
  }

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
      // Módulos de IA: ocultos mientras el motor no sea real (environment.funcionesIA).
      {
        path: '/conocimiento',
        label: 'Conocimiento',
        icon: 'conocimiento' as RailIcon,
        show: environment.funcionesIA,
      },
      {
        path: '/oportunidades',
        label: 'Oportunidades',
        icon: 'oportunidades' as RailIcon,
        show: environment.funcionesIA && this.auth.can('reports.view'),
      },
      { path: '/grupos', label: 'Grupos', icon: 'grupos' as RailIcon, show: this.auth.can('groups.manage') },
      { path: '/usuarios', label: 'Usuarios', icon: 'usuarios' as RailIcon, show: this.auth.can('users.manage') },
    ].filter(i => i.show),
  );

  /** Posición del indicador. -1 = ninguna sección del riel está activa (ej. /perfil). */
  protected activeIndex = computed<number>(() => {
    const actual = this.url();
    return this.items().findIndex(i => actual === i.path || actual.startsWith(i.path + '/'));
  });

  protected esOscuro = computed(() => this.tema.mode() === 'dark');
  protected enPerfil = computed(() => this.url().startsWith('/perfil'));

  protected sinLeer = computed(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.unreadCount(u.id) : 0;
  });
  protected misAvisos = computed<NotificationItem[]>(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.notificationsFor(u.id) : [];
  });

  protected iniciales = computed(() => {
    const n = this.auth.currentUser()?.nombre ?? '?';
    return n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  });

  protected rolLabel = computed(() => (this.auth.isAdmin() ? 'Administrador' : 'Colaborador'));

  toggleNotif(): void {
    this.notifOpen.set(!this.notifOpen());
  }
  closeNotif(): void {
    this.notifOpen.set(false);
  }

  toggleTema(): void {
    this.tema.toggle();
  }

  async abrirAviso(n: NotificationItem): Promise<void> {
    await this.assignSvc.markRead(n.id);
    this.notifOpen.set(false);
    if (n.projectId) await this.router.navigate(['/proyectos', n.projectId]);
  }

  async marcarTodos(): Promise<void> {
    const u = this.auth.currentUser();
    if (u) await this.assignSvc.markAllRead(u.id);
  }

  async salir(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.notifOpen.set(false);
  }
}
