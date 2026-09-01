import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Subject, filter, firstValueFrom, map, takeUntil, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { BorradorProyecto, LIMITES, normalizarSector, recortar, similaresValidos } from './borrador-proyecto';
import { AppSimilar } from './models';

/** Lo que devuelve POST /ai/borrador-proyecto. Espeja la RespuestaBorrador del backend. */
interface BorradorApi {
  borrador: {
    nombre: string;
    sector: string;
    problema: string;
    dolores: string;
    solucion: string;
    plusIA: string;
    similares: AppSimilar[];
  };
  avisos: string[];
  origen: {
    archivo: string;
    formato: 'pdf' | 'docx';
    caracteresLeidos: number;
    truncado: boolean;
  };
  modelo: string;
}

export interface AnalisisListo {
  borrador: BorradorProyecto;
  /** Campos que propuso la IA, para marcarlos como "sin revisar" en el formulario. */
  camposIA: string[];
  sectorPropuesto: string;
  /** Campos que hubo que recortar al normalizar la respuesta. */
  recortados: string[];
  similaresDescartados: number;
  archivo: string;
  modelo: string;
  /** Los avisos del servidor más los que produjo esta normalización. */
  avisos: string[];
}

export type FaseServicio = 'inactivo' | 'subiendo' | 'procesando';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private readonly _fase = signal<FaseServicio>('inactivo');
  private readonly _progreso = signal(0);

  readonly fase = this._fase.asReadonly();
  /** Porcentaje real de subida (0-100). Solo tiene sentido en fase 'subiendo'. */
  readonly progreso = this._progreso.asReadonly();

  private cancelar$ = new Subject<void>();

  /**
   * Es una escritura, así que NO captura el error: lo deja propagar para que el
   * componente lo muestre, igual que `create`/`update` de projects.service.ts.
   *
   * `reportProgress` con `observe:'events'` se suscribe acá adentro y devuelve
   * una Promise, así la convención "cero Observables hacia afuera" queda intacta
   * y el paso 01 del stepper muestra progreso real en vez de una animación.
   */
  async analizar(archivo: File, contexto?: string): Promise<AnalisisListo> {
    // El interceptor solo agrega Authorization y no fuerza Content-Type, así que
    // FormData funciona sin tocarlo: el navegador pone el boundary del multipart.
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    if (contexto?.trim()) cuerpo.append('contexto', contexto.trim());

    this._fase.set('subiendo');
    this._progreso.set(0);

    try {
      const respuesta = await firstValueFrom(
        this.http
          .post<BorradorApi>(`${this.base}/ai/borrador-proyecto`, cuerpo, {
            reportProgress: true,
            observe: 'events',
          })
          .pipe(
            tap(evento => {
              if (evento.type === HttpEventType.UploadProgress) {
                const total = evento.total ?? archivo.size;
                this._progreso.set(total ? Math.round((evento.loaded / total) * 100) : 0);
                // Subido todo: de acá en adelante la espera es del servidor.
                if (evento.loaded >= total) this._fase.set('procesando');
              }
            }),
            filter(evento => evento.type === HttpEventType.Response),
            map(evento => evento.body as BorradorApi),
            takeUntil(this.cancelar$),
          ),
      );

      return aAnalisis(respuesta);
    } finally {
      this._fase.set('inactivo');
      this._progreso.set(0);
    }
  }

  /** Corta la petición en curso. La usa el botón Cancelar y el onDestroy. */
  cancelar(): void {
    this.cancelar$.next();
    // Un Subject completado no vuelve a emitir: hace falta uno nuevo por pedido.
    this.cancelar$ = new Subject<void>();
    this._fase.set('inactivo');
    this._progreso.set(0);
  }
}

/**
 * Normaliza la respuesta y REPORTA lo que tocó, para que la revisión sea
 * transparente en vez de silenciosa.
 *
 * El recorte va acá, en el mapeo, y no en el guardado, por un detalle que
 * importa: `maxlength` no aplica a valores puestos por código. Un `problema` de
 * 5000 caracteres que venga de la IA se quedaría entero en el textarea y se
 * enviaría igual, aunque el atributo diga 4000.
 */
