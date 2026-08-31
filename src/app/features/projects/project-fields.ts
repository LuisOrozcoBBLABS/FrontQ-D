import { Component, computed, inject, input, linkedSignal, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { BorradorProyecto, LIMITES } from '../../core/borrador-proyecto';
import { GroupsService } from '../../core/groups.service';
import { AppSimilar, SECTORES, TIPOS_PRESTACION, TipoPrestacion } from '../../core/models';

/**
 * Los campos de un proyecto, para que /documentos pueda mostrar el borrador que
 * propuso la IA con el marcado de procedencia y los topes del servidor.
 *
 * Es la ÚNICA copia de los campos de un proyecto. Hubo una segunda en
 * `project-form`, que se eliminó al pasar la creación a un modal: mientras
 * existieron las dos, cada etiqueta, cada placeholder y cada tope había que
 * tocarlos en los dos lados, y estaba escrito que iban a separarse. Si hace
 * falta un campo nuevo, va acá y lo ven los dos usos: `/documentos` y el modal.
 *
 * Lo usan con propósitos distintos —revisar lo que propuso la IA, y escribir o
 * editar a mano— y por eso el marcado de procedencia (`camposIA`) es una
 * entrada opcional: sin ella, el componente es un formulario común.
 */
@Component({
  selector: 'app-project-fields',
  imports: [FormsModule, ButtonModule, InputText, Textarea, Select, Tooltip],
  templateUrl: './project-fields.html',
  styleUrl: './project-fields.scss',
})
export class ProjectFields {
  private groupsSvc = inject(GroupsService);

  valor = model.required<BorradorProyecto>();

  /** Campos que propuso la IA. Vacío cuando la persona escribe desde cero. */
  camposIA = input<readonly string[]>([]);
  deshabilitado = input(false);

  protected grupos = this.groupsSvc.groups;
  protected limites = LIMITES;

  /** PrimeNG trabaja con listas de opciones, no con <option>. */
  protected readonly opcionesSector = SECTORES.map(x => ({ label: x, value: x }));

  /**
   * "Sin definir" es una opción de verdad y vale null: un proyecto puede no
   * estar clasificado todavía, y al editar tiene que poder volver a ese estado.
   */
  protected readonly opcionesPrestacion: { label: string; value: TipoPrestacion | null }[] = [
    { label: 'Sin definir', value: null },
    ...TIPOS_PRESTACION.map(t => ({ label: t.label, value: t.value })),
  ];
  protected opcionesGrupo = computed(() => [
    { label: 'Sin grupo', value: null as string | null },
    ...this.grupos().map(g => ({ label: `Grupo ${g.nombre}`, value: g.id as string | null })),
  ]);

  constructor() {
    void this.groupsSvc.load();
  }

  /**
   * Los campos propuestos por la IA que todavía nadie revisó.
   *
   * El badge se apaga en la primera edición del campo, y eso es a propósito: así
   * significa "todavía sin revisar" en vez de solo "vino de la IA", que es el
   * dato que le sirve a quien está corrigiendo.
   */
  private sinRevisar = linkedSignal<readonly string[], Set<string>>({
    source: this.camposIA,
    computation: campos => new Set(campos),
  });

  protected propuesto(campo: string): boolean {
    return this.sinRevisar().has(campo);
  }

  /** Actualiza un campo y marca ese campo como revisado. */
  protected patch<K extends keyof BorradorProyecto>(campo: K, val: BorradorProyecto[K]): void {
    this.valor.update(b => ({ ...b, [campo]: val }));

    if (this.sinRevisar().has(campo as string)) {
      this.sinRevisar.update(s => {
        const copia = new Set(s);
        copia.delete(campo as string);
        return copia;
      });
    }
  }

  /** Qué significa el tipo elegido, en una línea bajo el campo. */
  protected notaPrestacion(): string {
    const elegido = TIPOS_PRESTACION.find(t => t.value === this.valor().tipoPrestacion);
    return elegido?.nota ?? 'Talento es prestar gente; solución, entregar el producto.';
  }

  // ------------------------------------------------------------ similares
  protected addSimilar(): void {
    this.patch('similares', [...this.valor().similares, { name: '', url: '' }]);
  }

  protected removeSimilar(i: number): void {
    this.patch(
      'similares',
      this.valor().similares.filter((_, idx) => idx !== i),
    );
  }

  protected patchSimilar(i: number, key: keyof AppSimilar, val: string): void {
    this.patch(
      'similares',
      this.valor().similares.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)),
    );
  }

  // ------------------------------------------------------------ contadores
  /**
   * El contador aparece recién pasado el 80% del tope: mostrarlo siempre pone
   * cuatro cifras permanentes debajo de cuatro textareas, y eso es ruido.
   */
  protected cerca(valor: string, max: number): boolean {
    return valor.length > max * 0.8;
  }

  protected contador(valor: string, max: number): string {
    return `${valor.length} / ${max}`;
  }

  /** Cuántos campos siguen sin revisar: lo usa el padre para el resumen. */
  readonly pendientes = computed(() => this.sinRevisar().size);
}
