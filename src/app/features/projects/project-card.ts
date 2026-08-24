import { Component, computed, input, output } from '@angular/core';
import { PRIORIDADES, Project } from '../../core/models';
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
    return this.movible() ? p.nombre : `${p.nombre} — solo el autor o un administrador puede moverlo`;
  });
}
