import { Component, computed, input } from '@angular/core';

/**
 * Convierte una serie en los puntos de una polilínea SVG.
 *
 * Trabaja en un sistema de coordenadas fijo (100 x 24) y el SVG se estira con
 * `preserveAspectRatio="none"`: así la misma serie sirve para una tarjeta
 * angosta o ancha sin recalcular nada.
 *
 * Devuelve null cuando no hay con qué dibujar una línea —menos de dos puntos, o
 * una serie plana— porque en esos casos una línea recta transmitiría una
 * tendencia que no existe. Es mejor mostrar un guion.
 */
export function puntosSparkline(valores: number[], ancho = 100, alto = 24): string | null {
  const limpios = valores.filter(v => Number.isFinite(v));
  if (limpios.length < 2) return null;

  const min = Math.min(...limpios);
  const max = Math.max(...limpios);
  const rango = max - min;
  if (rango === 0) return null;

  const paso = ancho / (limpios.length - 1);
  return limpios
    .map((v, i) => {
      const x = i * paso;
      // El eje Y del SVG crece hacia abajo, de ahí el (1 - ...).
      const y = (1 - (v - min) / rango) * alto;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Gráfico de firma: la forma de una serie, sin ejes ni etiquetas. Acompaña a una
 * cifra para contestar "¿cómo veníamos?", no para leer valores concretos.
 *
 * Es SVG inline a propósito: no hace falta un motor de gráficos para esto, y
 * PrimeNG 21 ya no trae componente de charts.
 */
@Component({
  selector: 'app-sparkline',
  template: `
    @if (puntos(); as p) {
      <svg
        class="spark"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="etiqueta()"
      >
        <polyline
          [attr.points]="p"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    } @else {
      <span class="spark__vacio" aria-hidden="true">—</span>
    }
  `,
  styles: `
    :host { display: block; }
    .spark { width: 100%; height: 24px; opacity: .85; }
    .spark__vacio { color: var(--text-dim); font-size: var(--fs-xs); }
  `,
})
export class Sparkline {
  readonly valores = input.required<number[]>();
  /**
   * Qué dice la serie, en palabras. Un sparkline transmite información y sin
   * etiqueta es invisible para un lector de pantalla. Que diga la conclusión,
   * no la lista de números.
   */
  readonly etiqueta = input<string>('Tendencia');

  protected puntos = computed(() => puntosSparkline(this.valores()));
}
