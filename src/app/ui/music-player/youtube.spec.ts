import { leerFuente, portadaDe } from './youtube';

describe('leerFuente', () => {
  it('reconoce un video en las formas que reparte YouTube', () => {
    const esperado = { tipo: 'video', id: 'dQw4w9WgXcQ' };
    const enlaces = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=30',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'youtube.com/embed/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ];

    for (const enlace of enlaces) {
      expect(leerFuente(enlace)).toMatchObject(esperado);
    }
  });

  it('reconoce una playlist', () => {
    expect(leerFuente('https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'))
      .toMatchObject({ tipo: 'lista', id: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' });
  });

  it('cuando el enlace trae video y lista, gana la lista', () => {
    // Es lo que la persona espera al pegar una playlist desde YouTube Music.
    expect(leerFuente('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ'))
      .toMatchObject({ tipo: 'lista', id: 'RDAMVMdQw4w9WgXcQ' });
  });

  it('rechaza lo que no es de YouTube', () => {
    expect(leerFuente('https://open.spotify.com/track/abc')).toBeNull();
    expect(leerFuente('hola mundo')).toBeNull();
    expect(leerFuente('')).toBeNull();
  });

  it('rechaza un dominio que imita a YouTube', () => {
    // Sin esta comprobación, cualquier host podría colar un id y terminar
    // cargándose dentro del iframe de la plataforma.
    expect(leerFuente('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(leerFuente('https://youtube.com.evil.net/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('portadaDe', () => {
  it('arma la miniatura del video', () => {
    expect(portadaDe('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});
