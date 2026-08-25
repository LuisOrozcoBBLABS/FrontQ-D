import { AssignmentStatus } from './models';

/**
 * Máquina de estados de una asignación, espejo de la del servidor
 * (BackQ-D · modules/assignments/estado.ts).
 *
 * El servidor es el que manda: esta copia existe para que la interfaz pueda
 * apagar de antemano lo que va a rechazar, en lugar de dejar intentar el
 * movimiento y mostrar un error después. Si allá cambian las reglas, hay que
 * cambiarlas acá.
 *
 * Hacia adelante se avanza de a un paso, y hacia atrás se vuelve de a un paso
 * desde `aceptada` y `en-curso`. `completada` NO vuelve: es final.
 *
 * Esa última regla estaba mal copiada. El front decía `completada: ['en-curso']`
 * con el comentario "se puede reabrir", pero el servidor tiene `completada: []`
 * y responde "La asignación ya está completada y no admite más cambios". O sea
 * que la interfaz mostraba el botón de retroceso y dejaba arrastrar la tarjeta,
 * y el servidor rechazaba las dos cosas — exactamente el error que este espejo
 * existe para evitar.
 */
export const SECUENCIA: AssignmentStatus[] = ['pendiente', 'aceptada', 'en-curso', 'completada'];

const PERMITIDAS: Record<AssignmentStatus, AssignmentStatus[]> = {
  pendiente: ['aceptada'],
  aceptada: ['en-curso', 'pendiente'],
  'en-curso': ['completada', 'aceptada'],
  completada: [], // estado final, igual que en el servidor
};

/** Único avance válido desde cada estado, con el verbo de la acción. */
export const SIGUIENTE: Partial<Record<AssignmentStatus, { estado: AssignmentStatus; verbo: string }>> = {
  pendiente: { estado: 'aceptada', verbo: 'Aceptar' },
  aceptada: { estado: 'en-curso', verbo: 'Empezar' },
  'en-curso': { estado: 'completada', verbo: 'Completar' },
};

/** Reenviar el mismo estado no es un error, igual que en el servidor. */
export function puedeIr(desde: AssignmentStatus, hasta: AssignmentStatus): boolean {
  return desde === hasta || PERMITIDAS[desde].includes(hasta);
}

/** Paso hacia atrás válido, o null si el estado no admite volver. */
export function retrocesoDe(desde: AssignmentStatus): AssignmentStatus | null {
  const adelante = SIGUIENTE[desde]?.estado;
  return PERMITIDAS[desde].find(e => e !== adelante) ?? null;
}

/** Una asignación cerrada ya no se mueve: sirve para no dejarla arrastrar. */
export function esFinal(estado: AssignmentStatus): boolean {
  return PERMITIDAS[estado].length === 0;
}
