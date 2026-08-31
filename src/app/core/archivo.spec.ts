import { MAX_BYTES, validarArchivo } from './archivo';

describe('validarArchivo', () => {
  it('acepta un PDF y un DOCX normales', () => {
    expect(validarArchivo('pliego.pdf', 'application/pdf', 1000)).toBeNull();
    expect(
      validarArchivo(
        'acta.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        1000,
      ),
    ).toBeNull();
  });

  it('acepta un archivo con MIME vacío, que es lo que manda Windows para el DOCX', () => {
    // La extensión es el criterio primario justamente por esto: exigir el MIME
    // rechazaría archivos perfectamente válidos.
    expect(validarArchivo('acta.docx', '', 1000)).toBeNull();
    expect(validarArchivo('pliego.pdf', '', 1000)).toBeNull();
    expect(validarArchivo('pliego.pdf', 'application/octet-stream', 1000)).toBeNull();
  });

  it('acepta la extensión en mayúsculas', () => {
    expect(validarArchivo('PLIEGO.PDF', '', 1000)).toBeNull();
  });

  it('rechaza el .doc viejo con el mensaje que dice qué hacer', () => {
    const salida = validarArchivo('informe.doc', 'application/msword', 1000);
    expect(salida).toContain('.docx');
    expect(salida).toContain('guardalo');
  });

  it('rechaza cualquier otra extensión', () => {
    expect(validarArchivo('foto.png', 'image/png', 1000)).toContain('PDF o DOCX');
    expect(validarArchivo('datos.xlsx', '', 1000)).toContain('PDF o DOCX');
    expect(validarArchivo('sin-extension', '', 1000)).toContain('PDF o DOCX');
  });

  it('rechaza un MIME que no está en la allowlist aunque la extensión sirva', () => {
    expect(validarArchivo('trampa.pdf', 'image/png', 1000)).toContain('PDF o DOCX');
  });

  it('rechaza el archivo de cero bytes', () => {
    expect(validarArchivo('vacio.pdf', 'application/pdf', 0)).toBe('El archivo está vacío.');
  });

  it('rechaza justo por encima del tope y acepta justo en el tope', () => {
    expect(validarArchivo('grande.pdf', 'application/pdf', MAX_BYTES)).toBeNull();
    const salida = validarArchivo('grande.pdf', 'application/pdf', MAX_BYTES + 1);
    expect(salida).toContain('8 MB');
  });
});
