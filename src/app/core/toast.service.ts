import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';
export interface Toast { id: number; text: string; kind: ToastKind; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;

  show(text: string, kind: ToastKind = 'success'): void {
    const id = ++this.n;
    this.toasts.update(list => [...list, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), 3200);
  }
  success(text: string): void { this.show(text, 'success'); }
  info(text: string): void { this.show(text, 'info'); }
  error(text: string): void { this.show(text, 'error'); }
  dismiss(id: number): void { this.toasts.update(list => list.filter(t => t.id !== id)); }
}
