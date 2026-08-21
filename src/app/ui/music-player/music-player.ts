import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Fuente,
  YTPlayer,
  YT_ESTADO,
  cargarApiYoutube,
  leerFuente,
  portadaDe,
} from './youtube';

type Vista = 'orbe' | 'compacto' | 'abierto';

interface EstadoGuardado {
  fuentes: Fuente[];
  volumen: number;
  vista: Vista;
}

const CLAVE = 'plataforma-id.reproductor';
const MAX_FUENTES = 8;

/**
 * Reproductor de YouTube que vive en una esquina del área de trabajo.
 *
 * Tres decisiones que conviene conocer antes de tocarlo:
 *
 * 1. El iframe nunca se destruye ni se saca del DOM al minimizar; solo cambia
 *    de tamaño. Si se recreara, la música se cortaría en cada cambio de vista.
 * 2. El reproductor queda siempre visible mientras suena. Los términos de la
 *    API de YouTube no permiten ocultarlo, así que no hay un "modo solo audio":
 *    cerrar el panel detiene la reproducción.
 * 3. La portada del video hace de fondo difuminado del cristal. Es lo que le da
 *    color al panel y cambia con cada pista.
 */
@Component({
  selector: 'app-music-player',
  imports: [FormsModule],
  templateUrl: './music-player.html',
  styleUrl: './music-player.scss',
})
export class MusicPlayer {
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPlayer = viewChild.required<ElementRef<HTMLDivElement>>('hostPlayer');

  private player: YTPlayer | null = null;
  private cronometro: number | null = null;

