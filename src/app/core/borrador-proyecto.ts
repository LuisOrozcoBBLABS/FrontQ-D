import { AppSimilar, SECTORES, TipoPrestacion } from './models';
import { NuevoProyecto } from './projects.service';

/**
 * Lógica del borrador de un proyecto: validación, normalización y armado del
 * body de POST /projects. Sin Angular, todo puro y testeable solo.
 *
 * Molde: core/transiciones.ts — funciones puras con su spec al lado.
 *
 * Existe porque el formulario de proyectos ahora tiene dos entradas (escribir a
 * mano en /proyectos/nuevo, o corregir lo que propuso la IA en /documentos) y
 * las reglas tienen que ser las mismas en las dos. Antes vivían sueltas dentro
 * del componente, y ahí es donde estaban los dos defectos que este archivo
 * arregla: el filtro con OR de `similares` y la falta de recorte a los topes.
 */

export interface BorradorProyecto {
  nombre: string;
  sector: string;
  /** Cliente para el que se hace. Cadena vacia = sin cliente; el servidor la
   *  guarda como null, porque "sin cliente" y "cliente en blanco" son lo mismo. */
  cliente: string;
  /** Qué se presta. Null = sin clasificar, que es un valor válido. */
  tipoPrestacion: TipoPrestacion | null;
  problema: string;
  dolores: string;
  solucion: string;
  plusIA: string;
  similares: AppSimilar[];
  groupId: string | null;
}

/**
 * Topes del CreateProjectDto del backend. Espejan los de
 * BackQ-D/src/modules/ai/saneamiento.ts: si cambian allá, cambian acá.
 */
export const LIMITES = {
  nombre: 140,
  cliente: 140,
  texto: 4000,
  similarNombre: 120,
  similarUrl: 400,
} as const;

export function borradorVacio(groupId: string | null = null): BorradorProyecto {
  return {
    nombre: '',
    sector: '',
    cliente: '',
    tipoPrestacion: null,
    problema: '',
    dolores: '',
    solucion: '',
    plusIA: '',
    similares: [{ name: '', url: '' }],
    groupId,
  };
}

/** Recorta a `max` unidades UTF-16 sin partir un par surrogate. */
export function recortar(valor: string, max: number): string {
  if (valor.length <= max) return valor;

  let corte = max;
  const anterior = valor.charCodeAt(corte - 1);
  if (anterior >= 0xd800 && anterior <= 0xdbff) corte -= 1;

  const trozo = valor.slice(0, corte);
  const espacio = Math.max(trozo.lastIndexOf(' '), trozo.lastIndexOf('\n'));
  const elegido = espacio > max * 0.6 ? trozo.slice(0, espacio) : trozo;
  return elegido.trimEnd();
}

/** Plegado para comparar: sin mayúsculas, sin tildes, sin puntuación de sobra. */
function plegar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devuelve siempre uno de los sectores del `<select>`, o 'Otro'.
 *
 * Misma normalización plegada que el backend, por la misma razón: si el valor no
 * está en la lista, el `<select>` no muestra nada y la persona cree que el campo
 * quedó vacío cuando en realidad tiene un valor que el servidor va a aceptar.
 */
export function normalizarSector(crudo: unknown): string {
  if (typeof crudo !== 'string') return 'Otro';

  const exacto = SECTORES.find(s => s === crudo);
  if (exacto) return exacto;

  const plegado = plegar(crudo);
  if (!plegado) return 'Otro';

  return SECTORES.find(s => plegar(s) === plegado) ?? 'Otro';
}

/**
 * Una URL que el navegador puede abrir. Allowlist de protocolo además del
 * parseo: la URL se pinta en un `href`, así que `javascript:` sería XSS.
 */
export function esUrlValida(crudo: string): boolean {
  const bruto = crudo.trim();
  if (!bruto) return false;

  const candidato = conEsquema(bruto);
  try {
    const url = new URL(candidato);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname.includes('.') &&
      !url.hostname.endsWith('.') &&
      candidato.length <= LIMITES.similarUrl
    );
  } catch {
    return false;
  }
}