export function aAnalisis(api: BorradorApi): AnalisisListo {
  const b = api.borrador;
  const recortados: string[] = [];

  const campo = (valor: string, etiqueta: string, max: number): string => {
    const limpio = (valor ?? '').trim();
    const corto = recortar(limpio, max);
    if (corto.length !== limpio.length) recortados.push(etiqueta);
    return corto;
  };

  const similares = similaresValidos(b.similares ?? []);
  const similaresDescartados = (b.similares?.length ?? 0) - similares.length;
  const sectorPropuesto = normalizarSector(b.sector);

  const borrador: BorradorProyecto = {
    nombre: campo(b.nombre, 'el nombre', LIMITES.nombre),
    sector: sectorPropuesto,
    // La extraccion no propone NI cliente NI tipo de prestacion: son datos
    // comerciales que el documento fuente rara vez dice, y adivinarlos es peor
    // que dejarlos en blanco para que los escriba una persona. Por eso tampoco
    // entran en `camposIA` ni llevan el badge de "propuesto".
    cliente: '',
    tipoPrestacion: null,
    problema: campo(b.problema, 'el problema', LIMITES.texto),
    dolores: campo(b.dolores, 'los dolores', LIMITES.texto),
    solucion: campo(b.solucion, 'la solución', LIMITES.texto),
    plusIA: campo(b.plusIA, 'el plus con IA', LIMITES.texto),
    // Siempre queda una fila vacía para que se pueda agregar una a mano.
    similares: similares.length ? [...similares, { name: '', url: '' }] : [{ name: '', url: '' }],
    groupId: null,
  };

  // Solo se marcan como "propuestos por IA" los campos que traen algo: un campo
  // vacío no es una propuesta que haya que revisar.
  const camposIA = (
    ['nombre', 'sector', 'problema', 'dolores', 'solucion', 'plusIA'] as const
  ).filter(k => borrador[k].trim() !== '') as string[];
  if (similares.length) camposIA.push('similares');

  const avisos = [...(api.avisos ?? [])];
  if (recortados.length) {
    avisos.push(`Se recortó ${recortados.join(', ')} para que entre en el límite del servidor.`);
  }
  if (similaresDescartados > 0) {
    avisos.push(
      similaresDescartados === 1
        ? 'Se descartó una app parecida porque su enlace no era usable.'
        : `Se descartaron ${similaresDescartados} apps parecidas porque su enlace no era usable.`,
    );
  }

  return {
    borrador,
    camposIA,
    sectorPropuesto,
    recortados,
    similaresDescartados,
    archivo: api.origen?.archivo ?? 'el documento',
    modelo: api.modelo,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Persistencia del borrador en la pestaña
// ---------------------------------------------------------------------------

/**
 * sessionStorage y NUNCA localStorage: el borrador no sobrevive a la pestaña.
 * Se guarda solo el borrador ya normalizado — nunca el archivo, nunca el texto
 * crudo del documento.
 *
 * Vive en core y no en el componente porque AuthService.logout() tiene que poder
 * borrarlo, y no puede importar un componente cargado en diferido.
 */
const CLAVE_BORRADOR = 'plataforma-id.documentos-borrador';

export interface BorradorGuardado {
  borrador: BorradorProyecto;
  camposIA: string[];
  archivo: string;
  avisos: string[];
}

export function guardarBorrador(dato: BorradorGuardado): void {
  try {
    sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(dato));
  } catch {
    /* sin sessionStorage el borrador dura lo que la pantalla */
  }
}

export function leerBorrador(): BorradorGuardado | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_BORRADOR);
    if (!crudo) return null;

    const dato = JSON.parse(crudo) as BorradorGuardado;
    // Un borrador sin nada escrito no vale la pena restaurar.
    if (!dato?.borrador?.nombre?.trim() && !dato?.borrador?.problema?.trim()) return null;

    // Lo guardado puede venir de una versión anterior de la aplicación, sin los
    // campos que se agregaron después. Se completan acá y no en quien lo use:
    // un `undefined.trim()` al guardar rompería el formulario con el borrador
    // ya en pantalla, que es el peor momento posible.
    return {
      ...dato,
      borrador: {
        ...dato.borrador,
        cliente: dato.borrador.cliente ?? '',
        tipoPrestacion: dato.borrador.tipoPrestacion ?? null,
      },
    };
  } catch {
    olvidarBorrador();
    return null;
  }
}

export function olvidarBorrador(): void {
  try {
    sessionStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* nada que olvidar */
  }
}

/** Traduce el status a algo que ayude a resolverlo. */
export function mensajeDeAnalisis(e: unknown, porDefecto: string): string {
  const posible = e as { status?: number; error?: { message?: string | string[] } };
  const delServidor = posible?.error?.message;
  const texto = Array.isArray(delServidor) ? delServidor[0] : delServidor;

  switch (posible?.status) {
    case 400:
      // El backend ya manda mensajes útiles y en español; se respetan.
      return (
        texto ||
        'No se pudo leer el documento. Si es un PDF escaneado o con contraseña, probá con uno que tenga texto seleccionable.'
      );
    case 413:
      return 'El archivo pesa demasiado para el servidor. Subí una versión más liviana.';
    case 415:
      return 'Ese formato no se puede leer. Solo PDF o DOCX.';
    case 403:
      return 'No tenés el permiso para usar las funciones de IA.';
    case 429:
      return 'Se hicieron muchas consultas en poco tiempo. Esperá un minuto y probá de nuevo.';
    case 502:
    case 503:
      return texto || 'El servicio de IA no está disponible en este momento.';
    case 0:
      return 'No hay conexión con el servidor.';
    default:
      return texto || porDefecto;
  }
}
