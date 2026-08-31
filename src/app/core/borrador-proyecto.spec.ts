import {
  BorradorProyecto,
  LIMITES,
  aNuevoProyecto,
  borradorVacio,
  esUrlValida,
  normalizarSector,
  recortar,
  similaresValidos,
  validarBorrador,
} from './borrador-proyecto';

/** Un borrador listo para guardar, para tocarle un campo por test. */
function completo(patch: Partial<BorradorProyecto> = {}): BorradorProyecto {
  return {
    ...borradorVacio(),
    nombre: 'FreightAudit',
    sector: 'Logística',
    problema: 'Las facturas de flete se auditan a mano.',
    similares: [{ name: 'Reveel', url: 'https://reveelgroup.com' }],
    ...patch,
  };
}

describe('similaresValidos', () => {
  /**
   * Regresión del defecto que este archivo vino a arreglar.
   *
   * El formulario filtraba con `s.name.trim() || s.url.trim()` — un OR — y el
   * backend exige los dos campos. Una fila con nombre y sin URL hacía fallar el
   * POST entero con un 400.
   */
  it('descarta el similar con nombre y sin URL, que es el que producía el 400', () => {
    expect(similaresValidos([{ name: 'Trello', url: '' }])).toEqual([]);
    expect(similaresValidos([{ name: 'Trello', url: '   ' }])).toEqual([]);
  });

  it('descarta el similar con URL y sin nombre', () => {
    expect(similaresValidos([{ name: '', url: 'https://trello.com' }])).toEqual([]);
  });

  it('descarta la fila vacía que el formulario deja por defecto', () => {
    expect(similaresValidos(borradorVacio().similares)).toEqual([]);
  });

  it('descarta las URL que serían XSS en un href', () => {
    expect(similaresValidos([{ name: 'Malo', url: 'javascript:alert(1)' }])).toEqual([]);
    expect(similaresValidos([{ name: 'Peor', url: 'data:text/html,<script>' }])).toEqual([]);
    expect(similaresValidos([{ name: 'Raro', url: 'file:///etc/passwd' }])).toEqual([]);
  });

  it('conserva los que están completos y les antepone el esquema', () => {
    expect(
      similaresValidos([
        { name: 'Trello', url: '' },
        { name: 'Reveel', url: 'reveelgroup.com' },
        { name: 'Loop', url: 'https://loop.com/precios' },
      ]),
    ).toEqual([
      { name: 'Reveel', url: 'https://reveelgroup.com' },
      { name: 'Loop', url: 'https://loop.com/precios' },
    ]);
  });

  it('recorta el nombre al tope del DTO', () => {
    const [uno] = similaresValidos([{ name: 'N'.repeat(300), url: 'https://ejemplo.com' }]);
    expect(uno.name.length).toBeLessThanOrEqual(LIMITES.similarNombre);
  });
});

describe('esUrlValida', () => {
  it('acepta http, https y dominio suelto', () => {
    expect(esUrlValida('https://ejemplo.com')).toBe(true);
    expect(esUrlValida('http://ejemplo.com/ruta')).toBe(true);
    expect(esUrlValida('ejemplo.com')).toBe(true);
  });

  it('no confunde un puerto con un esquema', () => {
    expect(esUrlValida('ejemplo.com:8080/panel')).toBe(true);
  });

  it('rechaza lo vacío, lo que no tiene dominio y los protocolos peligrosos', () => {
    expect(esUrlValida('')).toBe(false);
    expect(esUrlValida('   ')).toBe(false);
    expect(esUrlValida('localhost')).toBe(false);
    expect(esUrlValida('no es una url')).toBe(false);
    expect(esUrlValida('javascript:alert(1)')).toBe(false);
  });

  it('rechaza una URL que no cabe en el DTO', () => {
    expect(esUrlValida(`https://ejemplo.com/${'a'.repeat(LIMITES.similarUrl)}`)).toBe(false);
  });
});

describe('normalizarSector', () => {
  it('deja pasar los valores exactos del select', () => {
    expect(normalizarSector('Logística')).toBe('Logística');
    expect(normalizarSector('Retail / E-commerce')).toBe('Retail / E-commerce');
  });

  it('recupera el valor cuando difiere en tildes o mayúsculas', () => {
    // Sin esto el <select> no muestra nada y parece que el campo quedó vacío.
    expect(normalizarSector('logistica')).toBe('Logística');
    expect(normalizarSector('EDUCACION')).toBe('Educación');
  });

  it('cae en Otro ante lo que no está en la lista', () => {
    expect(normalizarSector('Agro')).toBe('Otro');
    expect(normalizarSector('')).toBe('Otro');
    expect(normalizarSector(null)).toBe('Otro');
    expect(normalizarSector(42)).toBe('Otro');
  });
});

