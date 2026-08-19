import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AssignmentsService } from '../../core/assignments.service';
import { NotificationItem } from '../../core/models';
import { ThemeToggle } from '../../ui/theme-toggle';
import { NavRail } from '../../ui/nav-rail/nav-rail';

/**
 * Marco de la aplicación: barra superior con identidad y utilidades, dock lateral
 * de módulos (app-nav-rail) y el contenido. La navegación vive solo en el dock,
 * para no mezclar dos patrones al mismo nivel.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, ThemeToggle, NavRail],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected auth = inject(AuthService);
  private assignSvc = inject(AssignmentsService);
  private router = inject(Router);

  protected notifOpen = signal(false);

  constructor() {
    void this.assignSvc.loadNotificaciones();
  }

  protected unread = computed(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.unreadCount(u.id) : 0;
  });
  protected myNotifs = computed<NotificationItem[]>(() => {
    const u = this.auth.currentUser();
    return u ? this.assignSvc.notificationsFor(u.id) : [];
  });

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  initials(name: string): string {
    return name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  toggleNotif(): void { this.notifOpen.set(!this.notifOpen()); }
  closeNotif(): void { this.notifOpen.set(false); }

  async openNotif(n: NotificationItem): Promise<void> {
    await this.assignSvc.markRead(n.id);
    this.notifOpen.set(false);
    if (n.projectId) await this.router.navigate(['/proyectos', n.projectId]);
  }

  async markAll(): Promise<void> {
    const u = this.auth.currentUser();
    if (u) await this.assignSvc.markAllRead(u.id);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.notifOpen.set(false); }
}
