import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProjectsService } from '../../core/projects.service';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { Project, etapaDe } from '../../core/models';
import { ButtonModule } from 'primeng/button';
import { diasEnEtapa, diasEnEtapas, diasTotales, humano, tramos } from '../../core/tiempos';

/**
 * Panel lateral con el detalle. Es un panel y no una página porque el tablero
 * tiene que seguir visible detrás: cerrar no reconstruye las columnas ni
 * pierde el scroll.
 *
 * La tarjeta del tablero solo trae la última entrada del historial, así que al
 * abrir se pide el detalle completo. Mientras llega se muestra lo que ya se
 * tiene, para que el panel no aparezca vacío.
 */
@Component({
  selector: 'app-project-panel',
  imports: [RouterLink, ButtonModule],
  templateUrl: './project-panel.html',
  styleUrl: './project-panel.scss',
})
export class ProjectPanel {
  private projectsSvc = inject(ProjectsService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly resumen = input.required<Project>();
  /**
   * Embebido en una columna en lugar de flotando al costado. Es el mismo
   * contenido en los dos casos —tiempos, historial, responsables— y duplicarlo
   * garantizaria que las dos versiones se separen con el tiempo. En modo
   * embebido no hay capa oscura ni boton de cerrar: no hay nada que cerrar.
   */
  readonly embebido = input<boolean>(false);
  readonly cerrar = output<void>();
  /** Avisa que el proyecto ya no está: el tablero cierra el panel. */
  readonly eliminado = output<string>();

  /** Versión completa traída del servidor; null mientras no llega. */
  private completo = signal<Project | null>(null);
  protected cargando = signal(false);
  /**
   * El detalle no llego. Se distingue de "cargando" a proposito: un panel que
   * dice "cargando" para siempre miente, y quien lo mira no sabe si esperar o
   * reintentar.
   */
  protected fallo = signal(false);

  /** Temporizador de la carga del detalle. Ver el comentario del constructor. */
  private espera?: ReturnType<typeof setTimeout>;
  /**
   * Ultimo proyecto pedido. Sin esto el panel entra en bucle:
   *
   * `fetchOne` guarda el detalle en la lista del servicio, la lista emite un
   * objeto nuevo para ese proyecto, la entrada `resumen` cambia de referencia y
   * el efecto se vuelve a disparar — pidiendo otra vez el mismo detalle, para
   * siempre. Lo que importa es que cambie el PROYECTO, no la referencia.
   */
  private ultimoPedido: string | null = null;

  constructor() {
    effect(() => {
      const id = this.resumen().id;
      if (id === this.ultimoPedido) return;
      this.ultimoPedido = id;

      this.completo.set(null);
      this.fallo.set(false);
      this.cargando.set(true);

      /*
       * 220 ms de espera antes de pedir el detalle.
       *
       * En la vista maestro-detalle la selección cambia con las flechas del
       * teclado, así que recorrer diez proyectos disparaba diez consultas y el
       * servidor devolvía 429. Con la espera, mientras la persona sigue
       * moviéndose no sale ninguna: solo se pide el detalle de donde se detuvo.
       */
      clearTimeout(this.espera);
      this.espera = setTimeout(() => {
        void this.projectsSvc.fetchOne(id).then(p => {
          // Si mientras cargaba se eligió otro, esta respuesta ya no sirve.
          if (this.resumen().id === id) {
            if (p) this.completo.set(p);
            else this.fallo.set(true);
            this.cargando.set(false);
          }
        });
      }, 220);
    });

    // Al destruirse el panel no queda una consulta en camino sin dueño.
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
  }

  protected p = computed<Project>(() => this.completo() ?? this.resumen());

  protected etapa = computed(() => etapaDe(this.p().estado));
  protected diasEtapa = computed(() => diasEnEtapa(this.p()));
  protected diasTotal = computed(() => diasTotales(this.p()));
  protected diasEtapas = computed(() => diasEnEtapas(this.p().historial));

  /** Del más reciente al más viejo: el historial se lee de arriba hacia abajo. */
  protected historial = computed(() => [...tramos(this.p().historial)].reverse());

  /** Solo cuando el detalle ya llegó: con el resumen daría una lista falsa. */
  protected historialListo = computed(() => this.completo() !== null);

  protected responsables = computed(() => this.p().responsables ?? []);

  protected humano = humano;
  protected etapaDe = etapaDe;

  protected fecha(iso: string | null | undefined): string {
    if (!iso) return '—';
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '—';
    return new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected iniciales(nombre: string): string {
    return nombre.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  /** Los campos largos solo se pintan si tienen algo: bloques vacíos son ruido. */
  protected bloques = computed(() => {
    const p = this.p();
    return [
      { titulo: 'Problema identificado', texto: p.problema },
      { titulo: 'Dolores dentro del problema', texto: p.dolores },
      { titulo: 'Solución planteada', texto: p.solucion },
      { titulo: 'El PLUS con IA', texto: p.plusIA },
    ].filter(b => b.texto?.trim());
  });

  /** Editar y eliminar son del autor, igual que en el servidor. */
  protected esMio = computed(() => this.auth.esAutorOAdmin(this.p().autorId));

  protected borrando = signal(false);

  /** Reintento a mano: vale más que una disculpa. */
  protected async reintentar(): Promise<void> {
    const id = this.resumen().id;
    this.ultimoPedido = id; // ya pedido: el efecto no debe volver a dispararlo
    this.fallo.set(false);
    this.cargando.set(true);
    const p = await this.projectsSvc.fetchOne(id);
    if (this.resumen().id !== id) return;
    if (p) this.completo.set(p);
    else this.fallo.set(true);
    this.cargando.set(false);
  }

  protected async editar(): Promise<void> {
    await this.router.navigate(['/proyectos', this.p().id, 'editar']);
  }

  /**
   * "Eliminar" archiva: sale del tablero y de las listas, pero no se pierde.
   * Se pregunta siempre, y el texto dice qué pasa de verdad en lugar de
   * prometer un borrado que la API no hace.
   */
  protected async eliminar(): Promise<void> {
    const p = this.p();
    const ok = await this.confirm.ask({
      title: 'Eliminar proyecto',
      message: `¿Eliminar “${p.nombre}”? Desaparece del tablero y de las listas. Queda archivado, así que un administrador puede recuperarlo.`,
      danger: true,
      confirmText: 'Eliminar',
    });
    if (!ok) return;

    this.borrando.set(true);
    try {
      await this.projectsSvc.archivar(p.id);
      this.toast.success('Proyecto eliminado');
      this.eliminado.emit(p.id);
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo eliminar el proyecto.'));
    } finally {
      this.borrando.set(false);
    }
  }

  protected alCerrar(): void {
    this.cerrar.emit();
  }

  /** Escape cierra: es lo que espera cualquiera con un panel abierto. */
  protected teclado(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.alCerrar();
    }
  }
}
