import { Injectable, inject, signal } from '@angular/core';
import { Enrichment, Project } from './models';
import { ProjectsService } from './projects.service';

/* =============================================================
   AiService — TODO SIMULADO (determinista, sin llamadas reales).
   En producción: Claude API / Ollama + pgvector (RAG) + n8n.
   ============================================================= */

const STOP = new Set(['de','la','el','en','y','a','los','las','un','una','que','con','para','por','del','se','su','al','o','como','mas','sin','sus','es','the','of','to','and']);

function tokens(s: string): string[] {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}
function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
  return inter / new Set([...A, ...B]).size;
}
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(id: string, salt: string, min: number, max: number): number { return min + (hash(id + salt) % 1000) / 1000 * (max - min); }
function clamp(n: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, Math.round(n))); }
function projText(p: Project): string { return [p.nombre, p.sector, p.problema, p.dolores, p.solucion, p.plusIA].join(' '); }

export interface ScoreBreakdown { criterio: string; valor: number; }
export interface ProjectScore { total: number; criterios: ScoreBreakdown[]; }
export interface DupMatch { project: Project; similitud: number; }
export interface AgentEval { area: string; veredicto: 'Favorable' | 'Con reservas' | 'En contra'; score: number; comentario: string; recomendacion: string; }
export interface CommitteeReport { agentes: AgentEval[]; consolidado: { recomendacion: string; score: number; resumen: string }; }
export interface DocSection { h: string; body: string; }
export interface GeneratedDoc { plantilla: string; titulo: string; secciones: DocSection[]; }
export interface Opportunity { id: string; titulo: string; fuente: string; patron: string; area: string; impacto: number; sectorSugerido: string; }
export interface SearchResult { project: Project; relevancia: number; snippet: string; }

export const PLANTILLAS = ['Business Case', 'Project Charter', 'Lean Canvas', 'Business Model Canvas', 'Informe ejecutivo'] as const;

@Injectable({ providedIn: 'root' })
export class AiService {
  private projects = inject(ProjectsService);

  /** Borrador para prellenar el formulario desde una oportunidad. */
  readonly draft = signal<Partial<Project> | null>(null);

  /* -------- #1 Enriquecimiento -------- */
  enrich(p: Project): Enrichment {
    const foco = p.problema.split(/[.;]/)[0].trim().toLowerCase() || 'el problema del sector';
    return {
      objetivo: `Reducir el impacto de ${foco} en ${p.sector} mediante ${p.nombre}, con resultados medibles en el primer trimestre.`,
      beneficios: [
        `Menos pérdidas asociadas a ${foco}.`,
        `Automatización que libera tiempo del equipo de ${p.sector}.`,
        `Ventaja frente a las apps del mercado gracias al PLUS con IA.`,
      ],
      riesgos: [
        'Calidad y disponibilidad de los datos de entrada.',
        'Integración con los sistemas existentes.',
        'Adopción por parte de los usuarios finales.',
      ],
      areas: [p.sector, 'Tecnología / Datos', 'Operaciones'],
      kpis: [
        `% de reducción de ${foco}`,
        'Horas/mes ahorradas por automatización',
        'Retorno estimado (ROI) a 6 meses',
      ],
      impacto: clamp(60 + seeded(p.id, 'imp', -8, 32)),
      viabilidad: clamp(58 + seeded(p.id, 'via', -10, 30)),
    };
  }

  /* -------- #3 Score de innovación -------- */
  score(p: Project): ProjectScore {
    const rich = (p.solucion.length + p.plusIA.length) / 20;
    const criterios: ScoreBreakdown[] = [
      { criterio: 'Impacto esperado', valor: clamp(55 + Math.min(30, rich) + seeded(p.id, 'i', -6, 12)) },
      { criterio: 'Costo (menor es mejor)', valor: clamp(70 - seeded(p.id, 'c', 0, 40)) },
      { criterio: 'Complejidad técnica (manejable)', valor: clamp(75 - Math.min(30, p.plusIA.length / 12) - seeded(p.id, 'k', 0, 15)) },
      { criterio: 'Riesgo (menor es mejor)', valor: clamp(72 - seeded(p.id, 'r', 0, 35)) },
      { criterio: 'Alineación estratégica', valor: clamp(62 + seeded(p.id, 'a', -5, 30)) },
      { criterio: 'ROI estimado', valor: clamp(58 + seeded(p.id, 'roi', -8, 34)) },
    ];
    const total = clamp(criterios.reduce((s, c) => s + c.valor, 0) / criterios.length);
    return { total, criterios };
  }

