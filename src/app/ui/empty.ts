import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty',
  template: `
    <div class="empty">
      <span class="empty__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
      </span>
      <p class="empty__title">{{ title() }}</p>
      @if (hint()) { <p class="empty__hint">{{ hint() }}</p> }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
      border: 1px dashed var(--line-strong); border-radius: var(--r-lg); background: var(--surface);
      padding: 44px 24px; }
    .empty__icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 999px;
      background: var(--surface-2); color: var(--text-dim); margin-bottom: 6px; }
    .empty__icon svg { width: 24px; height: 24px; }
    .empty__title { font-family: var(--font-display); font-weight: 500; font-size: 17px; color: var(--text); }
    .empty__hint { color: var(--text-2); font-size: 14px; max-width: 42ch; }
    .empty ::ng-deep .btn, .empty .btn { margin-top: 10px; }
  `],
})
export class Empty {
  title = input('Sin datos');
  hint = input('');
}
