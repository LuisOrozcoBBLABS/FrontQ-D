import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Assignment,
  AssignmentStatus,
  Canal,
  CanalEnvio,
  NotificationItem,
  Prioridad,
  TipoAviso,
} from './models';

interface AssignmentApi {
  id: string;
  projectId: string;
  asignadoAId: string;
  asignadoPorId: string;
  prioridad: Prioridad;
  nota: string;
  fechaLimite: string | null;
  estado: string;
  canales: Canal[];
  createdAt: string;
  project?: { id: string; nombre: string };
  asignadoA?: { id: string; nombre: string };
  asignadoPor?: { id: string; nombre: string };
  notificaciones?: NotificationApi[];
}

interface NotificationApi {
  id: string;
  userId: string;
  tipo: TipoAviso;
  sujetoId: string | null;
  titulo: string;
  detalle: string;
  leida: boolean;
  createdAt: string;
  assignmentId: string | null;
  projectId: string | null;
  envios: { canal: Canal; destino: string; estado: string; detalle: string | null }[];
}

@Injectable({ providedIn: 'root' })
export class AssignmentsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Las mias: /assignments?mias=true */
  private readonly _assignments = signal<Assignment[]>([]);
  /** Las del area completa: /assignments?mias=false (pide assignments.create) */
  private readonly _todas = signal<Assignment[]>([]);
  private readonly _notifications = signal<NotificationItem[]>([]);
  private readonly _cargando = signal(false);

  readonly assignments = this._assignments.asReadonly();
  readonly todas = this._todas.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly cargando = this._cargando.asReadonly();

  /** Carga las asignaciones de la persona autenticada. */
  async load(): Promise<void> {
    this._cargando.set(true);
    try {
      const lista = await firstValueFrom(
        this.http.get<AssignmentApi[]>(`${this.base}/assignments`, { params: { mias: 'true' } }),
      );
      this._assignments.set(lista.map(aAsignacion));
    } catch {
      /* la vista muestra su propio estado vacío */
    } finally {
      this._cargando.set(false);
    }
  }

  /** Todas las del area. Requiere assignments.create; el servidor lo valida. */
  async loadTodas(): Promise<void> {
    try {
      const lista = await firstValueFrom(
        this.http.get<AssignmentApi[]>(`${this.base}/assignments`, { params: { mias: 'false' } }),
      );
      this._todas.set(lista.map(aAsignacion));
    } catch {
      /* sin permiso o sin conexion: la tabla queda vacia con su mensaje */
    }
  }

  async loadNotificaciones(): Promise<void> {
    try {
      const lista = await firstValueFrom(
        this.http.get<NotificationApi[]>(`${this.base}/notifications`),
      );
      this._notifications.set(lista.map(aNotificacion));
    } catch {
      /* la campana queda vacía */
    }
  }

  /** Firmas heredadas: la API ya filtra por la persona autenticada. */
  forUser(_userId: string): Assignment[] {
    return this._assignments();
  }

  notificationsFor(_userId: string): NotificationItem[] {
    return this._notifications();
  }

  unreadCount(_userId: string): number {
    return this._notifications().filter(n => !n.leida).length;
  }

  async assign(
    projectId: string,
    userId: string,
    _asignadoPor: string,
    prioridad: Prioridad,
    nota: string,
    fechaLimite: string | null,
    canales: Canal[],
  ): Promise<{ asignacion: Assignment; envios: CanalEnvio[] }> {
    const creada = await firstValueFrom(
      this.http.post<AssignmentApi>(`${this.base}/assignments`, {
        projectId,
        asignadoAId: userId,
        prioridad,
        nota,
        fechaLimite,
        canales,
      }),
    );
    const asignacion = aAsignacion(creada);
    // La recien creada puede ser para otra persona: entra en la lista del area.
    this._todas.update(l => [asignacion, ...l]);
    if (asignacion.asignadoA === asignacion.asignadoPor) {
      this._assignments.update(l => [asignacion, ...l]);
    }

    // Los envios vienen en la respuesta: son de la notificacion del destinatario,
    // asi que no se pueden leer desde /notifications de quien asigna.
    const envios = (creada.notificaciones ?? []).flatMap(n =>
      n.envios.map<CanalEnvio>(e => ({
        canal: e.canal,
        destino: e.destino,
        estado: etiquetaEnvio(e.estado, e.detalle),
      })),
    );
    return { asignacion, envios };
  }

  async updateEstado(assignmentId: string, estado: AssignmentStatus): Promise<void> {
    const actualizada = await firstValueFrom(
      this.http.patch<AssignmentApi>(`${this.base}/assignments/${assignmentId}/estado`, { estado }),
    );
    const a = aAsignacion(actualizada);
    this._assignments.update(l => l.map(x => (x.id === a.id ? a : x)));
    this._todas.update(l => l.map(x => (x.id === a.id ? a : x)));
  }

  async markRead(notifId: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/notifications/${notifId}/read`, {}));
    this._notifications.update(l => l.map(n => (n.id === notifId ? { ...n, leida: true } : n)));
  }

  async markAllRead(_userId: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/notifications/read-all`, {}));
    this._notifications.update(l => l.map(n => ({ ...n, leida: true })));
  }
}

/** El backend usa guion bajo en los enums; el front, guion. */
function estadoDesdeApi(estado: string): AssignmentStatus {
  return estado.replace(/_/g, '-') as AssignmentStatus;
}

function aAsignacion(a: AssignmentApi): Assignment {
  return {
    id: a.id,
    projectId: a.projectId,
    projectNombre: a.project?.nombre,
    asignadoANombre: a.asignadoA?.nombre,
    asignadoPorNombre: a.asignadoPor?.nombre,
    envios: (a.notificaciones ?? []).flatMap(n =>
      n.envios.map<CanalEnvio>(e => ({
        canal: e.canal,
        destino: e.destino,
        estado: etiquetaEnvio(e.estado, e.detalle),
      })),
    ),
    asignadoA: a.asignadoAId,
    asignadoPor: a.asignadoPorId,
    prioridad: a.prioridad,
    nota: a.nota,
    fechaLimite: a.fechaLimite ? a.fechaLimite.slice(0, 10) : null,
    estado: estadoDesdeApi(a.estado),
    canales: a.canales,
    createdAt: a.createdAt,
  };
}

function aNotificacion(n: NotificationApi): NotificationItem {
  return {
    id: n.id,
    userId: n.userId,
    tipo: n.tipo ?? 'general',
    sujetoId: n.sujetoId ?? null,
    titulo: n.titulo,
    detalle: n.detalle,
    leida: n.leida,
    createdAt: n.createdAt,
    assignmentId: n.assignmentId ?? '',
    projectId: n.projectId ?? '',
    envios: n.envios.map<CanalEnvio>(e => ({
      canal: e.canal,
      destino: e.destino,
      // Estado real del envío, con el motivo cuando falta algo.
      estado: etiquetaEnvio(e.estado, e.detalle),
    })),
  };
}

function etiquetaEnvio(estado: string, detalle: string | null): string {
  switch (estado) {
    case 'enviado':
      return 'Enviado';
    case 'pendiente':
      return 'En cola';
    case 'fallido':
      return `Falló${detalle ? `: ${detalle}` : ''}`;
    case 'no_configurado':
      return detalle ?? 'Canal no configurado';
    default:
      return estado;
  }
}
