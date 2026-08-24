import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupsService, MiembroResumen } from '../../core/groups.service';
import { UsersService } from '../../core/users.service';
import { Group, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { FILAS_POR_PAGINA, Paginador } from '../../ui/paginador/paginador';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Checkbox } from 'primeng/checkbox';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Dialog } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { mensajeDeError } from '../../core/auth.service';

@Component({
  selector: 'app-groups',
  imports: [
    FormsModule,
    Paginador,
    TableModule,
    ButtonModule,
    InputText,
    Checkbox,
    IconField,
    InputIcon,
    Dialog,
    Tooltip,
  ],
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

  // ---------------- Integrantes: selector de dos paneles ----------------
  protected membersFor = signal<Group | null>(null);

  /**
   * Composicion en preparacion. Los cambios NO se aplican al marcar: se juntan
   * acá y se guardan de una vez.
   *
   * Antes cada interruptor disparaba un PATCH al instante, asi que mover a tres
   * personas eran tres requests y no habia forma de arrepentirse. Y como cada
   * persona pertenece a un solo grupo, ese guardado silencioso la sacaba de su
   * equipo anterior sin decirlo.
   */
  protected enGrupo = signal<string[]>([]);
  /** Marcadas en el panel de disponibles, esperando pasar al grupo. */
  protected marcadas = signal<string[]>([]);
  protected filtroDisponibles = signal('');
  protected filtroEquipo = signal('');
  protected guardando = signal(false);

  /** Todas las personas activas del area, no la pagina de la tabla. */
  private todas = this.usersSvc.todos;

  private coincide(u: User, texto: string): boolean {
    const t = texto.trim().toLowerCase();
    if (!t) return true;
    return (u.nombre + ' ' + u.email + ' ' + (u.cargo ?? '')).toLowerCase().includes(t);
  }

  /** Quienes no estan en la composicion en preparacion. */
  protected disponibles = computed<User[]>(() => {
    const dentro = new Set(this.enGrupo());
    return this.todas()
      .filter(u => !dentro.has(u.id))
      .filter(u => this.coincide(u, this.filtroDisponibles()));
  });

  /** Quienes si estan, en el orden en que se ven a la derecha. */
  protected equipo = computed<User[]>(() => {
    const dentro = new Set(this.enGrupo());
    return this.todas()
      .filter(u => dentro.has(u.id))
      .filter(u => this.coincide(u, this.filtroEquipo()));
  });

  /** Composicion original, para saber que cambio. */
  private original = signal<string[]>([]);

  protected cambios = computed(() => {
    const antes = new Set(this.original());
    const ahora = new Set(this.enGrupo());
    const entran = [...ahora].filter(id => !antes.has(id));
    const salen = [...antes].filter(id => !ahora.has(id));
    return { entran, salen, total: entran.length + salen.length };
  });

  /**
   * De que grupo sale cada persona que entra. Es la consecuencia que el diseño
   * anterior escondia: activar a alguien lo saca de su equipo actual.
   */
  protected consecuencias = computed(() => {
    const g = this.membersFor();
    return this.cambios().entran
      .map(id => this.todas().find(u => u.id === id))
      .filter((u): u is User => !!u && !!u.grupo && u.groupId !== g?.id)
      .map(u => ({ nombre: u.nombre, desde: u.grupo as string }));
  });

  /** Etiqueta del grupo de origen, para pintarla en la fila de disponibles. */
  grupoDe(u: User): string {
    return u.grupo ? 'Grupo ' + u.grupo : 'Sin grupo';
  }
  saleDeOtro(u: User): boolean {
    return !!u.grupo && u.groupId !== this.membersFor()?.id;
  }

  estaMarcada(u: User): boolean { return this.marcadas().includes(u.id); }

  marcar(u: User): void {
    this.marcadas.update(l => (l.includes(u.id) ? l.filter(x => x !== u.id) : [...l, u.id]));
  }

  /** Pasa lo marcado al grupo. Sin nada marcado no hace nada. */
  pasarAlGrupo(): void {
    const ids = this.marcadas();
    if (!ids.length) return;
    this.enGrupo.update(l => [...new Set([...l, ...ids])]);
    this.marcadas.set([]);
  }

  /** Saca a una persona de la composicion en preparacion. */
  sacarDelGrupo(u: User): void {
    this.enGrupo.update(l => l.filter(id => id !== u.id));
  }

  /** Vuelve todo a como estaba al abrir, sin tocar el servidor. */
  descartarCambios(): void {
    this.enGrupo.set([...this.original()]);
    this.marcadas.set([]);
  }

  async guardarIntegrantes(): Promise<void> {
    const g = this.membersFor();
    if (!g || !this.cambios().total || this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.groupsSvc.setMembership(g.id, this.enGrupo());
      // Refrescar las TRES vistas que dependen de esto: la lista completa del
      // selector, la pagina de la tabla de personas y los grupos — los avatares
      // y el conteo de la tabla de grupos salen de ahi, y sin esta recarga
      // seguian mostrando a la persona en su equipo anterior.
      await Promise.all([
        this.usersSvc.cargarTodos(true),
        this.usersSvc.load(),
        this.groupsSvc.load(),
      ]);
      const { entran, salen } = this.cambios();
      const partes: string[] = [];
      if (entran.length) partes.push(`${entran.length} ${entran.length === 1 ? 'entra' : 'entran'}`);
      if (salen.length) partes.push(`${salen.length} ${salen.length === 1 ? 'sale' : 'salen'}`);
      this.toast.success(`Grupo ${g.nombre}: ${partes.join(' y ')}`);
      this.closeMembers();
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo actualizar los integrantes.'));
    } finally {
      this.guardando.set(false);
    }
  }

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

  openMembers(g: Group): void {
    // La lista completa hace falta antes de mostrar los dos paneles: con la
    // pagina de la tabla solo se veian 8 de las 17 personas del area.
    void this.usersSvc.cargarTodos();
    const actuales = this.groupsSvc.members(g.id).map(m => m.id);
    this.original.set(actuales);
    this.enGrupo.set([...actuales]);
    this.marcadas.set([]);
    this.filtroDisponibles.set('');
    this.filtroEquipo.set('');
    this.membersFor.set(g);
  }
  /** p-dialog avisa el cierre por Escape o clic en el fondo. */
  protected alCerrarIntegrantes(abierto: boolean): void {
    if (!abierto) this.closeMembers();
  }
  closeMembers(): void { this.membersFor.set(null); }
}
