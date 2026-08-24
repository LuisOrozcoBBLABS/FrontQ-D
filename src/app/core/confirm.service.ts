import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/**
 * Confirmación antes de una acción destructiva.
 *
 * Por dentro es el ConfirmationService de PrimeNG y en pantalla lo pinta
 * <p-confirmdialog>. Se mantiene la firma que ya usaban los componentes
 * (`await confirm.ask({...})` devuelve un booleano): una promesa se lee mucho
 * mejor dentro del flujo de un método que un par de callbacks sueltos.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly confirmacion = inject(ConfirmationService);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      let resuelto = false;
      const responder = (valor: boolean): void => {
        if (resuelto) return;
        resuelto = true;
        resolve(valor);
      };

      this.confirmacion.confirm({
        header: opts.title,
        message: opts.message,
        icon: opts.danger ? 'pi pi-exclamation-triangle' : 'pi pi-question-circle',
        acceptLabel: opts.confirmText ?? 'Confirmar',
        rejectLabel: opts.cancelText ?? 'Cancelar',
        acceptButtonStyleClass: opts.danger ? 'p-button-danger' : '',
        rejectButtonStyleClass: 'p-button-text',
        accept: () => responder(true),
        // reject cubre las tres salidas: el botón de cancelar, Escape y el
        // clic fuera del diálogo. Por eso `responder` ignora el segundo aviso.
        reject: () => responder(false),
      });
    });
  }
}
