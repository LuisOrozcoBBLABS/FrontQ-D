import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../core/projects.service';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';
import { ESTADOS_PROYECTO, Project, ProjectStatus, SECTORES } from '../../core/models';
import { Empty } from '../../ui/empty';

type Orden = 'recientes' | 'nombre' | 'estado';
type Vista = 'tarjetas' | 'lista';

/** Filtro activo, para poder mostrarlo y quitarlo con un clic. */
interface FiltroActivo {
  clave: 'sector' | 'estado' | 'query';
  etiqueta: string;
}

@Component({
  selector: 'app-projects',
  imports: [RouterLink, FormsModule, Empty],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {
  private projectsSvc = inject(ProjectsService);
  private usersSvc = inject(UsersService);
  protected auth = inject(AuthService);

  protected cargando = this.projectsSvc.cargando;
  protected errorCarga = this.projectsSvc.error;

  constructor() {
    void this.projectsSvc.load();
    if (this.auth.can('users.manage')) void this.usersSvc.load();
  }

  protected sectores = SECTORES;
  protected estados = ESTADOS_PROYECTO;

  protected query = signal('');
  protected sectorF = signal<string>('all');
  protected estadoF = signal<string>('all');
  protected orden = signal<Orden>('recientes');
  protected vista = signal<Vista>('tarjetas');

  /**
   * El alcance lo decide el servidor (propios + del grupo, o todos con
   * projects.viewAll). Filtrar otra vez en el cliente solo puede ocultar cosas
   * que si corresponden.
   */
  protected visible = computed<Project[]>(() => this.projectsSvc.projects());

  /** Cuántos hay en cada estado: alimenta las pastillas de filtro. */
  protected conteoPorEstado = computed<Record<string, number>>(() => {
    const conteo: Record<string, number> = { all: this.visible().length };
    for (const e of ESTADOS_PROYECTO) conteo[e.value] = 0;
    for (const p of this.visible()) conteo[p.estado] = (conteo[p.estado] ?? 0) + 1;
    return conteo;
  });

  protected filtered = computed<Project[]>(() => {
    const q = this.query().trim().toLowerCase();
    const lista = this.visible().filter(p => {
      if (this.sectorF() !== 'all' && p.sector !== this.sectorF()) return false;
      if (this.estadoF() !== 'all' && p.estado !== this.estadoF()) return false;
      if (q && !(p.nombre + ' ' + p.problema + ' ' + p.sector).toLowerCase().includes(q)) return false;
      return true;
    });

    const peso: Record<ProjectStatus, number> = { aprobado: 0, evaluacion: 1, idea: 2, descartado: 3 };
    switch (this.orden()) {
      case 'nombre':
        return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
      case 'estado':
        return [...lista].sort((a, b) => peso[a.estado] - peso[b.estado]);
      default:
        return [...lista].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  });

  protected filtrosActivos = computed<FiltroActivo[]>(() => {
    const activos: FiltroActivo[] = [];
    if (this.query().trim()) activos.push({ clave: 'query', etiqueta: `“${this.query().trim()}”` });
    if (this.sectorF() !== 'all') activos.push({ clave: 'sector', etiqueta: this.sectorF() });
    if (this.estadoF() !== 'all') {
      activos.push({ clave: 'estado', etiqueta: this.estadoLabel(this.estadoF() as ProjectStatus) });
    }
    return activos;
  });

  /** Distingue "no hay nada" de "no hay nada que coincida": no es el mismo mensaje. */
  protected sinNada = computed(() => this.visible().length === 0);

  quitarFiltro(clave: FiltroActivo['clave']): void {
    if (clave === 'query') this.query.set('');
    if (clave === 'sector') this.sectorF.set('all');
    if (clave === 'estado') this.estadoF.set('all');
  }

  limpiarTodo(): void {
    this.query.set('');
    this.sectorF.set('all');
    this.estadoF.set('all');
  }

  estadoLabel(e: ProjectStatus): string {
    return ESTADOS_PROYECTO.find(x => x.value === e)?.label ?? e;
  }

  /** La API ya resuelve el autor: un colaborador no puede listar usuarios. */
  autorNombre(p: Project): string {
    return p.autorNombre ?? this.usersSvc.byId(p.autorId)?.nombre ?? '—';
  }

  iniciales(nombre: string): string {
    return nombre.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
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
