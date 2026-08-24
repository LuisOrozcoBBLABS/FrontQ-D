import { Component } from '@angular/core';
import { Toast } from 'primeng/toast';

/**
 * Anclaje de los avisos. El contenido lo maneja ToastService; este componente
 * solo decide dónde aparecen y con qué ancho en pantallas chicas.
 */
@Component({
  selector: 'app-toasts',
  imports: [Toast],
  template: `
    <p-toast
      position="bottom-right"
      [breakpoints]="{ '640px': { width: '92vw', right: '4vw', left: '4vw' } }"
    />
  `,
})
export class Toasts {}
