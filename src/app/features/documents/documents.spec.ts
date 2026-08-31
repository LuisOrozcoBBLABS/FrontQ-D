import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AnalisisListo, DocumentsService, olvidarBorrador } from '../../core/documents.service';
import { borradorVacio } from '../../core/borrador-proyecto';
import { Documents } from './documents';

/** Un análisis ya normalizado, como el que devuelve el servicio. */
function analisis(): AnalisisListo {
  return {
    borrador: {
      ...borradorVacio(),
      nombre: 'FreightAudit',
      sector: 'Logística',
      problema: 'Auditoría manual de fletes.',
      similares: [{ name: 'Reveel', url: 'https://reveelgroup.com' }, { name: '', url: '' }],
    },
    camposIA: ['nombre', 'sector', 'problema', 'similares'],
    sectorPropuesto: 'Logística',
    recortados: [],
    similaresDescartados: 0,
    archivo: 'pliego.pdf',
    modelo: 'gemini-2.5-flash',
    avisos: ['El sector propuesto no era exacto: quedó como "Logística".'],
  };
}

/** Doble del servicio: la pantalla no debe depender de HTTP para testearse. */
class DocsFalso {
  analizar = vi.fn();
  cancelar = vi.fn();
  fase = () => 'inactivo' as const;
  progreso = () => 0;
}

let docs: DocsFalso;

async function montar() {
  docs = new DocsFalso();

  await TestBed.configureTestingModule({
    imports: [Documents],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: DocumentsService, useValue: docs },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Documents);
  await fixture.whenStable();
  return fixture;
}

beforeEach(() => {
  olvidarBorrador(); // que un test no le herede el borrador al siguiente
});

describe('Documents', () => {
  it('al montar muestra la dropzone y todavía no el formulario', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-doc-dropzone')).not.toBeNull();
    expect(el.querySelector('app-project-fields')).toBeNull();
  });

  it('anuncia el envío a un servicio externo ANTES de elegir el archivo', async () => {
    const fixture = await montar();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('servicio de IA externo');
    expect(texto).toContain('no queda guardado');
  });

  it('resuelto el análisis aparecen los campos precargados y los avisos', async () => {
    const fixture = await montar();
    docs.analizar.mockResolvedValue(analisis());

    await fixture.componentInstance.alElegirArchivo(
      new File(['x'], 'pliego.pdf', { type: 'application/pdf' }),
    );
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-project-fields')).not.toBeNull();
    expect(el.querySelector('app-doc-dropzone')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('#pf-n')!.value).toBe('FreightAudit');
    // Los avisos del saneamiento se muestran: la revisión no es silenciosa.
    expect(el.textContent).toContain('Logística');
    expect(el.querySelector('.docs__avisos')).not.toBeNull();
  });

  it('un archivo inválido pinta un role="alert" y no llama a analizar', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;

    const input = el.querySelector<HTMLInputElement>('app-doc-dropzone input[type=file]')!;
    // jsdom no deja asignar `files`, así que se define la propiedad a mano.
    const png = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [png], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(docs.analizar).not.toHaveBeenCalled();
  });

  it('un error del servidor vuelve a la fase vacía y lo muestra', async () => {
    const fixture = await montar();
    docs.analizar.mockRejectedValue({ status: 400, error: { message: 'Es un PDF escaneado.' } });

    await fixture.componentInstance.alElegirArchivo(new File(['x'], 'p.pdf', { type: 'application/pdf' }));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-doc-dropzone')).not.toBeNull();
    expect(el.textContent).toContain('Es un PDF escaneado.');
  });

  it('recupera el borrador de la pestaña y lo avisa, sin haber guardado nada', async () => {
    // El F5 en revisión no puede dejar un formulario vacío en una ruta que
    // promete un borrador; tampoco puede fingir que se guardó en el servidor.
    const primera = await montar();
    docs.analizar.mockResolvedValue(analisis());
    await primera.componentInstance.alElegirArchivo(new File(['x'], 'pliego.pdf', { type: 'application/pdf' }));
    await primera.whenStable();

    TestBed.resetTestingModule();
    const segunda = await montar();
    const el = segunda.nativeElement as HTMLElement;

    expect(el.querySelector('app-project-fields')).not.toBeNull();
    expect(el.textContent).toContain('Recuperamos el borrador');
    expect(el.textContent).toContain('Nada se guardó en el servidor');
  });

  it('descartar limpia la pantalla y no deja nada en sessionStorage', async () => {
    const fixture = await montar();
    docs.analizar.mockResolvedValue(analisis());
    await fixture.componentInstance.alElegirArchivo(new File(['x'], 'pliego.pdf', { type: 'application/pdf' }));
    await fixture.whenStable();

    expect(sessionStorage.getItem('plataforma-id.documentos-borrador')).not.toBeNull();

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach(b => {
        if (b.textContent?.includes('Descartar')) b.click();
      });
    await fixture.whenStable();

    expect(sessionStorage.getItem('plataforma-id.documentos-borrador')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-doc-dropzone')).not.toBeNull();
  });

  it('nunca escribe nada en localStorage', async () => {
    const fixture = await montar();
    docs.analizar.mockResolvedValue(analisis());
    await fixture.componentInstance.alElegirArchivo(new File(['x'], 'pliego.pdf', { type: 'application/pdf' }));
    await fixture.whenStable();

    expect(localStorage.getItem('plataforma-id.documentos-borrador')).toBeNull();
  });
});
