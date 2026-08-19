import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" (click)="toasts.dismiss(t.id)" role="status">
          @if (t.kind === 'success') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          } @else if (t.kind === 'error') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          }
          <span>{{ t.text }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toasts { position: fixed; right: calc(16px + env(safe-area-inset-right,0px)); bottom: calc(16px + env(safe-area-inset-bottom,0px));
      z-index: 120; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; pointer-events: none; }
    .toast { pointer-events: auto; cursor: pointer; display: flex; align-items: center; gap: 11px;
      background: var(--surface); border: 1px solid var(--line-strong); border-left: 3px solid var(--accent);
      border-radius: var(--r-md); box-shadow: var(--shadow-lg); padding: 12px 16px; color: var(--text);
      font-size: 14px; max-width: min(92vw, 360px); animation: toastIn 240ms var(--ease) both; }
    .toast svg { width: 17px; height: 17px; color: var(--accent); flex: 0 0 auto; }
    @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `],
})
export class Toasts {
  protected toasts = inject(ToastService);
}
