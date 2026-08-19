import { Component, computed, input, output } from '@angular/core';

/** Cuántas filas por página en toda la plataforma. */
export const FILAS_POR_PAGINA = 8;

/**
 * Paginador de tabla. Muestra los números de página con elipsis cuando son
 * muchas, para que la barra no crezca sin control: 1 … 4 5 6 … 20.
 */
@Component({
  selector: 'app-paginador',
  templateUrl: './paginador.html',
  styleUrl: './paginador.scss',
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

  protected desde = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * this.porPagina() + 1));
  protected hasta = computed(() => Math.min(this.pagina() * this.porPagina(), this.total()));

  /** null representa la elipsis. */
  protected numeros = computed<(number | null)[]>(() => {
    const total = this.paginas();
    const actual = this.pagina();

    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const lista: (number | null)[] = [1];
    const desde = Math.max(2, actual - 1);
    const hasta = Math.min(total - 1, actual + 1);

    if (desde > 2) lista.push(null);
    for (let i = desde; i <= hasta; i++) lista.push(i);
    if (hasta < total - 1) lista.push(null);

    lista.push(total);
    return lista;
  });

  protected ir(p: number): void {
    if (p < 1 || p > this.paginas() || p === this.pagina()) return;
    this.cambia.emit(p);
  }
}
