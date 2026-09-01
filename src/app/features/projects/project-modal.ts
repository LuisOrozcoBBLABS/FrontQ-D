import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import {
  BorradorProyecto,
  aNuevoProyecto,
  borradorVacio,
  validarBorrador,
} from '../../core/borrador-proyecto';
import { Project } from '../../core/models';
import { ProjectsService } from '../../core/projects.service';
import { ToastService } from '../../core/toast.service';
import { ProjectFields } from './project-fields';

/**
 * Registrar o editar un proyecto, en un diálogo sobre la pantalla que ya estaba.
 *
 * Reemplaza a `project-form`, que era una ruta propia. El motivo del cambio es
 * de uso, no de estética: registrar una idea es una tarea corta que se hace
 * mirando la lista, y mandar a otra pantalla obligaba a perder de vista —y a
 * reconstruir al volver— el filtro, la página y la fila seleccionada.
 *
 * Los campos NO viven acá: son los de `app-project-fields`, los mismos que usa
 * `/documentos` para revisar lo que propuso la IA. Mientras hubo dos copias,
 * cada etiqueta y cada tope había que tocarlos dos veces; ahora se agrega un
 * campo en un solo lugar y aparece en los dos caminos que crean proyectos.
 *
 * Las reglas de guardado son las de `core/borrador-proyecto.ts`, ya probadas.
 * Al pasar por ahí, la creación a mano hereda el arreglo del filtro de
 * `similares`: el formulario viejo filtraba con OR (`name || url`) y el
 * servidor exige los dos, así que escribir el nombre de una app parecida y
 * dejar su URL vacía hacía fallar el POST entero con un 400 que no señalaba
 * ningún campo.
 */
@Component({
  selector: 'app-project-modal',
  imports: [Dialog, ButtonModule, ProjectFields],
  templateUrl: './project-modal.html',
  styleUrl: './project-modal.scss',
})
export class ProjectModal {
  private projectsSvc = inject(ProjectsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  /** Lo controla quien lo monta, que lo abre desde el query param de la ruta. */
  readonly abierto = model.required<boolean>();
  /** Proyecto a editar. Vacío o null = uno nuevo. */
  readonly id = input<string | null>(null);
  /** Sale con el proyecto ya guardado, por si quien mira quiere hacer algo con él. */
  readonly guardado = output<Project>();

  protected borrador = signal<BorradorProyecto>(borradorVacio());
  protected error = signal<string | null>(null);
  protected cargando = signal(false);
  protected guardando = signal(false);

  protected readonly editando = computed(() => !!this.id());
  protected titulo = computed(() => (this.editando() ? 'Editar el proyecto' : 'Registrar un proyecto'));
  protected verbo = computed(() => (this.editando() ? 'Guardar cambios' : 'Registrar el proyecto'));

  constructor() {
    // Se prepara al abrir y no al construir: el modal está montado todo el
    // tiempo detrás de la pantalla, así que el contenido tiene que armarse en
    // el momento en que se muestra o quedaría el borrador de la vez anterior.
    effect(() => {
      if (!this.abierto()) return;
      void this.preparar();
    });
  }

  private async preparar(): Promise<void> {
    this.error.set(null);
    const id = this.id();

    if (!id) {
      // El servidor valida el permiso igual; esto evita ofrecer un formulario
      // cuyo POST va a devolver 403.
      if (!this.auth.can('projects.create')) {
        this.toast.error('No tenés permiso para registrar proyectos.');
        this.cerrar();
        return;
      }
      this.borrador.set(borradorVacio(this.auth.currentUser()?.groupId ?? null));
      return;
    }

    this.cargando.set(true);
    const p = await this.projectsSvc.fetchOne(id);
    this.cargando.set(false);

    if (!p) {
      this.toast.error('No se encontró el proyecto.');
      this.cerrar();
      return;
    }
    // Misma regla que aplica el servidor (autor o administrador). Se repite acá
    // para no dejar llenar un formulario que el PATCH va a rechazar.
    if (!this.auth.esAutorOAdmin(p.autorId)) {
      this.toast.error('Solo quien lo registró puede editarlo.');
      this.cerrar();
      return;
    }

    this.borrador.set({
      nombre: p.nombre,
      sector: p.sector,
      // El servidor manda null cuando no hay cliente; el formulario trabaja con
      // cadena vacía, que es lo que un input puede mostrar.
      cliente: p.cliente ?? '',
      tipoPrestacion: p.tipoPrestacion,
      problema: p.problema,
      dolores: p.dolores,
      solucion: p.solucion,
      plusIA: p.plusIA,
      // Siempre una fila vacía al final, para agregar sin un clic extra.
      similares: p.similares.length ? [...p.similares] : [{ name: '', url: '' }],
      groupId: p.groupId ?? null,
    });
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;

    const problema = validarBorrador(this.borrador());
    if (problema) {
      this.error.set(problema);
      return;
    }
    this.error.set(null);

    // `aNuevoProyecto` incluye `estado: 'idea'`, que sirve al crear y estorba al
    // editar: mandarlo pisaría la etapa del tablero y dejaría una entrada falsa
    // en el historial de etapas. Por eso se separa en lugar de omitirlo allá.
    const { estado, ...datos } = aNuevoProyecto(this.borrador());
    const id = this.id();

    this.guardando.set(true);
    try {
      const p = id
        ? // Al editar, `cliente` viaja SIEMPRE, aunque esté vacío. `aNuevoProyecto`
          // omite la clave cuando no hay cliente, y eso es correcto para el alta
          // —"sin cliente" tiene una sola representación— pero al editar una
          // clave ausente no borra nada: sin esto, un proyecto al que le sacan el
          // cliente se guardaría con el cliente viejo. El servidor traduce la
          // cadena vacía a null (`dto.cliente.trim() || null`).
          await this.projectsSvc.update(id, { ...datos, cliente: this.borrador().cliente.trim() })
        : await this.projectsSvc.create({ ...datos, estado });

      this.toast.success(id ? 'Cambios guardados' : 'Proyecto creado');
      // La pantalla de atrás se refresca con sus propios filtros y su página:
      // sin esto el proyecto nuevo no aparece hasta recargar.
      await this.projectsSvc.recargar();
      this.guardado.emit(p);
      this.cerrarYa();
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo guardar el proyecto.'));
    } finally {
      this.guardando.set(false);
    }
  }

  /** p-dialog avisa el cierre por Escape o por clic en el fondo. */
  protected alCambiarVisible(abierto: boolean): void {
    if (!abierto) this.cerrar();
  }

  /**
   * Cierre pedido por la persona: el botón Cancelar, Escape o el clic en el
   * fondo. A mitad de un guardado no se atiende, para no dejar la pantalla sin
   * saber si el proyecto quedó registrado.
   */
  protected cerrar(): void {
    if (this.guardando()) return;
    this.cerrarYa();
  }

  /**
   * Cierre incondicional. Existe separado de `cerrar()` y no es un detalle:
   * cuando los dos eran el mismo método, guardar dejaba el modal abierto. El
   * cierre del final de `guardar()` ocurre DENTRO del try, con `guardando`
   * todavía en true —se apaga en el `finally`, que corre después—, así que el
   * guard de "no cerrar a mitad de un guardado" se comía el cierre del
   * guardado que sí había terminado bien.
   */
  private cerrarYa(): void {
    this.abierto.set(false);
    this.error.set(null);
  }
}
