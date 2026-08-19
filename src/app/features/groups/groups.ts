import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupsService } from '../../core/groups.service';
import { UsersService } from '../../core/users.service';
import { Group, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';

@Component({
  selector: 'app-groups',
  imports: [FormsModule, TrapFocus],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
})
export class Groups {
  private groupsSvc = inject(GroupsService);
  private usersSvc = inject(UsersService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  protected groups = this.groupsSvc.groups;

  // Modal crear/editar grupo
  protected formOpen = signal(false);
  protected editId = signal<string | null>(null);
  protected nombre = signal('');
  protected lema = signal('');

  // Modal integrantes
  protected membersFor = signal<Group | null>(null);

  members(nombre: string): User[] { return this.groupsSvc.members(nombre); }
  memberCount(nombre: string): number { return this.groupsSvc.memberCount(nombre); }
  allUsers(): User[] { return this.usersSvc.users(); }
  initials(n: string): string { return n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }

  openCreate(): void { this.editId.set(null); this.nombre.set(''); this.lema.set(''); this.formOpen.set(true); }
  openEdit(g: Group): void { this.editId.set(g.id); this.nombre.set(g.nombre); this.lema.set(g.lema); this.formOpen.set(true); }
  saveGroup(): void {
    if (!this.nombre().trim()) return;
    if (this.editId()) { this.groupsSvc.update(this.editId()!, { nombre: this.nombre().trim(), lema: this.lema().trim() }); this.toast.success('Grupo actualizado'); }
    else { this.groupsSvc.create(this.nombre(), this.lema()); this.toast.success('Grupo creado'); }
    this.formOpen.set(false);
  }
  async removeGroup(g: Group): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Eliminar grupo', message: `¿Eliminar el grupo ${g.nombre}? Sus integrantes quedarán sin grupo.`, danger: true, confirmText: 'Eliminar' });
    if (ok) { this.groupsSvc.remove(g.id); this.toast.success('Grupo eliminado'); }
  }

  openMembers(g: Group): void { this.membersFor.set(g); }
  closeMembers(): void { this.membersFor.set(null); }
  toggleMember(u: User, g: Group): void { this.groupsSvc.setMembership(u.id, g.nombre, u.grupo !== g.nombre); }
}