  protected readonly vista = signal<Vista>('orbe');
  protected readonly fuentes = signal<Fuente[]>([]);
  protected readonly fuenteActual = signal<Fuente | null>(null);
  protected readonly entrada = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);

  protected readonly sonando = signal(false);
  protected readonly titulo = signal('');
  protected readonly autor = signal('');
  protected readonly videoId = signal('');
  protected readonly volumen = signal(70);
  protected readonly progreso = signal(0);
  protected readonly transcurrido = signal(0);
  protected readonly duracion = signal(0);

  /** Portada de lo que suena; sin ella el panel queda en cristal neutro. */
  protected readonly portada = computed(() => (this.videoId() ? portadaDe(this.videoId()) : null));
  protected readonly enLista = computed(() => this.fuenteActual()?.tipo === 'lista');
  protected readonly progresoEntero = computed(() => Math.round(this.progreso()));

  constructor() {
    this.recuperar();
    this.destroyRef.onDestroy(() => this.detenerCronometro());
  }

  // ------------------------------------------------------------ persistencia
  private recuperar(): void {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return;
      const datos = JSON.parse(crudo) as Partial<EstadoGuardado>;
      if (Array.isArray(datos.fuentes)) this.fuentes.set(datos.fuentes.slice(0, MAX_FUENTES));
      if (typeof datos.volumen === 'number') this.volumen.set(Math.min(100, Math.max(0, datos.volumen)));
      // La vista no se restaura sonando: el navegador no deja arrancar audio solo.
      if (datos.vista === 'compacto' || datos.vista === 'abierto') this.vista.set(datos.vista);
    } catch {
      /* Si el guardado quedó corrupto, se arranca limpio. */
    }
  }

  private guardar(): void {
    const estado: EstadoGuardado = {
      fuentes: this.fuentes(),
      volumen: this.volumen(),
      vista: this.vista() === 'orbe' ? 'orbe' : this.vista(),
    };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch {
      /* Sin espacio en localStorage el reproductor sigue funcionando. */
    }
  }

  // ----------------------------------------------------------------- vistas
  protected abrir(): void {
    this.vista.set('abierto');
    this.guardar();
  }

  protected minimizar(): void {
    this.vista.set('compacto');
    this.guardar();
  }

  /** Cerrar detiene: no queda audio sonando desde un panel que ya no se ve. */
  protected cerrar(): void {
    this.player?.pauseVideo();
    this.sonando.set(false);
    this.detenerCronometro();
    this.vista.set('orbe');
    this.guardar();
  }

  // --------------------------------------------------------------- fuentes
  protected agregar(): void {
    const fuente = leerFuente(this.entrada());
    if (!fuente) {
      this.error.set('Ese enlace no es de YouTube. Pegá una canción o una playlist.');
      return;
    }
    this.error.set(null);
    this.entrada.set('');

    const sinRepetir = this.fuentes().filter(f => !(f.id === fuente.id && f.tipo === fuente.tipo));
    this.fuentes.set([fuente, ...sinRepetir].slice(0, MAX_FUENTES));
    this.guardar();
    void this.reproducir(fuente);
  }

  protected quitar(fuente: Fuente, evento: Event): void {
    evento.stopPropagation();
    this.fuentes.set(this.fuentes().filter(f => !(f.id === fuente.id && f.tipo === fuente.tipo)));
    this.guardar();
  }

  protected etiqueta(f: Fuente): string {
    if (f.nombre && !f.nombre.startsWith('http')) return f.nombre;
    return f.tipo === 'lista' ? 'Playlist' : 'Canción';
  }

  // ------------------------------------------------------------ reproducción
  protected async reproducir(fuente: Fuente): Promise<void> {
    this.fuenteActual.set(fuente);
    this.error.set(null);
    this.cargando.set(true);

    try {
      const player = await this.asegurarPlayer();
      if (fuente.tipo === 'lista') {
        player.cuePlaylist({ list: fuente.id, listType: 'playlist' });
      } else {
        player.cueVideoById(fuente.id);
      }
      player.setVolume(this.volumen());
      player.playVideo();
    } catch {
      this.error.set('No se pudo iniciar el reproductor de YouTube.');
      this.cargando.set(false);
    }
  }

  private async asegurarPlayer(): Promise<YTPlayer> {
    if (this.player) return this.player;

    const api = await cargarApiYoutube();
    this.player = new api.Player(this.hostPlayer().nativeElement, {
      width: '100%',
      height: '100%',
      playerVars: {
        // Sin controles nativos: los de la plataforma manejan todo.
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
      },
      events: {
        onReady: e => {
          e.target.setVolume(this.volumen());
        },
        onStateChange: e => this.alCambiarEstado(e.data),
        onError: () => {
          this.cargando.set(false);
          this.error.set('YouTube no permite reproducir eso acá. Probá con otro enlace.');
        },
      },
    });
    return this.player;
  }

  private alCambiarEstado(estado: number): void {
    this.sonando.set(estado === YT_ESTADO.reproduciendo);
    if (estado === YT_ESTADO.reproduciendo || estado === YT_ESTADO.pausado) {
      this.cargando.set(false);
      this.leerPista();
    }
    if (estado === YT_ESTADO.reproduciendo) this.arrancarCronometro();
    else this.detenerCronometro();
    if (estado === YT_ESTADO.terminado && !this.enLista()) this.progreso.set(0);
  }

  /** Toma título, autor y portada de lo que está sonando ahora. */
  private leerPista(): void {
    const datos = this.player?.getVideoData();
    if (!datos) return;
    this.titulo.set(datos.title);
    this.autor.set(datos.author);
    this.videoId.set(datos.video_id);

    // La fuente guardada pasa de mostrar la URL a mostrar el nombre real.
    const actual = this.fuenteActual();
    if (actual && actual.nombre.startsWith('http')) {
      const nombre = actual.tipo === 'lista' ? `Playlist · ${datos.author}` : datos.title;
      const renombrada: Fuente = { ...actual, nombre };
      this.fuenteActual.set(renombrada);
      this.fuentes.set(
        this.fuentes().map(f => (f.id === actual.id && f.tipo === actual.tipo ? renombrada : f)),
      );
      this.guardar();
    }
  }

  private arrancarCronometro(): void {
    this.detenerCronometro();
    this.cronometro = window.setInterval(() => {
      if (!this.player) return;
      const total = this.player.getDuration();
      const actual = this.player.getCurrentTime();
      this.duracion.set(total);
      this.transcurrido.set(actual);
      this.progreso.set(total > 0 ? (actual / total) * 100 : 0);
    }, 500);
  }

  private detenerCronometro(): void {
    if (this.cronometro !== null) {
      clearInterval(this.cronometro);
      this.cronometro = null;
    }
  }

  // ------------------------------------------------------------- controles
  protected alternar(): void {
    if (!this.player) {
      const primera = this.fuentes()[0];
      if (primera) void this.reproducir(primera);
      return;
    }
    if (this.sonando()) this.player.pauseVideo();
    else this.player.playVideo();
  }

  protected siguiente(): void {
    this.player?.nextVideo();
  }

  protected anterior(): void {
    this.player?.previousVideo();
  }

  protected cambiarVolumen(evento: Event): void {
    const v = Number((evento.target as HTMLInputElement).value);
    this.volumen.set(v);
    this.player?.setVolume(v);
    this.guardar();
  }

  protected reloj(segundos: number): string {
    if (!Number.isFinite(segundos) || segundos <= 0) return '0:00';
    const m = Math.floor(segundos / 60);
    const s = Math.floor(segundos % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
