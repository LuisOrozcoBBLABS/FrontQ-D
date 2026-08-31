import { Component, input, output, signal } from '@angular/core';
import { EXTENSIONES, validarArchivo } from '../../core/archivo';

/**
 * Zona para soltar o elegir el documento.
 *
 * Accesibilidad — acá se corrige un patrón que ya estaba en el repo:
 * profile.html usa `<input type="file" hidden>`, y `hidden` saca el input del
 * orden de tabulación, así que con teclado no hay forma de llegar al selector.
 * Este componente usa un `<label>` que envuelve un input con `.sr-only`
 * (técnica de clip, no display:none), y pinta el foco con `:focus-within`
 * porque el `:focus-visible` global apuntaría a un input de 1px invisible.
 */
@Component({
  selector: 'app-doc-dropzone',
  templateUrl: './doc-dropzone.html',
  styleUrl: './doc-dropzone.scss',
})
export class DocDropzone {
  archivoElegido = output<File>();
  deshabilitado = input(false);

  protected sobre = signal(false);
  protected error = signal<string | null>(null);
  protected extensiones = EXTENSIONES.join(',');

  /**
   * Sin preventDefault el navegador no considera la zona un destino válido de
   * arrastre. Mismos nombres que los handlers del tablero de asignaciones.
   */
  protected alPasarSobre(e: DragEvent): void {
    if (this.deshabilitado()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this.sobre.set(true);
  }

  protected alSalir(): void {
    this.sobre.set(false);
  }

  protected alSoltar(e: DragEvent): void {
    e.preventDefault();
    this.sobre.set(false);
    if (this.deshabilitado()) return;

    const archivo = e.dataTransfer?.files?.[0];
    if (archivo) this.tomar(archivo);
  }

  protected alElegir(e: Event): void {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    // Hay que limpiarlo después de leer: si no, elegir el mismo archivo dos
    // veces seguidas no vuelve a disparar `change`.
    input.value = '';
    if (archivo) this.tomar(archivo);
  }

  private tomar(archivo: File): void {
    const problema = validarArchivo(archivo.name, archivo.type, archivo.size);
    this.error.set(problema);
    if (problema) return;

    this.archivoElegido.emit(archivo);
  }
}
