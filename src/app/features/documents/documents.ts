import { Component } from '@angular/core';

/**
 * Documentos — módulo anunciado, todavía sin funcionalidad.
 *
 * La idea: dejar de cargar proyectos a mano. Si el proyecto ya está escrito en
 * un PDF o un DOCX, se sube el archivo, la IA lo lee y crea el proyecto con
 * esos datos, mapeados a los campos del formulario.
 *
 * Por ahora la pantalla solo anuncia el módulo, sin simular nada: no hay carga
 * de archivos ni resultados de mentira.
 */
@Component({
  selector: 'app-documents',
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class Documents {
  protected readonly pasos = [
    {
      n: '01',
      titulo: 'Subís el documento',
      texto: 'El PDF o el DOCX donde ya está escrito el proyecto.',
    },
    {
      n: '02',
      titulo: 'La IA lo lee y lo mapea',
      texto: 'Reconoce nombre, sector, problema, dolores, solución y diferencial.',
    },
    {
      n: '03',
      titulo: 'Revisás y queda creado',
      texto: 'Corregís lo que haga falta y el proyecto entra a la plataforma.',
    },
  ];
}