describe('recortar', () => {
  it('no toca lo que ya cabe', () => {
    expect(recortar('corto', 10)).toBe('corto');
  });

  it('corta en límite de palabra', () => {
    expect(recortar('uno dos tres cuatro', 15)).toBe('uno dos tres');
  });

  it('nunca deja media pareja de surrogates', () => {
    const salida = recortar('😀😀😀', 3);
    expect(salida.length).toBe(2);
    expect(salida).toBe('😀');
  });
});

describe('validarBorrador', () => {
  it('acepta un borrador completo', () => {
    expect(validarBorrador(completo())).toBeNull();
  });

  it('exige nombre de al menos dos caracteres, sector y problema', () => {
    expect(validarBorrador(completo({ nombre: ' x ' }))).toContain('dos caracteres');
    expect(validarBorrador(completo({ sector: '' }))).toContain('sector');
    expect(validarBorrador(completo({ problema: '  ' }))).toContain('problema');
  });

  it('avisa por la fila a medio llenar en vez de descartarla en silencio', () => {
    // Si la persona escribió el nombre, quiere que ese similar quede guardado:
    // tirarlo sin decir nada la deja creyendo que se guardó.
    const salida = validarBorrador(completo({ similares: [{ name: 'Trello', url: '' }] }));
    expect(salida).toContain('Trello');
    expect(salida).toContain('URL');
  });

  it('avisa cuando la URL escrita no es válida', () => {
    const salida = validarBorrador(completo({ similares: [{ name: 'Trello', url: 'no-es-url' }] }));
    expect(salida).toContain('no es válida');
  });

  it('no se queja de la fila del todo vacía', () => {
    expect(validarBorrador(completo({ similares: [{ name: '', url: '' }] }))).toBeNull();
  });
});

describe('aNuevoProyecto', () => {
  it('arma el body con estado idea y sin campos de más', () => {
    const body = aNuevoProyecto(completo({ groupId: 'g-1' }));

    expect(body.estado).toBe('idea');
    expect(body.groupId).toBe('g-1');
    expect(Object.keys(body).sort()).toEqual([
      'cliente',
      'dolores',
      'estado',
      'groupId',
      'nombre',
      'plusIA',
      'problema',
      'sector',
      'similares',
      'solucion',
      'tipoPrestacion',
    ]);
  });

  it('manda tipoPrestacion en null y no lo omite', () => {
    // Omitirlo y mandarlo null no son lo mismo para el servidor: null es lo que
    // devuelve un proyecto a "sin clasificar" al editarlo. Si el campo
    // desapareciera del body, editar nunca podría quitar el tipo.
    const body = aNuevoProyecto(completo({ tipoPrestacion: null }));

    expect('tipoPrestacion' in body).toBe(true);
    expect(body.tipoPrestacion).toBeNull();
  });

  it('recorta el cliente al tope del servidor', () => {
    const body = aNuevoProyecto(completo({ cliente: '  ' + 'C'.repeat(500) + '  ' }));
    expect(body.cliente!.length).toBeLessThanOrEqual(LIMITES.cliente);
  });

  it('nunca emite un campo por encima de los LIMITES', () => {
    // El maxlength del HTML no aplica a valores puestos por código, así que un
    // texto largo que venga de la IA llegaría entero al POST sin este recorte.
    const body = aNuevoProyecto(
      completo({
        nombre: 'N'.repeat(500),
        cliente: 'C'.repeat(500),
        problema: 'p '.repeat(5000),
        dolores: 'd'.repeat(9000),
        solucion: 's '.repeat(5000),
        plusIA: 'x'.repeat(9000),
      }),
    );

    expect(body.nombre!.length).toBeLessThanOrEqual(LIMITES.nombre);
    expect(body.cliente!.length).toBeLessThanOrEqual(LIMITES.cliente);
    expect(body.problema!.length).toBeLessThanOrEqual(LIMITES.texto);
    expect(body.dolores!.length).toBeLessThanOrEqual(LIMITES.texto);
    expect(body.solucion!.length).toBeLessThanOrEqual(LIMITES.texto);
    expect(body.plusIA!.length).toBeLessThanOrEqual(LIMITES.texto);
  });

  it('recorta los espacios de todos los campos', () => {
    const body = aNuevoProyecto(completo({ nombre: '  FreightAudit  ', problema: ' hola ' }));
    expect(body.nombre).toBe('FreightAudit');
    expect(body.problema).toBe('hola');
  });

  it('hereda el arreglo del OR: la fila a medias no viaja', () => {
    const body = aNuevoProyecto(
      completo({
        similares: [
          { name: 'Trello', url: '' },
          { name: 'Reveel', url: 'https://reveelgroup.com' },
        ],
      }),
    );
    expect(body.similares).toEqual([{ name: 'Reveel', url: 'https://reveelgroup.com' }]);
  });
});
