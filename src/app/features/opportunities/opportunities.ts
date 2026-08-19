import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AiService, Opportunity } from '../../core/ai.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-opportunities',
  templateUrl: './opportunities.html',
  styleUrl: './opportunities.scss',
})
export class Opportunities {
  private ai = inject(AiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected items = this.ai.opportunities();

  convertir(o: Opportunity): void {
    this.ai.draft.set({
      nombre: '',
      sector: o.sectorSugerido,
      problema: `${o.titulo}. ${o.patron}`,
    });
    this.toast.info('Idea prellenada desde la oportunidad');
    this.router.navigateByUrl('/proyectos/nuevo');
  }
}
