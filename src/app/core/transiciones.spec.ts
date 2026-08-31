import { AssignmentStatus } from './models';
import { SECUENCIA, SIGUIENTE, puedeIr, retrocesoDe } from './transiciones';

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

  it('deja reabrir lo completado, devolviendolo a en curso', () => {
    // Esto se rompio una vez al revés: se "corrigio" el front a
    // `completada: []` contra una copia local del backend que estaba
    // atrasada, y estas afirmaciones se dieron vuelta para acompañar el error.
    // El servidor SI permite reabrir (BackQ-D, commit 84831a2), asi que la
    // version correcta es esta.
    expect(puedeIr('completada', 'en-curso')).toBe(true);
    expect(retrocesoDe('completada')).toBe('en-curso');
  });

  it('reabrir no salta mas atras que en curso', () => {
    expect(puedeIr('completada', 'aceptada')).toBe(false);
    expect(puedeIr('completada', 'pendiente')).toBe(false);
  });

  it('todos los estados tienen salida: ninguno es final', () => {
    // Es el invariante que hace innecesaria una funcion `esFinal`. Si algun dia
    // el servidor cierra un estado, este test falla y avisa que hay que
    // reflejarlo acá.
    for (const estado of SECUENCIA) {
      const salidas = SECUENCIA.filter(otro => otro !== estado && puedeIr(estado, otro));
      expect(salidas.length).toBeGreaterThan(0);
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