  /* -------- #2 Detección de duplicados (búsqueda semántica) -------- */
  duplicates(text: string, excludeId?: string, umbral = 0.18): DupMatch[] {
    const q = tokens(text);
    return this.projects.projects()
      .filter(p => p.id !== excludeId)
      .map(p => ({ project: p, similitud: jaccard(q, tokens(projText(p))) }))
      .filter(m => m.similitud >= umbral)
      .sort((a, b) => b.similitud - a.similitud)
      .slice(0, 5);
  }

  /* -------- #10 Comité multiagente -------- */
  committee(p: Project): CommitteeReport {
    const base = this.score(p).total;
    const areas: { area: string; salt: string }[] = [
      { area: 'Finanzas', salt: 'fin' },
      { area: 'Tecnología', salt: 'tec' },
      { area: 'Operaciones', salt: 'ope' },
      { area: 'Riesgos', salt: 'rie' },
      { area: 'Sostenibilidad', salt: 'sos' },
    ];
    const agentes = areas.map<AgentEval>(a => {
      const s = clamp(base + seeded(p.id, a.salt, -18, 18));
      const veredicto = s >= 70 ? 'Favorable' : s >= 50 ? 'Con reservas' : 'En contra';
      return {
        area: a.area, veredicto, score: s,
        comentario: this.agentComment(a.area, p, veredicto),
        recomendacion: this.agentReco(a.area),
      };
    });
    const cScore = clamp(agentes.reduce((x, a) => x + a.score, 0) / agentes.length);
    const recomendacion = cScore >= 68 ? 'Aprobar y priorizar' : cScore >= 52 ? 'Aprobar con condiciones' : 'Revisar antes de avanzar';
    return {
      agentes,
      consolidado: {
        recomendacion, score: cScore,
        resumen: `El comité IA evaluó “${p.nombre}” desde 5 perspectivas y arroja un puntaje consolidado de ${cScore}/100. Recomendación: ${recomendacion.toLowerCase()}. La decisión final es del comité humano.`,
      },
    };
  }
  private agentComment(area: string, p: Project, v: string): string {
    const m: Record<string, string> = {
      Finanzas: `El retorno luce ${v === 'Favorable' ? 'atractivo' : 'moderado'} para ${p.sector}; conviene estimar el costo de integración.`,
      Tecnología: `La capa de IA del PLUS es viable; validar la calidad de datos y la latencia.`,
      Operaciones: `Encaja en el flujo actual con cambios ${v === 'En contra' ? 'considerables' : 'acotados'} en el proceso.`,
      Riesgos: `Riesgo ${v === 'Favorable' ? 'controlable' : 'a vigilar'}: dependencia de datos y adopción.`,
      Sostenibilidad: `Impacto operativo positivo; poca huella adicional.`,
    };
    return m[area] ?? '';
  }
  private agentReco(area: string): string {
    const m: Record<string, string> = {
      Finanzas: 'Definir un caso base con supuestos de ahorro.',
      Tecnología: 'Prototipo técnico de 2 semanas sobre datos reales.',
      Operaciones: 'Mapear el proceso actual vs. propuesto.',
      Riesgos: 'Plan de datos y consentimiento antes de escalar.',
      Sostenibilidad: 'Medir ahorro de tiempo como métrica de impacto.',
    };
    return m[area] ?? '';
  }

