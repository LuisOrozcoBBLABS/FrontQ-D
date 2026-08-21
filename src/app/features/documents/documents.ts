import { Component } from '@angular/core';

/**
 * Documentos — módulo anunciado, todavía sin funcionalidad.
 *
 * La idea: subir PDF y DOCX, extraer su contenido y que la IA proponga
 * proyectos a partir de eso. Por ahora la pantalla solo anuncia el módulo, sin
 * simular nada: no hay carga de archivos ni resultados de mentira.
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
      texto: 'PDF o DOCX: una convocatoria, un acta, un informe, un pliego.',
    },
    {
      n: '02',
      titulo: 'Se extrae el contenido',
      texto: 'Texto, tablas y campos clave quedan estructurados y legibles.',
    },
    {
      n: '03',
      titulo: 'La IA propone proyectos',
      texto: 'Del documento salen ideas con problema, solución y diferencial.',
    },
  ];
}
