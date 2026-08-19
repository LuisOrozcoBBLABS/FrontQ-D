import { Injectable, computed, signal } from '@angular/core';
import { Project } from './models';

const STORAGE_KEY = 'plataforma-id.projects';

const SEED: Project[] = [
  {
    id: 'p-freight', nombre: 'FreightAudit', sector: 'Logística',
    problema: 'Las facturas de transportistas traen errores que casi nadie revisa.',
    dolores: 'Sobrecargos por tarifa mal aplicada; cargos duplicados; entregas tardías reembolsables que nunca se reclaman.',
    solucion: 'Cruza cada factura contra la tarifa contratada y la entrega real, detecta el error y genera la reclamación.',
    similares: [
      { name: 'Reveel', url: 'https://reveelgroup.com' },
      { name: 'Sifted', url: 'https://sifted.com' },
    ],
    plusIA: 'Lectura con IA de facturas en PDF y contratos; predicción de zonas con más sobrecargos; priorización de reclamaciones por monto y probabilidad de éxito.',
    grupo: 'Manglar', autorId: 'u-ana', estado: 'evaluacion', createdAt: '2026-06-10T10:00:00.000Z',
    enriquecido: true, score: 82,
  },
  {
    id: 'p-stock', nombre: 'StockSync', sector: 'Retail / E-commerce',
    problema: 'Vender el mismo producto en varios canales sin inventario sincronizado.',
    dolores: 'Sobreventa y cancelaciones; riesgo de suspensión de cuenta; actualización manual lenta.',
    solucion: 'Sincroniza el inventario en tiempo real entre Shopify, Amazon y MercadoLibre.',
    similares: [{ name: 'Linnworks', url: 'https://www.linnworks.com' }],
    plusIA: 'Pronóstico de quiebres antes de que ocurran e integración nativa con MercadoLibre.',
    grupo: 'Delta', autorId: 'u-carlos', estado: 'idea', createdAt: '2026-06-22T14:00:00.000Z',
    enriquecido: false,
  },
];

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly _projects = signal<Project[]>(this.load());
  readonly projects = this._projects.asReadonly();
  readonly count = computed(() => this._projects().length);

  private load(): Project[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Project[];
    } catch { /* ignore */ }
    return structuredClone(SEED);
  }
  private persist(list: Project[]): void {
    this._projects.set(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }

  byId(id: string): Project | undefined { return this._projects().find(p => p.id === id); }

  create(data: Omit<Project, 'id' | 'createdAt'>): Project {
    const project: Project = { ...data, id: 'p-' + Math.random().toString(36).slice(2, 9), createdAt: new Date().toISOString() };
    this.persist([project, ...this._projects()]);
    return project;
  }
  update(id: string, patch: Partial<Project>): void {
    this.persist(this._projects().map(p => (p.id === id ? { ...p, ...patch } : p)));
  }
  remove(id: string): void { this.persist(this._projects().filter(p => p.id !== id)); }
  resetSeed(): void { this.persist(structuredClone(SEED)); }
}
