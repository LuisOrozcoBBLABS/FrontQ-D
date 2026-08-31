import { ETAPAS, etapaVecina } from './models';

/**
 * `etapaVecina` es la única parte del movimiento por teclado del tablero con
 * casos de borde de verdad. Se testea acá, como función pura, porque el resto
 * —permiso, llamada al servidor, anuncio— ya está cubierto por el tipo o
 * necesitaría simular media aplicación para probar tres condiciones.
 */
describe('etapa vecina en el orden del tablero', () => {
  it('avanza y retrocede una columna', () => {
    expect(etapaVecina('idea', 1)).toBe('evaluacion');
    expect(etapaVecina('evaluacion', -1)).toBe('idea');
    expect(etapaVecina('desarrollo', 1)).toBe('code_review_qa');
    expect(etapaVecina('code_review_qa', -1)).toBe('desarrollo');
  });

  it('devuelve null en los extremos, en vez de dar la vuelta', () => {
    // Sin esto, Ctrl+flecha izquierda en la primera columna mandaría la tarjeta
    // a "descartado", que es la última: un descarte accidental de un tecleo.
    expect(etapaVecina(ETAPAS[0].value, -1)).toBeNull();
    expect(etapaVecina(ETAPAS[ETAPAS.length - 1].value, 1)).toBeNull();
  });

  it('cruza las fases del embudo sin saltarse ninguna etapa', () => {
    // aprobado es la última del embudo y analisis_diseno la primera de
    // desarrollo: la banda de fases agrupa visualmente, no interrumpe el flujo.
    expect(etapaVecina('aprobado', 1)).toBe('analisis_diseno');
    expect(etapaVecina('analisis_diseno', -1)).toBe('aprobado');
  });

  it('recorre las diez etapas de punta a punta', () => {
    let actual = ETAPAS[0].value;
    const recorrido = [actual];
    for (;;) {
      const siguiente = etapaVecina(actual, 1);
      if (!siguiente) break;
      actual = siguiente;
      recorrido.push(actual);
    }
    expect(recorrido).toHaveLength(ETAPAS.length);
    expect(recorrido).toEqual(ETAPAS.map(e => e.value));
  });

  it('devuelve null con un estado que no está en el tablero', () => {
    // Defensa contra un enum del servidor que crezca sin que el front se entere.
    expect(etapaVecina('inventado' as never, 1)).toBeNull();
  });
});
