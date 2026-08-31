/**
 * Validación del archivo antes de subirlo. Funciones puras sobre primitivos y
 * NO sobre `File`, para que el test no tenga que construir un File de 15 MB en
 * jsdom.
 *
 * Esto es cortesía, no seguridad: el servidor decide por contenido (magic
 * numbers), porque la extensión y el MIME los elige el cliente. Lo que se gana
 * acá es no gastar una subida de 8 MB para que el servidor devuelva 400, y no
 * comerse el 413 de multer, cuyo mensaje viene en inglés y rompe la convención
 * del repo.
 */

/** Alineado con el `fileSize` del FileInterceptor del backend. */
export const MAX_BYTES = 8 * 1024 * 1024;

export const EXTENSIONES = ['.pdf', '.docx'] as const;

/**
 * Allowlist de MIME. El vacío y `application/octet-stream` NO están porque se
 * aceptan por otra vía: el chequeo de MIME solo se aplica si viene no vacío, y
 * el DOCX llega con MIME vacío en varios navegadores.
 */
const MIMES = [
  'application/pdf',
  'application/x-pdf',
  'application/octet-stream',
  'binary/octet-stream',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Devuelve el problema a mostrar, o null si el archivo puede subirse. */
export function validarArchivo(nombre: string, tipo: string, bytes: number): string | null {
  const limpio = (nombre ?? '').toLowerCase().trim();

  if (bytes <= 0) return 'El archivo está vacío.';

  if (limpio.endsWith('.doc')) {
    // Mensaje propio: es el error más común, y "formato no soportado" no dice
    // qué hacer al respecto.
    return 'Es un Word antiguo (.doc). Abrilo y guardalo como .docx o PDF, y volvé a subirlo.';
  }

  // La extensión es el criterio primario: el MIME del DOCX llega vacío en
  // varios navegadores, así que no se puede exigir.
  if (!EXTENSIONES.some(ext => limpio.endsWith(ext))) {
    return 'Solo se aceptan archivos PDF o DOCX.';
  }

  const mime = (tipo ?? '').toLowerCase().split(';')[0].trim();
  if (mime && !MIMES.includes(mime)) {
    return 'Solo se aceptan archivos PDF o DOCX.';
  }

  if (bytes > MAX_BYTES) {
    return `El archivo pesa ${enMb(bytes)} MB y el máximo son ${enMb(MAX_BYTES)} MB. Subí solo la parte que importa.`;
  }

  return null;
}

function enMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
}
