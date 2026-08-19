import { Injectable, inject, signal } from '@angular/core';
import { Assignment, AssignmentStatus, Canal, CanalEnvio, NotificationItem, Prioridad } from './models';
import { UsersService } from './users.service';
import { ProjectsService } from './projects.service';

const A_KEY = 'plataforma-id.assignments';
const N_KEY = 'plataforma-id.notifications';

@Injectable({ providedIn: 'root' })
export class AssignmentsService {
  private users = inject(UsersService);
  private projects = inject(ProjectsService);

  private _assignments = signal<Assignment[]>(this.load<Assignment>(A_KEY));
  private _notifications = signal<NotificationItem[]>(this.load<NotificationItem>(N_KEY));
  readonly assignments = this._assignments.asReadonly();
  readonly notifications = this._notifications.asReadonly();

  private load<T>(key: string): T[] {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T[]; } catch { /* ignore */ }
    return [];
  }
  private persistA(list: Assignment[]): void { this._assignments.set(list); try { localStorage.setItem(A_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
  private persistN(list: NotificationItem[]): void { this._notifications.set(list); try { localStorage.setItem(N_KEY, JSON.stringify(list)); } catch { /* ignore */ } }

  forUser(userId: string): Assignment[] {
    return this._assignments().filter(a => a.asignadoA === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  notificationsFor(userId: string): NotificationItem[] {
    return this._notifications().filter(n => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  unreadCount(userId: string): number {
    return this._notifications().filter(n => n.userId === userId && !n.leida).length;
  }

  /** Simula el "envío" por cada canal (esto lo haría n8n en producción). */
  private simulateSend(userId: string, canales: Canal[]): CanalEnvio[] {
    const u = this.users.byId(userId);
    return canales.map<CanalEnvio>(canal => {
      let destino: string;
      if (canal === 'correo' || canal === 'teams') destino = u?.email ?? '(sin correo)';
      else destino = u?.telefono || '(teléfono no configurado)';
      return { canal, destino, estado: 'Enviado (simulado)' };
    });
  }

  assign(projectId: string, userId: string, asignadoPor: string, prioridad: Prioridad, nota: string, fechaLimite: string | null, canales: Canal[]): Assignment {
    const now = new Date().toISOString();
    const a: Assignment = {
      id: 'a-' + Math.random().toString(36).slice(2, 9),
      projectId, asignadoA: userId, asignadoPor, prioridad, nota, fechaLimite,
      estado: 'pendiente', canales, createdAt: now,
    };
    this.persistA([a, ...this._assignments()]);

    const proj = this.projects.byId(projectId);
    const notif: NotificationItem = {
      id: 'n-' + Math.random().toString(36).slice(2, 9),
      userId, titulo: 'Nuevo proyecto asignado',
      detalle: `Se te asignó “${proj?.nombre ?? 'proyecto'}” con prioridad ${prioridad}.`,
      leida: false, createdAt: now, assignmentId: a.id, projectId,
      envios: this.simulateSend(userId, canales),
    };
    this.persistN([notif, ...this._notifications()]);
    return a;
  }

  updateEstado(assignmentId: string, estado: AssignmentStatus): void {
    this.persistA(this._assignments().map(a => (a.id === assignmentId ? { ...a, estado } : a)));
  }
  markRead(notifId: string): void {
    this.persistN(this._notifications().map(n => (n.id === notifId ? { ...n, leida: true } : n)));
  }
  markAllRead(userId: string): void {
    this.persistN(this._notifications().map(n => (n.userId === userId ? { ...n, leida: true } : n)));
  }
}
