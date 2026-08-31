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
 * desde CUALQUIER estado, `completada` incluida: una asignación completada por
 * error se reabre a `en-curso` en lugar de obligar a crear otra.
 *
 * Esto ya se rompió una vez, y en la dirección menos obvia. Se "corrigió" este
 * archivo a `completada: []` para alinearlo con el servidor, contra una copia
 * local de BackQ-D que estaba ATRASADA: el commit 84831a2 de su `main`
 * —"permitir reabrir una asignacion completada"— ya había cambiado esa fila a
 * `[AssignmentStatus.en_curso]`. O sea que este archivo estaba bien y el
 * arreglo le quitó una función que funcionaba.
 *
 * La lección para la próxima: antes de "alinear el espejo", verificar contra
 * `origin/main` del backend, no contra el working copy que se tenga a mano.
 */
export const SECUENCIA: AssignmentStatus[] = ['pendiente', 'aceptada', 'en-curso', 'completada'];

const PERMITIDAS: Record<AssignmentStatus, AssignmentStatus[]> = {
  pendiente: ['aceptada'],
  aceptada: ['en-curso', 'pendiente'],
  'en-curso': ['completada', 'aceptada'],
  completada: ['en-curso'], // se puede reabrir, igual que en el servidor
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

/* No hay funcion `esFinal`, y no es un olvido: en esta maquina NINGUN estado es
   final. Todos tienen al menos una transicion, `completada` incluida —vuelve a
   `en-curso`—, asi que una funcion que preguntara "es final" no podria devolver
   true nunca. Existio, con un guardia que la usaba en el arrastre y un
   comentario que afirmaba "Completada es final": las tres cosas eran letra
   muerta. Si algun dia el servidor vuelve a cerrar un estado, esto se agrega de
   nuevo — y se agrega con un test que lo vea devolver true. */
