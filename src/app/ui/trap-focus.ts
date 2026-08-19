import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject, output } from '@angular/core';

/**
 * Atrapa el foco dentro del elemento (diálogos/modales) y emite (dismiss) al pulsar Escape.
 * Devuelve el foco al elemento previo al destruirse.
 */
@Directive({ selector: '[appTrapFocus]' })
export class TrapFocus implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly dismiss = output<void>();
  private prev: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.prev = document.activeElement as HTMLElement;
    queueMicrotask(() => {
      const f = this.focusables();
      (f[0] ?? this.host.nativeElement).focus?.();
    });
  }
  ngOnDestroy(): void { this.prev?.focus?.(); }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.dismiss.emit(); return; }
    if (e.key !== 'Tab') return;
    const f = this.focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )).filter(el => el.offsetParent !== null);
  }
}
