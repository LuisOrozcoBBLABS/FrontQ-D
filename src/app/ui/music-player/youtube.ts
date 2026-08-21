/**
 * Tipos mínimos de la IFrame Player API de YouTube.
 *
 * Se declaran acá en lugar de sumar @types/youtube: son las seis llamadas que
 * el reproductor usa y así el proyecto no gana una dependencia por eso.
 */

export interface YTVideoData {
  video_id: string;
  title: string;
  author: string;
}

/** Estados que publica el reproductor en onStateChange. */
export const YT_ESTADO = {
  noIniciado: -1,
  terminado: 0,
  reproduciendo: 1,
  pausado: 2,
  cargando: 3,
  enCola: 5,
} as const;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  setVolume(volumen: number): void;
  getVolume(): number;
  getVideoData(): YTVideoData;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  cueVideoById(id: string): void;
  cuePlaylist(opciones: { list: string; listType: string; index?: number }): void;
  destroy(): void;
}

interface YTEvento<T> {
  target: YTPlayer;
  data: T;
}

export interface YTConfig {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTEvento<undefined>) => void;
    onStateChange?: (e: YTEvento<number>) => void;
    onError?: (e: YTEvento<number>) => void;
  };
}

interface YTApi {
  Player: new (elemento: HTMLElement, config: YTConfig) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const URL_API = 'https://www.youtube.com/iframe_api';
let promesaApi: Promise<YTApi> | null = null;

/**
 * Carga el script de la API una sola vez. La API avisa que está lista por una
 * función global, así que la promesa se comparte entre todas las llamadas.
 */
export function cargarApiYoutube(): Promise<YTApi> {
  if (window.YT) return Promise.resolve(window.YT);
  if (promesaApi) return promesaApi;

  promesaApi = new Promise<YTApi>((resolver, rechazar) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = (): void => {
      anterior?.();
      if (window.YT) resolver(window.YT);
      else rechazar(new Error('La API de YouTube cargó sin exponer YT.'));
    };

    const script = document.createElement('script');
    script.src = URL_API;
    script.async = true;
    script.onerror = (): void => rechazar(new Error('No se pudo cargar la API de YouTube.'));
    document.head.appendChild(script);
  });

  return promesaApi;
}

/** Lo que se puede reproducir: un video suelto o una lista. */
export type TipoFuente = 'video' | 'lista';

export interface Fuente {
  tipo: TipoFuente;
  /** Id de video (11 caracteres) o id de playlist. */
  id: string;
  /** Etiqueta que ve la persona. Al empezar es la URL; luego el título real. */
  nombre: string;
}

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const ID_LISTA = /^[A-Za-z0-9_-]{12,}$/;

/**
 * Reconoce las formas en que YouTube reparte una URL: youtu.be, watch, embed,
 * shorts, playlist y music.youtube.com. Si el enlace trae video y lista a la
 * vez, gana la lista: es lo que la persona espera al pegar una playlist.
 */
export function leerFuente(entrada: string): Fuente | null {
  const texto = entrada.trim();
  if (!texto) return null;

  // Un id pegado directo, sin URL alrededor.
  if (ID_VIDEO.test(texto)) return { tipo: 'video', id: texto, nombre: texto };

  let url: URL;
  try {
    url = new URL(texto.startsWith('http') ? texto : `https://${texto}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const dominios = ['youtube.com', 'music.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'];
  if (!dominios.includes(host)) return null;

  const lista = url.searchParams.get('list');
  if (lista && ID_LISTA.test(lista)) {
    return { tipo: 'lista', id: lista, nombre: texto };
  }

  const partes = url.pathname.split('/').filter(Boolean);
  const candidato =
    host === 'youtu.be'
      ? partes[0]
      : url.searchParams.get('v') ??
        (partes[0] === 'embed' || partes[0] === 'shorts' || partes[0] === 'live' ? partes[1] : undefined);

  if (candidato && ID_VIDEO.test(candidato)) {
    return { tipo: 'video', id: candidato, nombre: texto };
  }
  return null;
}

/** Portada del video, servida por YouTube. */
export function portadaDe(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
