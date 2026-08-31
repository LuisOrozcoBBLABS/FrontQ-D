import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { DocumentsService, aAnalisis, mensajeDeAnalisis } from './documents.service';

const URL = `${environment.apiUrl}/ai/borrador-proyecto`;

/**
 * La respuesta que devuelve el backend, con los metadatos como hermanos.
 * El `borrador` del patch se mezcla campo por campo; el resto reemplaza.
 */
function apiOk(patch: { borrador?: Record<string, unknown>; avisos?: string[] } = {}) {
  const { borrador, ...resto } = patch;
  return {
    borrador: {
      nombre: 'FreightAudit',
      sector: 'Logística',
      problema: 'Auditoría manual de fletes.',
      dolores: 'Cobros duplicados.',
      solucion: 'Cotejo automático.',
      plusIA: 'Anomalías.',
      similares: [{ name: 'Reveel', url: 'https://reveelgroup.com' }],
      ...borrador,
    },
    avisos: [],
    origen: { archivo: 'pliego.pdf', formato: 'pdf', caracteresLeidos: 5000, truncado: false },
    modelo: 'gemini-2.5-flash',
    ...resto,
  };
}

function archivoFalso(nombre = 'pliego.pdf'): File {
  return new File(['contenido'], nombre, { type: 'application/pdf' });
}

describe('DocumentsService', () => {
  let servicio: DocumentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(DocumentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('manda el archivo como FormData en el campo "archivo"', async () => {
    const promesa = servicio.analizar(archivoFalso());

    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);

    req.flush(apiOk());
    await promesa;
  });

  /**
   * Invariante cargado: el interceptor NO debe forzar Content-Type. Si alguien
   * lo "arregla" poniendo application/json, el navegador deja de generar el
   * boundary del multipart y el upload se rompe en silencio. Este test lo caza.
   */
  it('no pone Content-Type: el navegador tiene que elegir el boundary del multipart', async () => {
    const promesa = servicio.analizar(archivoFalso());

    const req = http.expectOne(URL);
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush(apiOk());
    await promesa;
  });

  it('manda el contexto solo cuando tiene algo escrito', async () => {
    const conContexto = servicio.analizar(archivoFalso(), '  es un pliego  ');
    const req1 = http.expectOne(URL);
    expect((req1.request.body as FormData).get('contexto')).toBe('es un pliego');
    req1.flush(apiOk());
    await conContexto;

    const sinContexto = servicio.analizar(archivoFalso(), '   ');
    const req2 = http.expectOne(URL);
    expect((req2.request.body as FormData).has('contexto')).toBe(false);
    req2.flush(apiOk());
    await sinContexto;
  });

  it('deja propagar el error en vez de capturarlo, como create/update de projects', async () => {
    const promesa = servicio.analizar(archivoFalso());
    http.expectOne(URL).flush({ message: 'PDF escaneado' }, { status: 400, statusText: 'Bad Request' });

    await expect(promesa).rejects.toBeTruthy();
    // Y la fase vuelve a inactivo: el componente no queda esperando para siempre.
    expect(servicio.fase()).toBe('inactivo');
  });

  it('devuelve la fase a inactivo también cuando todo sale bien', async () => {
    const promesa = servicio.analizar(archivoFalso());
    http.expectOne(URL).flush(apiOk());
    await promesa;

    expect(servicio.fase()).toBe('inactivo');
    expect(servicio.progreso()).toBe(0);
  });
});

describe('aAnalisis', () => {
  it('marca como propuestos por IA solo los campos que traen algo', () => {
    const listo = aAnalisis(apiOk({ borrador: { dolores: '', plusIA: '' } }) as never);

    expect(listo.camposIA).toContain('nombre');
    expect(listo.camposIA).toContain('similares');
    expect(listo.camposIA).not.toContain('dolores');
    expect(listo.camposIA).not.toContain('plusIA');
  });

  it('normaliza el sector para que el select lo pueda mostrar', () => {
    const listo = aAnalisis(apiOk({ borrador: { sector: 'logistica' } }) as never);
    expect(listo.borrador.sector).toBe('Logística');

    const raro = aAnalisis(apiOk({ borrador: { sector: 'Agro' } }) as never);
    expect(raro.borrador.sector).toBe('Otro');
  });

  it('recorta en el mapeo y no en el guardado, y lo reporta', () => {
    // maxlength no aplica a valores puestos por código: sin este recorte, un
    // texto de 5000 caracteres se quedaría entero en el textarea y se enviaría.
    const listo = aAnalisis(apiOk({ borrador: { problema: 'x'.repeat(5000) } }) as never);

    expect(listo.borrador.problema.length).toBeLessThanOrEqual(4000);
    expect(listo.recortados).toContain('el problema');
    expect(listo.avisos.join(' ')).toContain('recortó');
  });

  it('descarta los similares que el servidor rechazaría y avisa cuántos', () => {
    const listo = aAnalisis(
      apiOk({
        borrador: {
          similares: [
            { name: 'Trello', url: '' },
            { name: 'Malo', url: 'javascript:alert(1)' },
            { name: 'Reveel', url: 'https://reveelgroup.com' },
          ],
        },
      }) as never,
    );

    expect(listo.similaresDescartados).toBe(2);
    expect(listo.avisos.join(' ')).toContain('2');
    // Queda una fila vacía para poder agregar una a mano.
    expect(listo.borrador.similares[listo.borrador.similares.length - 1]).toEqual({ name: '', url: '' });
  });

  it('conserva los avisos que ya mandó el servidor', () => {
    const listo = aAnalisis(apiOk({ avisos: ['El sector propuesto no estaba en la lista.'] }) as never);
    expect(listo.avisos[0]).toContain('sector propuesto');
  });
});

describe('mensajeDeAnalisis', () => {
  it('respeta el mensaje del backend en un 400', () => {
    const salida = mensajeDeAnalisis({ status: 400, error: { message: 'Es un .doc viejo' } }, 'x');
    expect(salida).toBe('Es un .doc viejo');
  });

  it('explica el caso del PDF escaneado cuando el backend no dice nada', () => {
    expect(mensajeDeAnalisis({ status: 400 }, 'x')).toContain('escaneado');
  });

  it('traduce los status que necesitan una explicación propia', () => {
    expect(mensajeDeAnalisis({ status: 413 }, 'x')).toContain('pesa demasiado');
    expect(mensajeDeAnalisis({ status: 415 }, 'x')).toContain('PDF o DOCX');
    expect(mensajeDeAnalisis({ status: 403 }, 'x')).toContain('permiso');
    expect(mensajeDeAnalisis({ status: 429 }, 'x')).toContain('muchas consultas');
    expect(mensajeDeAnalisis({ status: 503 }, 'x')).toContain('servicio de IA');
    expect(mensajeDeAnalisis({ status: 0 }, 'x')).toContain('conexión');
  });

  it('cae en el mensaje por defecto cuando no hay nada mejor', () => {
    expect(mensajeDeAnalisis({}, 'por defecto')).toBe('por defecto');
  });
});
