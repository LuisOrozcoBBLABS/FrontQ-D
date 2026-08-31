import { Signal, computed, signal } from '@angular/core';

/**
 * Estado de selección de una vista maestro-detalle.
 *
 * Se extrae acá porque el comportamiento es idéntico en todos los módulos —
 * proyectos, usuarios, lo que venga— y son unas cuarenta líneas: repetirlas en
 * cada componente garantiza que con el tiempo cada uno se comporte distinto,
 * que es justo lo que rompe la sensación de una sola aplicación.
 *
 * Lo que resuelve, y que es fácil olvidar al escribirlo de nuevo:
 *
 * - **La columna de detalle nunca queda vacía** mientras haya lista. Si lo
 *   seleccionado desaparece —se filtró, se cambió de página, se eliminó— vale
 *   el primero de la lista, no `null`.
 * - **Guarda el id, no el objeto.** Los servicios reemplazan los objetos al
 *   refrescar, así que comparar por referencia perdería la selección en cada
 *   recarga.
 * - **Flechas arriba y abajo** recorren la lista. Para quien revisa treinta
 *   registros seguidos es la diferencia entre una herramienta y un obstáculo.
 */
export interface SeleccionMaestro<T> {
  /** Id seleccionado. Null = todavía no eligió nadie; vale el primero. */
  readonly id: ReturnType<typeof signal<string | null>>;
  /** El elemento vigente, o null si la lista está vacía. */
  readonly actual: Signal<T | null>;
  seleccionar(item: T): void;
  es(item: T): boolean;
  /** Mueve la selección `delta` posiciones y trae la fila a la vista. */
  mover(delta: number, evento: Event): void;
}

export function seleccionMaestro<T extends { id: string }>(
  lista: Signal<T[]>,
  /** Prefijo del id del elemento en el DOM, para poder desplazarlo a la vista. */
  prefijoDom = 'md',
): SeleccionMaestro<T> {
  const id = signal<string | null>(null);

  const actual = computed<T | null>(() => {
    const items = lista();
    if (!items.length) return null;
    const elegido = id();
    return items.find(x => x.id === elegido) ?? items[0];
  });

  return {
    id,
    actual,
    seleccionar(item: T): void {
      id.set(item.id);
    },
    es(item: T): boolean {
      return actual()?.id === item.id;
    },
    mover(delta: number, evento: Event): void {
      const items = lista();
      if (!items.length) return;
      // Sin esto la página también scrollea con las flechas.
      evento.preventDefault();

      const vigente = actual();
      const i = vigente ? items.findIndex(x => x.id === vigente.id) : -1;
      const siguiente = Math.min(items.length - 1, Math.max(0, i + delta));
      const destino = items[siguiente];
      id.set(destino.id);

      document
        .getElementById(`${prefijoDom}-${destino.id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}
