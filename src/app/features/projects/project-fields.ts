import { Component, computed, inject, input, linkedSignal, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BorradorProyecto, LIMITES } from '../../core/borrador-proyecto';
import { GroupsService } from '../../core/groups.service';
import { AppSimilar, SECTORES } from '../../core/models';

/**
 * Los campos de un proyecto, compartidos por las dos formas de crearlo:
 * escribirlos a mano en /proyectos/nuevo, o corregir lo que propuso la IA en
 * /documentos. Un solo lugar donde arreglar los `maxlength` que faltaban y donde
 * viven las etiquetas y los placeholders.
 *
 * El padre lo ata con `[(valor)]="borrador"`; este componente no guarda nada ni
 * conoce la API.
 */
@Component({
  selector: 'app-project-fields',
  imports: [FormsModule],
  templateUrl: './project-fields.html',
  styleUrl: './project-fields.scss',
})
export class ProjectFields {
  private groupsSvc = inject(GroupsService);

  valor = model.required<BorradorProyecto>();

  /** Campos que propuso la IA. Vacío cuando la persona escribe desde cero. */
  camposIA = input<readonly string[]>([]);
  deshabilitado = input(false);

  protected sectores = SECTORES;
  protected grupos = this.groupsSvc.groups;
  protected limites = LIMITES;

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
