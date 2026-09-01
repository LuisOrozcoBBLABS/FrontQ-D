import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { seleccionMaestro } from './seleccion-maestro';

interface Fila {
  id: string;
  nombre: string;
}

const PAGINA_1: Fila[] = [
  { id: 'p1', nombre: 'Reportería de sprints' },
  { id: 'p2', nombre: 'Deuda técnica' },
  { id: 'p3', nombre: 'Automatización de QA' },
];
const PAGINA_2: Fila[] = [
  { id: 'p4', nombre: 'Mantenibilidad' },
  { id: 'p5', nombre: 'Variantes por cliente' },
];

function armar(inicial: Fila[] = PAGINA_1) {
  const lista = signal<Fila[]>(inicial);
  return { lista, sel: seleccionMaestro<Fila>(lista, 'mp') };
}

describe('seleccionMaestro', () => {
  describe('lo que se está mirando no cambia solo', () => {
    it('al cambiar de página, el elegido SE MANTIENE', () => {
      // El bug reportado: estabas leyendo un proyecto, pasabas a la página 2 y
      // el detalle te mostraba otro sin que hubieras tocado nada.
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[1]);
      expect(sel.actual()?.id).toBe('p2');

      lista.set(PAGINA_2); // paginar

      expect(sel.actual()?.id).toBe('p2');
      expect(sel.actual()?.nombre).toBe('Deuda técnica');
    });

    it('vuelve a la página de origen y sigue siendo el mismo', () => {
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[2]);
      lista.set(PAGINA_2);
      lista.set(PAGINA_1);
      expect(sel.actual()?.id).toBe('p3');
    });

    it('un filtro que deja afuera al elegido tampoco lo cambia', () => {
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      lista.set([PAGINA_1[1], PAGINA_1[2]]);
      expect(sel.actual()?.id).toBe('p1');
    });

    it('solo cambia cuando alguien elige', () => {
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      lista.set(PAGINA_2);
      expect(sel.actual()?.id).toBe('p1');

      sel.seleccionar(PAGINA_2[1]); // ahora sí, un clic
      expect(sel.actual()?.id).toBe('p5');
    });
  });

  describe('el detalle no arranca vacío', () => {
    it('sin elección previa vale el primero', () => {
      const { sel } = armar();
      expect(sel.actual()?.id).toBe('p1');
    });

    it('sin elección previa, paginar SÍ mueve al primero de la página nueva', () => {
      // Este caso es el que se confundía con el anterior. Mientras nadie eligió,
      // la lista manda; en cuanto alguien elige, manda la elección.
      const { lista, sel } = armar();
      lista.set(PAGINA_2);
      expect(sel.actual()?.id).toBe('p4');
    });

    it('con la lista vacía y sin elección, es null', () => {
      const { sel } = armar([]);
      expect(sel.actual()).toBeNull();
    });

    it('poner el id en null vuelve al primero, y no resucita lo anterior', () => {
      // Es lo que hace la plantilla al eliminar: (eliminado)="sel.id.set(null)".
      // Si el respaldo ganara acá, seguiría mostrando algo que ya no existe.
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[1]);
      lista.set([PAGINA_1[0], PAGINA_1[2]]); // p2 eliminado
      sel.id.set(null);
      expect(sel.actual()?.id).toBe('p1');
    });
  });

  describe('la lista gana cuando contiene lo elegido', () => {
    it('una edición se ve, en vez de quedar congelada en el respaldo', () => {
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      lista.set([{ id: 'p1', nombre: 'Nombre editado' }, ...PAGINA_1.slice(1)]);
      expect(sel.actual()?.nombre).toBe('Nombre editado');
    });
  });

  describe('es(): marca la fila vigente', () => {
    it('marca la elegida y ninguna otra', () => {
      const { sel } = armar();
      sel.seleccionar(PAGINA_1[1]);
      expect(sel.es(PAGINA_1[1])).toBe(true);
      expect(sel.es(PAGINA_1[0])).toBe(false);
    });

    it('con el elegido fuera de la página, NINGUNA fila queda marcada', () => {
      // Coherente con lo que se ve: el detalle muestra algo que no está en esta
      // lista, así que resaltar una fila cualquiera sería mentir.
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      lista.set(PAGINA_2);
      expect(PAGINA_2.some(f => sel.es(f))).toBe(false);
    });
  });

  describe('mover(): flechas arriba y abajo', () => {
    const evento = (): Event => ({ preventDefault: () => undefined }) as Event;

    it('avanza y retrocede dentro de la lista', () => {
      const { sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      sel.mover(1, evento());
      expect(sel.actual()?.id).toBe('p2');
      sel.mover(-1, evento());
      expect(sel.actual()?.id).toBe('p1');
    });

    it('no se sale por ninguno de los dos extremos', () => {
      const { sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      sel.mover(-1, evento());
      expect(sel.actual()?.id).toBe('p1');
      sel.seleccionar(PAGINA_1[2]);
      sel.mover(1, evento());
      expect(sel.actual()?.id).toBe('p3');
    });

    it('con el elegido fuera de la página, la flecha aterriza en la página vigente', () => {
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      lista.set(PAGINA_2);
      sel.mover(1, evento());
      expect(sel.actual()?.id).toBe('p4');
    });

    it('mover también actualiza el respaldo, así que sobrevive a paginar', () => {
      const { lista, sel } = armar();
      sel.seleccionar(PAGINA_1[0]);
      sel.mover(1, evento()); // queda en p2
      lista.set(PAGINA_2);
      expect(sel.actual()?.id).toBe('p2');
    });

    it('con la lista vacía no hace nada', () => {
      const { sel } = armar([]);
      sel.mover(1, evento());
      expect(sel.actual()).toBeNull();
    });
  });
});
