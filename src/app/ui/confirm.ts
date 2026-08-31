import { Component } from '@angular/core';
import { ConfirmDialog } from 'primeng/confirmdialog';

/**
 * Anclaje del diálogo de confirmación. Lo abre ConfirmService; este componente
 * solo lo monta una vez en el árbol de la aplicación.
 */
@Component({
  selector: 'app-confirm',
  imports: [ConfirmDialog],
  template: `<p-confirmdialog [style]="{ width: 'min(94vw, 460px)' }" />`,
})
export class Confirm {}
