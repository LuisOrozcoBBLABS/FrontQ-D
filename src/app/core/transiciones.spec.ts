import { AssignmentStatus } from './models';
import { SECUENCIA, SIGUIENTE, esFinal, puedeIr, retrocesoDe } from './transiciones';

describe('máquina de estados de una asignación', () => {
  it('avanza un paso por vez', () => {
    expect(puedeIr('pendiente', 'aceptada')).toBe(true);
    expect(puedeIr('aceptada', 'en-curso')).toBe(true);
    expect(puedeIr('en-curso', 'completada')).toBe(true);
  });

  it('no deja saltarse pasos', () => {
    // Sin esto el historial deja de significar algo: una asignación podría
    // aparecer completada sin haberse empezado nunca.
    expect(puedeIr('pendiente', 'en-curso')).toBe(false);
    expect(puedeIr('pendiente', 'completada')).toBe(false);
    expect(puedeIr('aceptada', 'completada')).toBe(false);
  });

  it('permite volver un paso, salvo desde pendiente', () => {
    expect(retrocesoDe('aceptada')).toBe('pendiente');
    expect(retrocesoDe('en-curso')).toBe('aceptada');
    expect(retrocesoDe('pendiente')).toBeNull();
  });

  it('trata completada como estado final', () => {
    expect(esFinal('completada')).toBe(true);
    expect(retrocesoDe('completada')).toBeNull();
    for (const destino of SECUENCIA) {
      if (destino !== 'completada') expect(puedeIr('completada', destino)).toBe(false);
    }
  });

  it('acepta reenviar el mismo estado, igual que el servidor', () => {
    for (const estado of SECUENCIA) {
      expect(puedeIr(estado, estado)).toBe(true);
    }
  });

  it('el avance sugerido siempre es una transición válida', () => {
    for (const estado of SECUENCIA) {
      const paso = SIGUIENTE[estado as AssignmentStatus];
      if (paso) expect(puedeIr(estado, paso.estado)).toBe(true);
    }
  });

  it('la secuencia cubre los cuatro estados en orden', () => {
    expect(SECUENCIA).toEqual(['pendiente', 'aceptada', 'en-curso', 'completada']);
  });
});
