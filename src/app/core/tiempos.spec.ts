import { describe, expect, it } from 'vitest';
import { CambioEstado, Project, ProjectStatus } from './models';
import {
  alertaEtapa,
  diasEnEtapa,
  diasEnEtapas,
  diasTotales,
  entradaAEtapaActual,
  humano,
  tramos,
} from './tiempos';

const AHORA = new Date('2026-08-20T12:00:00.000Z');

function dia(n: number): string {
  return new Date(AHORA.getTime() - n * 86_400_000).toISOString();
}

function proyecto(estado: ProjectStatus, historial: CambioEstado[], createdAt = dia(30)): Project {
  return {
    id: 'p1',
    nombre: 'Proyecto',
    sector: 'Logística',
    problema: '',
    dolores: '',
    solucion: '',
    similares: [],
    plusIA: '',
    grupo: null,
    autorId: 'u1',
    estado,
    createdAt,
    historial,
  };
}

function cambio(estado: ProjectStatus, hace: number, anterior: ProjectStatus | null = null): CambioEstado {
  return { estado, anterior, createdAt: dia(hace) };
}

describe('entradaAEtapaActual', () => {
  it('toma la última entrada que coincide con el estado actual', () => {
    const p = proyecto('desarrollo', [
      cambio('idea', 30),
      cambio('desarrollo', 20, 'idea'),
      cambio('code_review_qa', 10, 'desarrollo'),
      cambio('desarrollo', 4, 'code_review_qa'), // volvió: vale esta
    ]);
    expect(entradaAEtapaActual(p)).toBe(dia(4));
  });

  it('devuelve null si el historial no menciona el estado actual', () => {
    const p = proyecto('uat', [cambio('idea', 10)]);
    expect(entradaAEtapaActual(p)).toBeNull();
  });

  it('devuelve null con historial vacío', () => {
    expect(entradaAEtapaActual(proyecto('idea', []))).toBeNull();
  });
});

describe('diasEnEtapa', () => {
  it('cuenta los días desde que entró a la etapa', () => {
    const p = proyecto('desarrollo', [cambio('desarrollo', 7)]);
    expect(diasEnEtapa(p, AHORA)).toBe(7);
  });

  it('sin historial devuelve null, no cero', () => {
    expect(diasEnEtapa(proyecto('desarrollo', []), AHORA)).toBeNull();
  });

  it('una fecha inválida no rompe el cálculo', () => {
    const p = proyecto('desarrollo', [{ estado: 'desarrollo', anterior: null, createdAt: 'no-es-fecha' }]);
    expect(diasEnEtapa(p, AHORA)).toBeNull();
  });

  it('una fecha futura da cero, nunca negativo', () => {
    const futuro = new Date(AHORA.getTime() + 5 * 86_400_000).toISOString();
    const p = proyecto('desarrollo', [{ estado: 'desarrollo', anterior: null, createdAt: futuro }]);
    expect(diasEnEtapa(p, AHORA)).toBe(0);
  });
});

describe('diasTotales', () => {
  it('cuenta desde la creación, no desde la primera etapa registrada', () => {
    const p = proyecto('desarrollo', [cambio('desarrollo', 3)], dia(60));
    expect(diasTotales(p, AHORA)).toBe(60);
  });

  it('sin fecha de creación devuelve null', () => {
    const p = proyecto('idea', [], '');
    expect(diasTotales(p, AHORA)).toBeNull();
  });
});

describe('tramos', () => {
  it('cada etapa dura hasta la siguiente y la última sigue en curso', () => {
    const t = tramos([cambio('idea', 30), cambio('desarrollo', 20, 'idea'), cambio('uat', 5, 'desarrollo')], AHORA);
    expect(t.map(x => x.dias)).toEqual([10, 15, 5]);
    expect(t.map(x => x.enCurso)).toEqual([false, false, true]);
    expect(t[2].hasta).toBeNull();
  });

  it('ordena el historial aunque venga desordenado', () => {
    const t = tramos([cambio('uat', 5, 'desarrollo'), cambio('idea', 30)], AHORA);
    expect(t.map(x => x.estado)).toEqual(['idea', 'uat']);
  });

  it('separa los tramos cuando el proyecto vuelve a una etapa', () => {
    const t = tramos([cambio('desarrollo', 20), cambio('code_review_qa', 12, 'desarrollo'), cambio('desarrollo', 6, 'code_review_qa')], AHORA);
    expect(t.filter(x => x.estado === 'desarrollo')).toHaveLength(2);
    expect(t.map(x => x.dias)).toEqual([8, 6, 6]);
  });

  it('descarta las entradas con fecha inválida sin tirar el resto', () => {
    const t = tramos(
      [cambio('idea', 10), { estado: 'uat', anterior: 'idea', createdAt: 'roto' }],
      AHORA,
    );
    expect(t).toHaveLength(1);
    expect(t[0].estado).toBe('idea');
  });

  it('historial vacío o ausente da lista vacía', () => {
    expect(tramos([], AHORA)).toEqual([]);
    expect(tramos(undefined, AHORA)).toEqual([]);
  });
});

describe('diasEnEtapas', () => {
  it('suma los tramos', () => {
    expect(diasEnEtapas([cambio('idea', 30), cambio('desarrollo', 20, 'idea')], AHORA)).toBe(30);
  });

  it('sin historial devuelve null, para poder distinguirlo de cero', () => {
    expect(diasEnEtapas([], AHORA)).toBeNull();
  });
});

describe('alertaEtapa', () => {
  it('marca demorado cuando pasa el límite de la etapa', () => {
    // Code review tolera 7 días.
    expect(alertaEtapa(proyecto('code_review_qa', [cambio('code_review_qa', 9)]), AHORA)).toBe('demorado');
  });

  it('avisa antes de pasarse', () => {
    expect(alertaEtapa(proyecto('code_review_qa', [cambio('code_review_qa', 6)]), AHORA)).toBe('atencion');
  });

  it('los mismos días en desarrollo no son problema', () => {
    expect(alertaEtapa(proyecto('desarrollo', [cambio('desarrollo', 9)]), AHORA)).toBe('normal');
  });

  it('sin dato de etapa no inventa una alerta', () => {
    expect(alertaEtapa(proyecto('code_review_qa', []), AHORA)).toBe('normal');
  });

  it('las etapas sin límite nunca alertan', () => {
    expect(alertaEtapa(proyecto('produccion', [cambio('produccion', 400)]), AHORA)).toBe('normal');
  });
});

describe('humano', () => {
  it('traduce los casos de borde', () => {
    expect(humano(null)).toBe('—');
    expect(humano(0)).toBe('hoy');
    expect(humano(1)).toBe('1 día');
    expect(humano(12)).toBe('12 días');
    expect(humano(60)).toBe('2 meses');
  });
});
