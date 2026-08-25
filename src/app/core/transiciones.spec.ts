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

  it('completada es final: no vuelve a ningún estado', () => {
    // Estas tres afirmaciones decían lo contrario y codificaban el error: el
    // servidor tiene `completada: []` y responde "ya está completada y no
    // admite más cambios", pero el front creía que se podía reabrir. Con eso,
    // la interfaz mostraba el botón de retroceso y dejaba arrastrar la tarjeta
    // para que el servidor rechazara las dos cosas.
    expect(puedeIr('completada', 'en-curso')).toBe(false);
    expect(puedeIr('completada', 'aceptada')).toBe(false);
    expect(puedeIr('completada', 'pendiente')).toBe(false);
    expect(retrocesoDe('completada')).toBeNull();
    expect(esFinal('completada')).toBe(true);
  });

  it('los demás estados NO son finales', () => {
    // esFinal() solo tiene sentido si alguno devuelve true y otros false.
    // Cuando la tabla del front le daba una transición a `completada`, la
    // función no podía devolver true nunca y el guardia que la usa era letra
    // muerta sin que nada lo dijera.
    expect(esFinal('pendiente')).toBe(false);
    expect(esFinal('aceptada')).toBe(false);
    expect(esFinal('en-curso')).toBe(false);
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
