import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupsService, MiembroResumen } from '../../core/groups.service';
import { UsersService } from '../../core/users.service';
import { Group, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { FILAS_POR_PAGINA, Paginador } from '../../ui/paginador/paginador';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { mensajeDeError } from '../../core/auth.service';

@Component({
  selector: 'app-groups',
  imports: [FormsModule, TrapFocus, Paginador],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
})
export class Groups {
  private groupsSvc = inject(GroupsService);
  private usersSvc = inject(UsersService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  protected groups = this.groupsSvc.groups;

  /** Paginacion en el cliente: los grupos son pocos por naturaleza. */
  protected readonly porPagina = FILAS_POR_PAGINA;
  protected pagina = signal(1);
  protected pagados = computed(() => {
    const desde = (this.pagina() - 1) * this.porPagina;
    return this.groups().slice(desde, desde + this.porPagina);
  });
  protected cargando = this.groupsSvc.cargando;
  protected errorCarga = this.groupsSvc.error;

  constructor() {
    void this.groupsSvc.load();
    void this.usersSvc.load();
  }

  // Modal crear/editar grupo
  protected formOpen = signal(false);
  protected editId = signal<string | null>(null);
  protected nombre = signal('');
  protected lema = signal('');

  // Modal integrantes
  protected membersFor = signal<Group | null>(null);

  members(g: Group): MiembroResumen[] { return this.groupsSvc.members(g.id); }
  memberCount(g: Group): number { return this.groupsSvc.memberCount(g.id); }
  esMiembro(u: User, g: Group): boolean { return u.groupId === g.id; }
  allUsers(): User[] { return this.usersSvc.users(); }
  initials(n: string): string { return n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }

  openCreate(): void { this.editId.set(null); this.nombre.set(''); this.lema.set(''); this.formOpen.set(true); }
  openEdit(g: Group): void { this.editId.set(g.id); this.nombre.set(g.nombre); this.lema.set(g.lema); this.formOpen.set(true); }
  async saveGroup(): Promise<void> {
    if (!this.nombre().trim()) return;
    try {
      if (this.editId()) {
        await this.groupsSvc.update(this.editId()!, { nombre: this.nombre().trim(), lema: this.lema().trim() });
        this.toast.success('Grupo actualizado');
      } else {
        await this.groupsSvc.create(this.nombre().trim(), this.lema().trim());
        this.toast.success('Grupo creado');
      }
      this.formOpen.set(false);
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo guardar el grupo.'));
    }
  }
  async removeGroup(g: Group): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Archivar grupo',
      message: `¿Archivar el grupo ${g.nombre}? Sus integrantes quedan sin grupo y los proyectos conservan su historia.`,
      danger: true,
      confirmText: 'Archivar',
    });
    if (!ok) return;
    try {
      await this.groupsSvc.archivar(g.id);
      await this.usersSvc.load();
      this.toast.success('Grupo archivado');
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo archivar el grupo.'));
    }
  }

  openMembers(g: Group): void { this.membersFor.set(g); }
  closeMembers(): void { this.membersFor.set(null); }
  async toggleMember(u: User, g: Group): Promise<void> {
    const actuales = this.groupsSvc.members(g.id).map(m => m.id);
    const nuevos = this.esMiembro(u, g) ? actuales.filter(id => id !== u.id) : [...actuales, u.id];
    try {
      await this.groupsSvc.setMembership(g.id, nuevos);
      await this.usersSvc.load();
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo actualizar los integrantes.'));
    }
  }
}
