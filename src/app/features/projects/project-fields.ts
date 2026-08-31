import { Component, computed, inject, input, linkedSignal, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { BorradorProyecto, LIMITES } from '../../core/borrador-proyecto';
import { GroupsService } from '../../core/groups.service';
import { AppSimilar, SECTORES } from '../../core/models';

/**
 * Los campos de un proyecto, para que /documentos pueda mostrar el borrador que
 * propuso la IA con el marcado de procedencia y los topes del servidor.
 *
 * OJO — duplicación conocida: `project-form` tiene su propia copia de estos
 * campos. Se dejó así a propósito al integrar el módulo de IA, para no volver a
 * reescribir un formulario que se acababa de rehacer sobre PrimeNG y que además
 * maneja el modo edición. Si se toca un campo (una etiqueta, un placeholder, un
 * tope), hay que tocarlo en los dos lados hasta que alguien los unifique.
 *
 * Los controles siguen los mismos patrones que `project-form.html`: pInputText,
 * p-select con opciones, pTextarea con autoResize y p-button.
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
