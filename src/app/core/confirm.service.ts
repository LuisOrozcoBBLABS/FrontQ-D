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
        // Contorneado y no 'p-button-text'. Como boton de solo texto tomaba el
        // color primario del tema, que es el lima de marca: sobre el dialogo
        // claro daba 1.43:1 y era practicamente invisible. En un dialogo
        // destructivo la salida tiene que ser lo mas facil de encontrar, no lo
        // mas dificil. Contorneado le da borde y color de texto neutro, que se
        // ve en los dos temas.
        rejectButtonStyleClass: 'p-button-outlined',
        accept: () => responder(true),
        // reject cubre las tres salidas: el botón de cancelar, Escape y el
        // clic fuera del diálogo. Por eso `responder` ignora el segundo aviso.
        reject: () => responder(false),
      });
    });
  }
}
