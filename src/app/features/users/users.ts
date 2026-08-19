import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../core/users.service';
import { PERMISSIONS, ROLES, GRUPOS, RoleId, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';

interface Draft {
  id?: string;
  nombre: string;
  email: string;
  cargo: string;
  rol: RoleId;
  grupo: string | null;
  activo: boolean;
  permisosExtra: string[];
}

@Component({
  selector: 'app-users',
  imports: [FormsModule, TrapFocus],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  private usersSvc = inject(UsersService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  protected list = this.usersSvc.users;
  protected permisos = PERMISSIONS;
  protected roles = Object.values(ROLES);
  protected grupos = GRUPOS;

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
    this.draft.set({ nombre: '', email: '', cargo: '', rol: 'colaborador', grupo: null, activo: true, permisosExtra: [] });
    this.modalOpen.set(true);
  }
  openEdit(u: User): void {
    this.draft.set({ id: u.id, nombre: u.nombre, email: u.email, cargo: u.cargo, rol: u.rol, grupo: u.grupo, activo: u.activo, permisosExtra: [...u.permisosExtra] });
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

  save(): void {
    const d = this.draft();
    if (!d || !d.nombre.trim() || !d.email.trim()) return;
    const payload = { nombre: d.nombre.trim(), email: d.email.trim(), cargo: d.cargo.trim(), rol: d.rol, grupo: d.grupo, activo: d.activo, permisosExtra: d.permisosExtra };
    if (d.id) {
      this.usersSvc.update(d.id, payload);
      this.toast.success('Usuario actualizado');
    } else {
      this.usersSvc.create({ ...payload, avatarUrl: null, linkedin: null, genero: null, fechaNacimiento: null, onboardingCompleto: false });
      this.toast.success('Usuario creado');
    }
    this.close();
  }

  toggleActivo(u: User): void { this.usersSvc.toggleActivo(u.id); }
  async remove(u: User): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Eliminar usuario', message: `¿Eliminar a ${u.nombre}? No se puede deshacer (simulado).`, danger: true, confirmText: 'Eliminar' });
    if (ok) { this.usersSvc.remove(u.id); this.toast.success('Usuario eliminado'); }
  }
  async resetSeed(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Restaurar ejemplo', message: 'Se descartarán los cambios locales y se restaurarán los usuarios de ejemplo.', confirmText: 'Restaurar' });
    if (ok) { this.usersSvc.resetSeed(); this.toast.info('Usuarios restaurados'); }
  }

  initials(n: string): string { return n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
  roleLabel(r: RoleId): string { return ROLES[r].label; }
  effectiveCount(u: User): number { return new Set([...ROLES[u.rol].permissions, ...u.permisosExtra]).size; }
}