/**
 * Los similares que el servidor va a aceptar.
 *
 * Acá se arregla un defecto concreto: el formulario filtraba con
 * `s.name.trim() || s.url.trim()` — un OR — y el backend exige LOS DOS
 * (`@IsString` en `name`, `@IsUrl` en `url`). Resultado: escribir el nombre de
 * una app y dejar su URL vacía hacía fallar el POST entero con un 400 que no
 * señalaba a ninguno de los dos campos. Con AND, esa fila simplemente no viaja.
 */
export function similaresValidos(similares: readonly AppSimilar[]): AppSimilar[] {
  return similares
    .filter(s => s.name.trim() !== '' && esUrlValida(s.url))
    .map(s => ({
      name: recortar(s.name.trim(), LIMITES.similarNombre),
      url: conEsquema(s.url.trim()),
    }));
}

/**
 * Antepone https:// a un dominio suelto — sin esquema el `href` lo lee como
 * ruta relativa. Misma regla de tres ramas que el saneador del backend, para que
 * los dos lados acepten y rechacen exactamente lo mismo:
 *
 * - ya trae `esquema://` → tal cual;
 * - trae `algo:` sin punto antes (javascript:, data:, mailto:) → tal cual, para
 *   que lo rechace la allowlist de protocolo en vez de disfrazarlo;
 * - cualquier otra cosa → se le antepone https:// (así `ejemplo.com:8080` se
 *   trata como dominio con puerto y no como un esquema llamado "ejemplo.com").
 */
function conEsquema(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[^:]*\./.test(url)) return url;
  return `https://${url}`;
}

/** Primer problema que impide guardar, o null si el borrador está listo. */
export function validarBorrador(b: BorradorProyecto): string | null {
  if (b.nombre.trim().length < 2) {
    return 'El nombre de la solución tiene que tener al menos dos caracteres.';
  }
  if (!b.sector.trim()) return 'Elegí el sector.';
  if (!b.problema.trim()) return 'Describí el problema que estás atacando.';

  // Una fila a medio llenar es un error de la persona, no algo que descartar en
  // silencio: si escribió el nombre, quiere que ese similar quede guardado.
  const aMedias = b.similares.find(
    s => s.name.trim() !== '' && s.url.trim() !== '' && !esUrlValida(s.url),
  );
  if (aMedias) return `La URL de "${aMedias.name.trim()}" no es válida. Tiene que ser un enlace http o https.`;

  const sinUrl = b.similares.find(s => s.name.trim() !== '' && s.url.trim() === '');
  if (sinUrl) {
    return `Falta la URL de "${sinUrl.name.trim()}". El servidor no acepta una app parecida sin enlace.`;
  }

  return null;
}

/** El body exacto de POST /projects, con todo recortado a los topes del DTO. */
export function aNuevoProyecto(b: BorradorProyecto): NuevoProyecto {
  return {
    nombre: recortar(b.nombre.trim(), LIMITES.nombre),
    sector: b.sector.trim(),
    // Se OMITE la clave cuando no hay cliente, en vez de mandarla en undefined.
    // Con `cliente: undefined` el JSON sale igual (JSON.stringify descarta los
    // undefined), pero el objeto sí lleva la clave, y el contrato de este metodo
    // se verifica con Object.keys — o sea que la forma del objeto y la del
    // cuerpo que viaja tienen que coincidir para que el test signifique algo.
    //
    // OJO: esto es el cuerpo del POST, o sea el ALTA. Al EDITAR hay que poder
    // borrar el cliente, y una clave ausente no borra nada — el modal manda
    // `cliente: ''` aparte para eso. Ver `ProjectModal.guardar()`.
    ...(b.cliente.trim()
      ? { cliente: recortar(b.cliente.trim(), LIMITES.cliente) }
      : {}),
    // `tipoPrestacion` SÍ viaja siempre, incluso en null, y la diferencia con
    // el cliente es deliberada: acá null es una elección ("sin clasificar") y
    // no un campo vacío, así que omitirlo impediría volver a ese estado.
    tipoPrestacion: b.tipoPrestacion,
    problema: recortar(b.problema.trim(), LIMITES.texto),
    dolores: recortar(b.dolores.trim(), LIMITES.texto),
    solucion: recortar(b.solucion.trim(), LIMITES.texto),
    plusIA: recortar(b.plusIA.trim(), LIMITES.texto),
    similares: similaresValidos(b.similares),
    groupId: b.groupId,
    estado: 'idea',
  };
}
