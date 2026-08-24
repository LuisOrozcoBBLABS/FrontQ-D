import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { UsersService } from '../../core/users.service';
import { GroupsService } from '../../core/groups.service';
import { SolicitudReset } from '../../core/users.service';
import { FILAS_POR_PAGINA, Paginador } from '../../ui/paginador/paginador';
import { seleccionMaestro } from '../../ui/seleccion-maestro';
import { mensajeDeError } from '../../core/auth.service';
import { RoleId, User } from '../../core/models';
import { TrapFocus } from '../../ui/trap-focus';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Password } from 'primeng/password';
import { Checkbox } from 'primeng/checkbox';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { Skeleton } from 'primeng/skeleton';

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
  imports: [
    FormsModule, Paginador, TableModule, ButtonModule, Select, SelectButton, InputText, IconField, InputIcon, Password, Checkbox, ToggleSwitch, Dialog, Tag, Tooltip, Skeleton,
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  private usersSvc = inject(UsersService);
  private groupsSvc = inject(GroupsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);

  protected list = this.usersSvc.users;
  protected cargando = this.usersSvc.cargando;
  protected errorCarga = this.usersSvc.error;
  /** Catálogos reales: los sirve la API desde la base, no una copia local. */
  protected permisos = this.usersSvc.permisos;
  protected roles = this.usersSvc.roles;
  /** Los grupos llegan de la API: el select necesita el id, no el nombre. */
  protected grupos = this.groupsSvc.groups;
  protected solicitudes = this.usersSvc.solicitudes;

  constructor() {
    void this.groupsSvc.load();
    void this.usersSvc.loadSolicitudes();
    void this.usersSvc.loadPermisos();
    void this.usersSvc.loadRoles();

    // Filtros y pagina se resuelven en el servidor: con volumen alto, filtrar
    // solo la pagina cargada mostraria resultados incompletos.
    effect(() => {
      const o = this.orden();
      void this.usersSvc.load({
        q: this.queryDebounce(),
        rol: this.rolF(),
        estado: this.estadoF(),
        pagina: this.pagina(),
        sort: o?.campo,
        dir: o?.dir,
      });
    });

    // Si venimos de un aviso (?reset=<id>), buscamos a esa persona y abrimos su
    // modal de clave, aunque no este en la primera pagina.
    const pedido = this.route.snapshot.queryParamMap.get('reset');
    if (pedido) void this.abrirResetPorId(pedido);
  }

  /** Escribir reinicia a la primera pagina, con 300ms de espera. */
  escribir(valor: string): void {
    this.query.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.pagina.set(1);
      this.queryDebounce.set(valor.trim());
    }, 300);
  }

  filtrarRol(valor: string): void {
    this.pagina.set(1);
    this.rolF.set(valor);
  }

  filtrarEstado(valor: string): void {
    this.pagina.set(1);
    this.estadoF.set(valor);
  }

  irAPagina(p: number): void {
    this.pagina.set(p);
  }

  /** Trae la persona del servidor si no esta en la pagina actual. */
  private async abrirResetPorId(id: string): Promise<void> {
    const enPagina = this.usersSvc.byId(id);
    if (enPagina) {
      this.abrirReset(enPagina);
      return;
    }
    const u = await this.usersSvc.fetchOne(id);
    if (u) this.abrirReset(u);
  }

  protected query = signal('');
  protected rolF = signal<string>('all');
  protected estadoF = signal<string>('all');
  protected pagina = signal(1);
  protected total = this.usersSvc.total;
  protected readonly porPagina = FILAS_POR_PAGINA;

  /** Texto ya reposado: evita una consulta por cada tecla. */
  private queryDebounce = signal('');
  private temporizador?: ReturnType<typeof setTimeout>;
  protected sortKey = signal<'nombre' | 'rol' | 'grupo' | 'estado'>('nombre');
  protected sortDir = signal<'asc' | 'desc'>('asc');

  /** La pagina que devolvio el servidor, ya filtrada y ordenada por nombre. */
  protected sorted = computed<User[]>(() => this.list());

  /**
   * Seleccion de la vista maestro-detalle. Misma mecanica que en proyectos,
   * misma implementacion: `ui/seleccion-maestro`.
   */
  protected sel = seleccionMaestro<User>(this.sorted, 'mu');

  /** Permisos que le da el rol a esa persona, para separarlos de los extras. */
  permisosDelRol(u: User): string[] {
    return this.roles().find(r => r.id === u.rol)?.permissions ?? [];
  }

  /** Etiqueta legible de un permiso; si no esta en el catalogo, su id. */
  etiquetaPermiso(id: string): string {
    return this.permisos().find(p => p.id === id)?.label ?? id;
  }

  /** Dias desde el ultimo ingreso. Null si nunca entro. */
  diasSinEntrar(u: User): number | null {
    if (!u.ultimoLoginAt) return null;
    const t = Date.parse(u.ultimoLoginAt);
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  }

  /** Texto del ultimo ingreso, que es el dato que dice si la cuenta se usa. */
  ultimoIngreso(u: User): string {
    const d = this.diasSinEntrar(u);
    if (d === null) return 'Nunca entró';
    if (d === 0) return 'Entró hoy';
    if (d === 1) return 'Entró ayer';
    if (d < 30) return `Hace ${d} días`;
    const meses = Math.floor(d / 30);
    return meses === 1 ? 'Hace un mes' : `Hace ${meses} meses`;
  }

  /**
   * Orden. Va al servidor por la misma razon que los filtros: la tabla trae 8
   * filas por pagina, asi que ordenar acá reordenaria solo esas 8 y el usuario
   * creeria que ordeno las 17 personas. El defecto —alfabetico— lo pone el
   * backend, que es como se busca en una lista de gente.
   */
  protected orden = signal<{ campo: string; dir: 'asc' | 'desc' } | null>(null);

  /** PrimeNG entrega el orden como campo + 1/-1. */
  ordenar(e: { field?: string; order?: number }): void {
    if (!e.field) return;
    const dir: 'asc' | 'desc' = e.order === -1 ? 'desc' : 'asc';
    const actual = this.orden();
    if (actual?.campo === e.field && actual.dir === dir) return;
    this.pagina.set(1); // ordenar cambia que cae en la primera pagina
    this.orden.set({ campo: e.field, dir });
  }

  protected hayFiltros = computed(
    () => Boolean(this.queryDebounce()) || this.rolF() !== 'all' || this.estadoF() !== 'all',
  );

  limpiarFiltros(): void {
    this.pagina.set(1);
    this.query.set('');
    this.queryDebounce.set('');
    this.rolF.set('all');
    this.estadoF.set('all');
  }

  /** Opciones de los filtros; PrimeNG trabaja con listas, no con <option>. */
  protected readonly opcionesRol = [
    { label: 'Todos los roles', value: 'all' },
    { label: 'Administrador', value: 'admin' },
    { label: 'Colaborador', value: 'colaborador' },
  ];
  protected readonly opcionesEstado = [
    { label: 'Todos', value: 'all' },
    { label: 'Activos', value: 'activo' },
    { label: 'Inactivos', value: 'inactivo' },
  ];
  /** Los grupos llegan de la API; se antepone la opción de dejar a la persona sin grupo. */
  protected opcionesGrupo = computed(() => [
    { label: 'Sin grupo', value: null as string | null },
    ...this.grupos().map(g => ({ label: `Grupo ${g.nombre}`, value: g.id as string | null })),
  ]);

  /** p-dialog avisa el cierre por Escape o por clic en el fondo. */
  protected alCerrarDialogo(abierto: boolean): void {
    if (!abierto) this.close();
  }
  protected alCerrarReset(abierto: boolean): void {
    if (!abierto) this.cerrarReset();
  }

  protected modalOpen = signal(false);
  protected draft = signal<Draft | null>(null);
  protected isEdit = computed(() => !!this.draft()?.id);
  protected rolePerms = computed<string[]>(() => {
    const d = this.draft();
    if (!d) return [];
    return this.usersSvc.roles().find(r => r.id === d.rol)?.permissions ?? [];
  });

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
  /** La etiqueta del rol la define la base; mientras carga, se muestra el id. */
  roleLabel(r: RoleId): string {
    return this.usersSvc.roles().find(x => x.id === r)?.label ?? r;
  }
  /** El servidor ya resuelve los permisos efectivos; el cálculo local es solo respaldo. */
  effectiveCount(u: User): number {
    if (u.permisosEfectivos) return u.permisosEfectivos.length;
    const base = this.usersSvc.roles().find(x => x.id === u.rol)?.permissions ?? [];
    return new Set([...base, ...u.permisosExtra]).size;
  }
}
