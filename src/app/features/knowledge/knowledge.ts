import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiService, SearchResult } from '../../core/ai.service';

@Component({
  selector: 'app-knowledge',
  imports: [FormsModule, RouterLink],
  templateUrl: './knowledge.html',
  styleUrl: './knowledge.scss',
})
export class Knowledge {
  private ai = inject(AiService);

  query = signal('');
  results = signal<SearchResult[] | null>(null);
  protected ejemplos = [
    '¿Qué hemos hecho con automatización logística?',
    'inventario multicanal en retail',
    'apelaciones de reclamaciones en salud',
  ];

  buscar(): void {
    if (!this.query().trim()) { this.results.set([]); return; }
    this.results.set(this.ai.search(this.query()));
  }
  usarEjemplo(q: string): void { this.query.set(q); this.buscar(); }
  pct(n: number): number { return Math.round(n * 100); }
}
