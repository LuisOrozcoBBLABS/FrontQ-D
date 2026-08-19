import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
interface ConfirmState { opts: ConfirmOptions; resolve: (v: boolean) => void; }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => this.state.set({ opts, resolve }));
  }
  respond(value: boolean): void {
    const s = this.state();
    if (s) { s.resolve(value); this.state.set(null); }
  }
}
