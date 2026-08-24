import { Component, computed, input, output } from '@angular/core';
import { Paginator, PaginatorState } from 'primeng/paginator';

/** Cuántas filas por página en toda la plataforma. */
export const FILAS_POR_PAGINA = 8;

/**
 * Paginador de tabla.
 *
 * Por dentro es el <p-paginator> de PrimeNG; por fuera mantiene la misma API
 * que ya usaban las cuatro pantallas con tabla (`[pagina]` empieza en 1, y
 * `cambia` emite el número de página, no el índice del primer registro). Esa
 * traducción se hace acá una vez y no en cada pantalla.
 */
@Component({
  selector: 'app-paginador',
  imports: [Paginator],
  template: `
    @if (total() > porPagina()) {
      <p-paginator
        [first]="primero()"
        [rows]="porPagina()"
        [totalRecords]="total()"
        [showFirstLastIcon]="paginas() > 5"
        [currentPageReportTemplate]="'{first}–{last} de {totalRecords} ' + etiqueta()"
        [showCurrentPageReport]="true"
        (onPageChange)="alCambiar($event)"
      />
    }
  `,
  styles: [`
    :host { display: block; }
    /* El informe de página se lee como dato, no como control. */
    ::ng-deep .p-paginator-current {
      font-family: var(--font-mono);
      font-size: 11.5px;
      letter-spacing: .06em;
      color: var(--text-dim);
      margin-right: auto;
    }
  `],
})
export class Paginador {
  /** Página actual, empezando en 1. */
  readonly pagina = input.required<number>();
  readonly total = input.required<number>();
  readonly porPagina = input<number>(FILAS_POR_PAGINA);
  /** Texto de lo que se está contando: "proyectos", "usuarios". */
  readonly etiqueta = input<string>('registros');

  readonly cambia = output<number>();

  protected paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));

  /** PrimeNG cuenta por índice del primer registro; la plataforma, por página. */
  protected primero = computed(() => (this.pagina() - 1) * this.porPagina());

  protected alCambiar(e: PaginatorState): void {
    const siguiente = Math.floor((e.first ?? 0) / (e.rows || this.porPagina())) + 1;
    if (siguiente !== this.pagina()) this.cambia.emit(siguiente);
  }
}
