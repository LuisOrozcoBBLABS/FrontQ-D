import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

export type ToastKind = 'success' | 'info' | 'error';

/**
 * Avisos de la aplicación.
 *
 * Por dentro es el MessageService de PrimeNG y en pantalla lo pinta <p-toast>.
 * La API pública no cambió al migrar: los diez componentes que llaman
 * `toast.success(...)` siguen igual, y si mañana cambia la librería vuelve a
 * cambiar solo este archivo.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = inject(MessageService);

  private static readonly SEVERIDAD: Record<ToastKind, string> = {
    success: 'success',
    info: 'info',
    error: 'error',
  };

  show(text: string, kind: ToastKind = 'success'): void {
    this.messages.add({
      severity: ToastService.SEVERIDAD[kind],
      detail: text,
      // Un error se lee más lento que una confirmación.
      life: kind === 'error' ? 5000 : 3200,
    });
  }

  success(text: string): void { this.show(text, 'success'); }
  info(text: string): void { this.show(text, 'info'); }
  error(text: string): void { this.show(text, 'error'); }

  /** Cierra todos los avisos en pantalla. */
  clear(): void { this.messages.clear(); }
}
