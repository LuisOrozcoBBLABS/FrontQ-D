import { CambioEstado, Project, ProjectStatus, etapaDe } from './models';

/**
 * Cálculo de tiempos del tablero. Vive aparte porque son funciones puras: se
 * pueden probar sin montar componentes, y el tablero y el panel de detalle usan
 * exactamente las mismas.
 *
 * Regla de oro: cuando falta un dato se devuelve `null`, nunca 0 ni NaN. Un
 * cero diría "lleva cero días acá", que es una afirmación distinta de "no sé
 * cuánto lleva", y en un tablero de tiempos esa diferencia importa.
 */

const MS_POR_DIA = 86_400_000;

/** Milisegundos entre dos instantes, o null si alguna fecha no sirve. */
function distancia(desde: string | Date | null | undefined, hasta: Date): number | null {
  if (!desde) return null;
  const t = desde instanceof Date ? desde.getTime() : Date.parse(desde);
  if (Number.isNaN(t)) return null;
  // Una fecha futura no es un tiempo transcurrido: se trata como cero, no como
  // un negativo que se vería como "-3 días en la etapa".
  return Math.max(0, hasta.getTime() - t);
}

/** Días completos transcurridos desde una fecha. Null si no hay fecha válida. */
export function diasDesde(iso: string | null | undefined, ahora = new Date()): number | null {
  const ms = distancia(iso, ahora);
  return ms === null ? null : Math.floor(ms / MS_POR_DIA);
}

/**
 * Cuándo entró el proyecto a la etapa en la que está hoy. Toma la última
 * entrada del historial que coincida con el estado actual: si el historial
 * viene recortado a un solo elemento (como en las listas) igual funciona.
 */
export function entradaAEtapaActual(p: Project): string | null {
  const historial = p.historial ?? [];
  for (let i = historial.length - 1; i >= 0; i--) {
    if (historial[i].estado === p.estado) return historial[i].createdAt;
  }
  return null;
}

/** Días en la etapa actual. Null si no hay historial que lo respalde. */
export function diasEnEtapa(p: Project, ahora = new Date()): number | null {
  return diasDesde(entradaAEtapaActual(p), ahora);
}

/**
 * Tiempo total de punta a punta. Se cuenta desde la creación del proyecto, que
 * siempre existe, y no desde la primera entrada del historial: así los
 * proyectos viejos sin historial completo igual tienen un total real.
 */
export function diasTotales(p: Project, ahora = new Date()): number | null {
  return diasDesde(p.createdAt, ahora);
}

export interface TramoEtapa {
  estado: ProjectStatus;
  etiqueta: string;
  desde: string;
  /** Null en la etapa actual: todavía no terminó. */
  hasta: string | null;
  dias: number;
  enCurso: boolean;
}

/**
 * Descompone el historial en tramos con su duración. Cada entrada dura hasta la
 * siguiente; la última dura hasta ahora.
 *
 * Si el mismo estado aparece dos veces (un proyecto que volvió a desarrollo),
 * salen dos tramos separados: agruparlos escondería el reproceso, que es
 * justamente lo que un tablero de tiempos tiene que dejar ver.
 */
