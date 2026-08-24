import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../core/projects.service';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { ESTADOS_PROYECTO, Project, ProjectStatus, SECTORES } from '../../core/models';
import { FILAS_POR_PAGINA, Paginador } from '../../ui/paginador/paginador';

/** Filtro activo, para poder mostrarlo y quitarlo con un clic. */
interface FiltroActivo {
  clave: 'sector' | 'estado' | 'query';
  etiqueta: string;
}

@Component({
  selector: 'app-projects-table',
  imports: [RouterLink, FormsModule, Paginador],
  templateUrl: './projects-table.html',
  styleUrl: './projects-table.scss',
})
export class ProjectsTable {
  private projectsSvc = inject(ProjectsService);
  protected auth = inject(AuthService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  /** Id que se está eliminando: deshabilita su botón mientras viaja. */
  protected borrando = signal<string | null>(null);

  protected cargando = this.projectsSvc.cargando;
  protected errorCarga = this.projectsSvc.error;
  /** Total en el servidor, no lo que hay en la página. */
  protected total = this.projectsSvc.total;
  protected conteoPorEstado = this.projectsSvc.porEstado;
  protected lista = this.projectsSvc.projects;
  protected readonly porPagina = FILAS_POR_PAGINA;

  protected sectores = SECTORES;
  protected estados = ESTADOS_PROYECTO;

  protected query = signal('');
  protected sectorF = signal<string>('all');
  protected estadoF = signal<string>('all');
  protected pagina = signal(1);

  /** Texto ya reposado: evita una consulta por cada tecla. */
  private queryDebounce = signal('');
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    // Cualquier cambio de filtro o de pagina vuelve a pedir esa pagina al
    // servidor: con volumen alto, filtrar en el cliente mostraria datos falsos.
    effect(() => {
      const filtro = {
        q: this.queryDebounce(),
        sector: this.sectorF(),
        estado: this.estadoF(),
        pagina: this.pagina(),
      };
      void this.projectsSvc.load(filtro);
      void this.projectsSvc.loadPorEstado(filtro);
    });
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

  filtrarSector(valor: string): void {
    this.pagina.set(1);
    this.sectorF.set(valor);
  }

  filtrarEstado(valor: string): void {
    this.pagina.set(1);
    this.estadoF.set(valor);
  }

  irAPagina(p: number): void {
    this.pagina.set(p);
  }

  protected filtrosActivos = computed<FiltroActivo[]>(() => {
    const activos: FiltroActivo[] = [];
    if (this.queryDebounce()) activos.push({ clave: 'query', etiqueta: `“${this.queryDebounce()}”` });
    if (this.sectorF() !== 'all') activos.push({ clave: 'sector', etiqueta: this.sectorF() });
    if (this.estadoF() !== 'all') {
      activos.push({ clave: 'estado', etiqueta: this.estadoLabel(this.estadoF() as ProjectStatus) });
    }
    return activos;
  });

  /** Distingue "no hay nada" de "no hay nada que coincida". */
  protected sinFiltros = computed(() => this.filtrosActivos().length === 0);

  quitarFiltro(clave: FiltroActivo['clave']): void {
    this.pagina.set(1);
    if (clave === 'query') {
      this.query.set('');
      this.queryDebounce.set('');
    }
    if (clave === 'sector') this.sectorF.set('all');
    if (clave === 'estado') this.estadoF.set('all');
  }

  limpiarTodo(): void {
    this.pagina.set(1);
    this.query.set('');
    this.queryDebounce.set('');
    this.sectorF.set('all');
    this.estadoF.set('all');
  }

  estadoLabel(e: ProjectStatus): string {
    return ESTADOS_PROYECTO.find(x => x.value === e)?.label ?? e;
  }

  /** La API ya resuelve el autor: un colaborador no puede listar usuarios. */
  autorNombre(p: Project): string {
    return p.autorNombre ?? '—';
  }

  iniciales(nombre: string): string {
    return nombre.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  /** Editar y eliminar son del autor, igual que en el servidor. */
  esMio(p: Project): boolean {
    return this.auth.esAutorOAdmin(p.autorId);
  }

  async editar(p: Project): Promise<void> {
    await this.router.navigate(['/proyectos', p.id, 'editar']);
  }

  /**
   * "Eliminar" archiva: sale de las listas pero no se pierde. El texto de la
   * confirmación lo dice, en lugar de prometer un borrado que la API no hace.
   */
  async eliminar(p: Project): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar proyecto',
      message: `¿Eliminar “${p.nombre}”? Desaparece de las listas y del tablero. Queda archivado, así que se puede recuperar.`,
      danger: true,
      confirmText: 'Eliminar',
    });
    if (!ok) return;

    this.borrando.set(p.id);
    try {
      await this.projectsSvc.archivar(p.id);
      this.toast.success('Proyecto eliminado');
      // Recarga la página actual: al sacar una fila, la de abajo sube.
      await this.projectsSvc.load({
        q: this.query(),
        sector: this.sectorF(),
        estado: this.estadoF(),
        pagina: this.pagina(),
      });
      void this.projectsSvc.loadPorEstado({ q: this.query(), sector: this.sectorF() });
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo eliminar el proyecto.'));
    } finally {
      this.borrando.set(null);
    }
  }

  /** Toda la fila lleva al detalle, no solo el nombre. */
  abrir(p: Project): void {
    void this.router.navigate(['/proyectos', p.id]);
  }

  /** El problema como subtitulo: da contexto sin romper la altura de la fila. */
  recorte(texto: string, max = 76): string {
    const limpio = texto.trim();
    return limpio.length > max ? limpio.slice(0, max).trimEnd() + '…' : limpio;
  }

  /** Fecha en lenguaje humano: "hace 3 días" dice más que un 2026-08-19. */
  hace(iso: string): string {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    return meses === 1 ? 'hace un mes' : `hace ${meses} meses`;
  }
}