  /* -------- #12 Generación de documentos -------- */
  generateDoc(p: Project, plantilla: string): GeneratedDoc {
    const sc = this.score(p).total;
    const comun: Record<string, DocSection[]> = {
      'Business Case': [
        { h: 'Contexto', body: `${p.nombre} atiende un problema en ${p.sector}: ${p.problema}` },
        { h: 'Problema y dolores', body: p.dolores || '—' },
        { h: 'Solución propuesta', body: p.solucion || '—' },
        { h: 'Diferencial con IA', body: p.plusIA || '—' },
        { h: 'Beneficios esperados', body: 'Ahorro de tiempo, reducción de errores y ventaja frente a apps existentes.' },
        { h: 'Puntaje de viabilidad', body: `${sc}/100 (estimación IA).` },
      ],
      'Project Charter': [
        { h: 'Nombre del proyecto', body: p.nombre },
        { h: 'Objetivo', body: `Resolver: ${p.problema}` },
        { h: 'Alcance', body: p.solucion || '—' },
        { h: 'Sponsor / Grupo', body: p.grupo ? `Grupo ${p.grupo}` : 'Sin grupo' },
        { h: 'Riesgos', body: 'Datos, integración y adopción.' },
      ],
      'Lean Canvas': [
        { h: 'Problema', body: p.problema },
        { h: 'Segmento', body: p.sector },
        { h: 'Propuesta de valor', body: p.plusIA || p.solucion },
        { h: 'Solución', body: p.solucion },
        { h: 'Ventaja diferencial', body: 'Capa de IA no cubierta por las apps masivas.' },
      ],
      'Business Model Canvas': [
        { h: 'Propuesta de valor', body: p.plusIA || p.solucion },
        { h: 'Segmentos de cliente', body: p.sector },
        { h: 'Actividades clave', body: p.solucion },
        { h: 'Recursos clave', body: 'Datos, modelos de IA, integraciones.' },
      ],
      'Informe ejecutivo': [
        { h: 'Resumen', body: `${p.nombre} (${p.sector}) — puntaje IA ${sc}/100.` },
        { h: 'Problema', body: p.problema },
        { h: 'Recomendación', body: sc >= 68 ? 'Priorizar.' : 'Aprobar con condiciones.' },
      ],
    };
    return { plantilla, titulo: `${plantilla} · ${p.nombre}`, secciones: comun[plantilla] ?? comun['Business Case'] };
  }

  /* -------- #5 Descubrimiento de oportunidades -------- */
  opportunities(): Opportunity[] {
    return [
      { id: 'op-1', titulo: 'Reprocesos en devoluciones de e-commerce', fuente: 'PQRS', patron: '38% de las quejas del último mes mencionan demoras en devoluciones.', area: 'Operaciones', impacto: 78, sectorSugerido: 'Retail / E-commerce' },
      { id: 'op-2', titulo: 'Facturas de proveedores con errores repetidos', fuente: 'ERP', patron: 'Un mismo proveedor concentra el 22% de las diferencias.', area: 'Finanzas', impacto: 71, sectorSugerido: 'Finanzas' },
      { id: 'op-3', titulo: 'Incidentes recurrentes en el checkout móvil', fuente: 'Incidentes', patron: 'Pico de fallas los fines de semana en pagos móviles.', area: 'Tecnología', impacto: 66, sectorSugerido: 'Fintech' },
      { id: 'op-4', titulo: 'Alta rotación en un programa de formación', fuente: 'Indicadores', patron: 'Deserción sube tras la 3ª semana en cohortes nuevas.', area: 'Educación', impacto: 63, sectorSugerido: 'Educación' },
    ];
  }

  /* -------- #13 Búsqueda semántica del conocimiento -------- */
  search(query: string): SearchResult[] {
    const q = tokens(query);
    if (!q.length) return [];
    return this.projects.projects()
      .map(p => ({ project: p, relevancia: jaccard(q, tokens(projText(p))), snippet: p.problema || p.solucion || '' }))
      .filter(r => r.relevancia > 0)
      .sort((a, b) => b.relevancia - a.relevancia)
      .slice(0, 6);
  }
}