export function tramos(historial: CambioEstado[] | undefined, ahora = new Date()): TramoEtapa[] {
  const orden = [...(historial ?? [])]
    .filter(c => !Number.isNaN(Date.parse(c.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return orden.map((c, i) => {
    const siguiente = orden[i + 1];
    const fin = siguiente ? new Date(Date.parse(siguiente.createdAt)) : ahora;
    const ms = Math.max(0, fin.getTime() - Date.parse(c.createdAt));
    return {
      estado: c.estado,
      etiqueta: etapaDe(c.estado).label,
      desde: c.createdAt,
      hasta: siguiente ? siguiente.createdAt : null,
      dias: Math.floor(ms / MS_POR_DIA),
      enCurso: !siguiente,
    };
  });
}

/**
 * Suma de los tramos: cuánto tiempo pasó realmente dentro de etapas. Puede ser
 * menor que el total de punta a punta, porque el proyecto pudo existir antes de
 * que se registrara su primera etapa.
 */
export function diasEnEtapas(historial: CambioEstado[] | undefined, ahora = new Date()): number | null {
  const lista = tramos(historial, ahora);
  return lista.length ? lista.reduce((suma, t) => suma + t.dias, 0) : null;
}

/** Duración en lenguaje humano. "—" cuando no hay dato, sin inventar. */
export function humano(dias: number | null): string {
  if (dias === null) return '—';
  if (dias === 0) return 'hoy';
  if (dias === 1) return '1 día';
  if (dias < 31) return `${dias} días`;
  const meses = Math.floor(dias / 30);
  const resto = dias % 30;
  if (meses === 1) return resto >= 7 ? `1 mes y ${Math.floor(resto / 7)} sem` : '1 mes';
  return `${meses} meses`;
}

/** Versión corta para la tarjeta compacta, donde el espacio es poco. */
export function humanoCorto(dias: number | null): string {
  if (dias === null) return '—';
  if (dias === 0) return 'hoy';
  if (dias < 31) return `${dias}d`;
  return `${Math.floor(dias / 30)}m`;
}

/**
 * Semáforo del tiempo en etapa. Los umbrales son de la etapa, no del proyecto:
 * dos semanas en revisión de código es tarde, dos semanas en desarrollo no.
 */
const LIMITE_DIAS: Partial<Record<ProjectStatus, number>> = {
  evaluacion: 14,
  analisis_diseno: 21,
  desarrollo: 45,
  code_review_qa: 7,
  uat: 14,
  listo_despliegue: 5,
};

export type Alerta = 'normal' | 'atencion' | 'demorado';

export function alertaEtapa(p: Project, ahora = new Date()): Alerta {
  const limite = LIMITE_DIAS[p.estado];
  const dias = diasEnEtapa(p, ahora);
  if (limite === undefined || dias === null) return 'normal';
  if (dias > limite) return 'demorado';
  if (dias > limite * 0.7) return 'atencion';
  return 'normal';
}

/** Texto del tooltip: explica por qué la tarjeta está marcada. */
export function motivoAlerta(p: Project, ahora = new Date()): string | null {
  const limite = LIMITE_DIAS[p.estado];
  const dias = diasEnEtapa(p, ahora);
  if (limite === undefined || dias === null || dias <= limite * 0.7) return null;
  return `${humano(dias)} en ${etapaDe(p.estado).label.toLowerCase()}; lo esperado es hasta ${limite} días.`;
}

/**
 * Fecha corta y en español: "30 sept 2026".
 *
 * Tres decisiones, y las tres se tomaron midiendo:
 *
 * 1. NO se usa el pipe `date` de Angular. El proyecto no registra ningún
 *    locale, así que ese pipe cae en `en-US` y devuelve "30 Sep 2026" — meses
 *    en inglés dentro de una interfaz que está toda en español.
 *
 * 2. `timeZone: 'UTC'`, y esto es lo importante. Sin eso, una fecha que llega
 *    como "2026-09-30T00:00:00Z" se muestra como 29 de septiembre en Colombia
 *    (UTC-5): la medianoche UTC es la tarde del día anterior acá. Una fecha
 *    límite corrida un día es peor que no mostrarla. Se interpreta como fecha
 *    de calendario, no como instante.
 *
 * 3. `es-ES` y no `es-CO`. Con es-CO, Intl devuelve "30 de sept de 2026": los
 *    "de" sobran en una columna de datos donde lo que se compara es el número.
 *
 * Devuelve null y no una cadena vacía cuando no hay fecha: así quien lo llama
 * decide qué mostrar en vez de recibir un hueco silencioso.
 */
const FORMATO_CORTO = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function fechaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return FORMATO_CORTO.format(new Date(t));
}
