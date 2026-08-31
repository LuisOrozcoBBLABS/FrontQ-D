import { Component, computed, input, output } from '@angular/core';
import { PRIORIDADES, Project, prestacionLabel } from '../../core/models';
import { alertaEtapa, diasEnEtapa, diasTotales, humanoCorto, motivoAlerta } from '../../core/tiempos';

/**
 * Tarjeta compacta del tablero. Solo presenta: no pide datos ni guarda nada,
 * para que arrastrar cientos de ellas no cueste.
 */
@Component({
  selector: 'app-project-card',
  templateUrl: './project-card.html',
  styleUrl: './project-card.scss',
  host: { class: 'tarjeta-host' },
})
export class ProjectCard {
  readonly proyecto = input.required<Project>();
  /** False cuando el servidor no dejaría moverla: no es autor ni admin. */
  readonly movible = input<boolean>(true);
  /** Prioridad de la asignación propia. Null si no hay asignación. */
  readonly prioridad = input<string | null>(null);
  readonly seleccionada = input<boolean>(false);

  readonly abrir = output<Project>();
  /**
   * Pedido de mover una columna a la izquierda (-1) o a la derecha (+1).
   *
   * Existe porque @angular/cdk NO implementa arrastre por teclado: `cdkDrag`
   * escucha mousedown y touchstart, y nada mas. Sin esto, mover una tarjeta era
   * imposible con teclado, con conmutador, con control por voz y con lector de
   * pantalla — una funcionalidad entera perdida, no una molestia.
   */
  readonly mover = output<-1 | 1>();

  /**
   * Ctrl/Cmd + flecha mueve de columna. Lleva modificador a proposito: las
   * flechas solas ya desplazan la pista horizontal del tablero, y robarselas
   * romperia la navegacion de quien solo quiere mirar.
   */
  protected tecla(e: KeyboardEvent): void {
    if (!this.movible()) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.mover.emit(e.key === 'ArrowRight' ? 1 : -1);
  }

  protected diasEtapa = computed(() => diasEnEtapa(this.proyecto()));
  protected diasTotal = computed(() => diasTotales(this.proyecto()));
  protected alerta = computed(() => alertaEtapa(this.proyecto()));
  protected motivo = computed(() => motivoAlerta(this.proyecto()));

  /** El responsable ejecuta; el autor solo registró la idea. */
  protected responsable = computed(() => {
    const p = this.proyecto();
    return p.responsables?.[0] ?? p.autorNombre ?? null;
  });

  protected otros = computed(() => Math.max(0, (this.proyecto().responsables?.length ?? 0) - 1));

  protected corto = humanoCorto;

  protected prioridadLabel = computed(() => {
    const p = this.prioridad();
    return p ? (PRIORIDADES.find(x => x.value === p)?.label ?? p) : null;
  });

  /**
   * "Talento · Bancolombia", con lo que haya. Devuelve null cuando el proyecto
   * no tiene ninguno de los dos: la línea no se pinta y la tarjeta no crece.
   */
  protected prestacionYCliente = computed(() => {
    const p = this.proyecto();
    const partes = [
      p.tipoPrestacion ? prestacionLabel(p.tipoPrestacion) : null,
      p.cliente || null,
    ].filter((x): x is string => !!x);
    return partes.length ? partes.join(' · ') : null;
  });

  protected iniciales(nombre: string): string {
    return nombre.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  /** Fecha de inicio en formato corto: en una tarjeta no cabe más. */
  protected inicio = computed(() => {
    const t = Date.parse(this.proyecto().createdAt);
    if (Number.isNaN(t)) return null;
    return new Date(t).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  });

  protected titulo = computed(() => {
    const p = this.proyecto();
    // El texto decia "solo el autor o un administrador", pero quien la tiene
    // asignada tambien puede moverla: el mensaje mentia justo a la persona que
    // mas lo iba a leer.
    return this.movible()
      ? `${p.nombre} — Ctrl + flecha para moverla de columna`
      : `${p.nombre} — solo quien lo registró, quien lo tiene a cargo o un administrador puede moverlo`;
  });
}
