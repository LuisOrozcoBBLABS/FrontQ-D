import { Component, inject } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';
import { TrapFocus } from './trap-focus';

@Component({
  selector: 'app-confirm',
  imports: [TrapFocus],
  template: `
    @if (svc.state(); as s) {
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div class="modal__backdrop" (click)="svc.respond(false)"></div>
        <div class="modal__panel" style="width:min(94vw,420px)" appTrapFocus (dismiss)="svc.respond(false)">
          <h2 class="modal__title" id="confirmTitle">{{ s.opts.title }}</h2>
          <p class="text-2" style="font-size:14.5px;margin-top:8px">{{ s.opts.message }}</p>
          <div class="modal__foot">
            <button class="btn btn--ghost" type="button" (click)="svc.respond(false)">{{ s.opts.cancelText || 'Cancelar' }}</button>
            <button class="btn" [class.btn--danger]="s.opts.danger" [class.btn--primary]="!s.opts.danger" type="button" (click)="svc.respond(true)">{{ s.opts.confirmText || 'Confirmar' }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Confirm {
  protected svc = inject(ConfirmService);
}
