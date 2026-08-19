import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../core/users.service';
import { GroupsService } from '../../core/groups.service';
import { SolicitudReset } from '../../core/users.service';
import { mensajeDeError } from '../../core/auth.service';
import { PERMISSIONS, ROLES, RoleId, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';

interface Draft {
  id?: string;
  nombre: string;
  email: string;
  cargo: string;
  rol: RoleId;
  groupId: string | null;
  activo: boolean;
  permisosExtra: string[];
  /** Solo al crear: contraseña inicial que la persona deberá cambiar. */
  password: string;
}

@Component({
  selector: 'app-users',
  imports: [FormsModule, TrapFocus],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  private usersSvc = inject(UsersService);
  private groupsSvc = inject(GroupsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  protected list = this.usersSvc.users;
  protected cargando = this.usersSvc.cargando;
  protected errorCarga = this.usersSvc.error;
  protected permisos = PERMISSIONS;
  protected roles = Object.values(ROLES);
  /** Los grupos llegan de la API: el select necesita el id, no el nombre. */
  protected grupos = this.groupsSvc.groups;
  protected solicitudes = this.usersSvc.solicitudes;

  constructor() {
    void this.usersSvc.load();
    void this.groupsSvc.load();
    void this.usersSvc.loadSolicitudes();
  }

  protected query = signal('');
  protected rolF = signal<string>('all');
  protected estadoF = signal<string>('all');
  protected sortKey = signal<'nombre' | 'rol' | 'grupo' | 'estado'>('nombre');
  protected sortDir = signal<'asc' | 'desc'>('asc');

  private filtered = computed<User[]>(() => {
    const q = this.query().trim().toLowerCase();
    return this.list().filter(u => {
      if (this.rolF() !== 'all' && u.rol !== this.rolF()) return false;
      if (this.estadoF() === 'activo' && !u.activo) return false;
      if (this.estadoF() === 'inactivo' && u.activo) return false;
      if (q && !(u.nombre + ' ' + u.email + ' ' + u.cargo + ' ' + (u.grupo ?? '')).toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected sorted = computed<User[]>(() => {
    const key = this.sortKey(), dir = this.sortDir() === 'asc' ? 1 : -1;
    const val = (u: User): string =>
      key === 'nombre' ? u.nombre :
      key === 'rol' ? u.rol :
      key === 'grupo' ? (u.grupo ?? '') :
      (u.activo ? '0' : '1');
    return [...this.filtered()].sort((a, b) => val(a).localeCompare(val(b)) * dir);
  });

  sortBy(key: 'nombre' | 'rol' | 'grupo' | 'estado'): void {
    if (this.sortKey() === key) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else { this.sortKey.set(key); this.sortDir.set('asc'); }
  }

  protected modalOpen = signal(false);
  protected draft = signal<Draft | null>(null);
  protected isEdit = computed(() => !!this.draft()?.id);
  protected rolePerms = computed(() => (this.draft() ? ROLES[this.draft()!.rol].permissions : []));

  openCreate(): void {
    this.draft.set({ nombre: '', email: '', cargo: '', rol: 'colaborador', groupId: null, activo: true, permisosExtra: [], password: '' });
    this.modalOpen.set(true);
  }
  openEdit(u: User): void {
    this.draft.set({ id: u.id, nombre: u.nombre, email: u.email, cargo: u.cargo, rol: u.rol, groupId: u.groupId, activo: u.activo, permisosExtra: [...u.permisosExtra], password: '' });
    this.modalOpen.set(true);
  }
  close(): void { this.modalOpen.set(false); this.draft.set(null); }

  patch<K extends keyof Draft>(key: K, value: Draft[K]): void {
    const d = this.draft();
    if (d) this.draft.set({ ...d, [key]: value });
  }

  isBase(permId: string): boolean { return this.rolePerms().includes(permId); }
  isChecked(permId: string): boolean {
    const d = this.draft();
    return !!d && (this.isBase(permId) || d.permisosExtra.includes(permId));
  }
  toggleExtra(permId: string): void {
    const d = this.draft();
    if (!d || this.isBase(permId)) return;
    const has = d.permisosExtra.includes(permId);
    this.draft.set({ ...d, permisosExtra: has ? d.permisosExtra.filter(x => x !== permId) : [...d.permisosExtra, permId] });
  }

  protected guardando = signal(false);

  /** Mínimo que exige el backend para la contraseña inicial. */
  protected readonly minPassword = 10;

  protected puedeGuardar = computed(() => {
    const d = this.draft();
    if (!d || !d.nombre.trim() || !d.email.trim()) return false;
    return d.id ? true : d.password.length >= this.minPassword;
  });

  async save(): Promise<void> {
    const d = this.draft();
    if (!d || !this.puedeGuardar() || this.guardando()) return;

    this.guardando.set(true);
    try {
      if (d.id) {
        await this.usersSvc.update(d.id, {
          nombre: d.nombre.trim(),
          cargo: d.cargo.trim(),
          rol: d.rol,
          groupId: d.groupId,
          activo: d.activo,
          permisosExtra: d.permisosExtra,
        });
        this.toast.success('Usuario actualizado');
      } else {
        await this.usersSvc.create({
          nombre: d.nombre.trim(),
          email: d.email.trim(),
          cargo: d.cargo.trim(),
          password: d.password,
          rol: d.rol,
          groupId: d.groupId,
          activo: d.activo,
          permisosExtra: d.permisosExtra,
        });
        this.toast.success('Usuario creado. Pasale la contraseña temporal: se le pedirá cambiarla al entrar.');
      }
      this.close();
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo guardar el usuario.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async toggleActivo(u: User): Promise<void> {
    try {
      await this.usersSvc.toggleActivo(u.id);
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo cambiar el estado.'));
    }
  }

  /** No se borra a nadie: se archiva la cuenta y se cierran sus sesiones. */
  async remove(u: User): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Archivar usuario',
      message: `¿Archivar la cuenta de ${u.nombre}? No podrá entrar y sus sesiones se cierran. Sus proyectos y asignaciones se conservan, y podés reactivarla después.`,
      danger: true,
      confirmText: 'Archivar',
    });
    if (!ok) return;
    try {
      await this.usersSvc.archivar(u.id);
      this.toast.success('Cuenta archivada');
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo archivar la cuenta.'));
    }
  }

  // ---------------- Restablecer contrasena ----------------

  protected resetPara = signal<User | null>(null);
  protected claveNueva = signal('');
  protected reseteando = signal(false);
  protected readonly minReset = 10;

  protected resetValido = computed(() => this.claveNueva().length >= this.minReset);

  abrirReset(u: User): void {
    this.claveNueva.set('');
    this.resetPara.set(u);
  }
  cerrarReset(): void {
    this.resetPara.set(null);
    this.claveNueva.set('');
  }

  /**
   * Sugerencia generada en el navegador. No la inventa el servidor ni viaja en
   * ninguna respuesta: quien la asigna es quien se la va a comunicar.
   */
  sugerirClave(): void {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    this.claveNueva.set([...bytes].map(b => alfabeto[b % alfabeto.length]).join(''));
  }

  async confirmarReset(): Promise<void> {
    const u = this.resetPara();
    if (!u || !this.resetValido() || this.reseteando()) return;

    this.reseteando.set(true);
    try {
      await this.usersSvc.resetPassword(u.id, this.claveNueva());
      this.toast.success(`Clave temporal asignada a ${u.nombre}. Pasasela: se le pedira cambiarla al entrar.`);
      this.cerrarReset();
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo restablecer la contrasena.'));
    } finally {
      this.reseteando.set(false);
    }
  }

  /** Atender el pedido desde la seccion de solicitudes. */
  atender(s: SolicitudReset): void {
    const u = this.usersSvc.byId(s.user.id);
    if (u) this.abrirReset(u);
  }

  async descartar(s: SolicitudReset): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Descartar el pedido',
      message: `Se descarta el pedido de ${s.user.nombre} sin tocar su contrasena. Se usa cuando el pedido fue un error o ya lo resolviste por otro lado.`,
      confirmText: 'Descartar',
    });
    if (!ok) return;
    try {
      await this.usersSvc.descartarSolicitud(s.id);
      this.toast.info('Pedido descartado');
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo descartar el pedido.'));
    }
  }

  hace(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ahora mismo';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return h === 1 ? 'hace una hora' : `hace ${h} horas`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} dias`;
  }

  initials(n: string): string { return n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
  roleLabel(r: RoleId): string { return ROLES[r].label; }
  effectiveCount(u: User): number { return u.permisosEfectivos?.length ?? new Set([...ROLES[u.rol].permissions, ...u.permisosExtra]).size; }
}
