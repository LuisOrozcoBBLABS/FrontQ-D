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
 * - **Lo que estás mirando no cambia solo.** Si lo elegido no está en la lista
 *   vigente —cambiaste de página, o un filtro lo dejó afuera— se sigue
 *   mostrando igual. Antes se caía al primero de la lista, así que pasar de la
 *   página 1 a la 2 te cambiaba el proyecto que estabas leyendo sin que tocaras
 *   nada. La selección solo cambia cuando alguien elige.
 * - **El detalle no arranca vacío.** Mientras nadie haya elegido, vale el
 *   primero. Ese caso —`id` en `null`— es distinto de «eligió y no está acá», y
 *   confundirlos era exactamente el bug de arriba.
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

  /**
   * Última versión conocida de lo elegido.
   *
   * Hace falta porque `lista` es solo la página vigente: cuando se pagina, lo
   * elegido deja de estar ahí y sin esto no habría de dónde sacarlo. Guardar el
   * objeto NO reemplaza a guardar el id — el id sigue siendo la identidad, y la
   * lista sigue ganando cuando lo contiene, para que una edición se vea. Esto es
   * el respaldo para cuando no lo contiene.
   */
  const ultimoVisto = signal<T | null>(null);

  const actual = computed<T | null>(() => {
    const items = lista();
    const elegido = id();

    // Nadie eligió todavía: vale el primero, para que el detalle no arranque
    // vacío. Este caso es el único donde la lista manda sobre la selección.
    if (elegido === null) return items[0] ?? null;

    // Está en la lista: gana la versión de la lista, que es la fresca.
    const enLista = items.find(x => x.id === elegido);
    if (enLista) return enLista;

    // Eligió, y lo elegido no está en esta página. SE MANTIENE.
    //
    // Acá estaba el bug: antes esto devolvía items[0], así que cambiar de página
    // mientras leías un proyecto te ponía otro delante. La selección es una
    // decisión de quien usa la aplicación; paginar es mirar otra parte de la
    // lista, no elegir de nuevo.
    return ultimoVisto();
  });

  /** Elegir es lo único que cambia la selección, y actualiza las dos señales. */
  const elegir = (item: T): void => {
    id.set(item.id);
    ultimoVisto.set(item);
  };

  return {
    id,
    actual,
    seleccionar: elegir,
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
      elegir(destino);

      document
        .getElementById(`${prefijoDom}-${destino.id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}
