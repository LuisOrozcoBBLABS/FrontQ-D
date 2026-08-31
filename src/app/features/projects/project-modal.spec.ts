import { Component, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth.service';
import { BorradorProyecto } from '../../core/borrador-proyecto';
import { Project } from '../../core/models';
import { NuevoProyecto, ProjectsService } from '../../core/projects.service';
import { ProjectModal } from './project-modal';

/**
 * Lo que cuida este spec es el contrato del guardado, que es donde el modal se
 * puede romper en silencio: qué viaja al servidor al crear y al editar.
 */

const YO = { id: 'u1', groupId: 'g1' };

function proyecto(patch: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    nombre: 'FreightAudit',
    sector: 'Logística',
    cliente: 'Bancolombia',
    tipoPrestacion: 'talento',
    problema: 'Las facturas se auditan a mano.',
    dolores: '',
    solucion: '',
    plusIA: '',
    similares: [],
    grupo: null,
    groupId: 'g1',
    autorId: YO.id,
    estado: 'desarrollo',
    createdAt: new Date().toISOString(),
    historial: [],
    ...patch,
  };
}

class ProjectsFalso {
  creados: NuevoProyecto[] = [];
  editados: { id: string; patch: Partial<NuevoProyecto> }[] = [];
  recargas = 0;
  aDevolver: Project | null = proyecto();

  fetchOne = (id: string) => Promise.resolve(this.aDevolver ? { ...this.aDevolver, id } : null);
  create = (data: NuevoProyecto) => {
    this.creados.push(data);
    return Promise.resolve(proyecto());
  };
  update = (id: string, patch: Partial<NuevoProyecto>) => {
    this.editados.push({ id, patch });
    return Promise.resolve(proyecto());
  };
  recargar = () => {
    this.recargas++;
    return Promise.resolve();
  };
}

class AuthFalso {
  permisos = ['projects.create'];
  autorId: string | null = YO.id;
  currentUser = () => ({ id: YO.id, groupId: YO.groupId });
  can = (p: string) => this.permisos.includes(p);
  esAutorOAdmin = (id: string | null | undefined) => id === this.autorId;
}

@Component({
  imports: [ProjectModal],
  template: `<app-project-modal [(abierto)]="abierto" [id]="id()" />`,
})
class Host {
  abierto = signal(false);
  id = signal<string | null>(null);
}

async function montar(id: string | null = null) {
  const projects = new ProjectsFalso();
  const auth = new AuthFalso();

  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      MessageService, // ToastService lo envuelve: sin esto revienta con NG0201
      { provide: ProjectsService, useValue: projects },
      { provide: AuthService, useValue: auth },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.id.set(id);
  fixture.componentInstance.abierto.set(true);
  await fixture.whenStable();
  return { fixture, projects, auth };
}

/** El diálogo se pinta en un overlay, fuera del árbol del componente. */
function boton(texto: string): HTMLButtonElement {
  const todos = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const b = todos.find(x => x.textContent?.includes(texto));
  if (!b) throw new Error(`No hay botón "${texto}"`);
  return b;
}

function escribir(id: string, valor: string): void {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(id)!;
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

/**
 * El borrador del modal. Los campos de texto se llenan por el DOM, pero el
 * sector es un p-select que despliega su lista en un overlay propio: elegir una
 * opción "de verdad" desde el test sería probar a PrimeNG, no a este código.
 */
function borradorDe(fixture: { debugElement: { children: { componentInstance: unknown }[] } }) {
  const modal = fixture.debugElement.children[0].componentInstance as ProjectModal;
  return (modal as unknown as { borrador: WritableSignal<BorradorProyecto> }).borrador;
}

describe('ProjectModal · crear', () => {
  it('manda estado idea, los campos nuevos y refresca la pantalla de atrás', async () => {
    const { fixture, projects } = await montar();

    escribir('#pf-n', 'FreightAudit');
    escribir('#pf-cl', '  Bancolombia  ');
    escribir('#pf-pr', 'Las facturas se auditan a mano.');
    borradorDe(fixture).update(b => ({ ...b, sector: 'Logística' }));
    await fixture.whenStable();

    boton('Registrar el proyecto').click();
    await fixture.whenStable();

    expect(projects.creados.length).toBe(1);
    expect(projects.creados[0].estado).toBe('idea');
    expect(projects.creados[0].cliente).toBe('Bancolombia'); // sin los espacios
    // Sin la recarga, la fila nueva no aparece en la lista hasta refrescar.
    expect(projects.recargas).toBe(1);
  });

  it('se cierra al registrar', async () => {
    // Regresión: `cerrar()` corría dentro del try, con `guardando` todavía en
    // true, y su guard de "no cerrar a mitad de un guardado" se comía el cierre
    // del guardado que sí había terminado. El proyecto quedaba creado y el
    // modal abierto, como si no hubiera pasado nada.
    const { fixture, projects } = await montar();

    escribir('#pf-n', 'FreightAudit');
    escribir('#pf-pr', 'Las facturas se auditan a mano.');
    borradorDe(fixture).update(b => ({ ...b, sector: 'Logística' }));
    await fixture.whenStable();

    boton('Registrar el proyecto').click();
    await fixture.whenStable();

    expect(projects.creados.length).toBe(1);
    expect(fixture.componentInstance.abierto()).toBe(false);
  });

  it('un guardado que falla NO cierra: el formulario queda para corregir', async () => {
    const { fixture, projects } = await montar();
    projects.create = () => Promise.reject(new Error('boom'));

    escribir('#pf-n', 'FreightAudit');
    escribir('#pf-pr', 'Las facturas se auditan a mano.');
    borradorDe(fixture).update(b => ({ ...b, sector: 'Logística' }));
    await fixture.whenStable();

    boton('Registrar el proyecto').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.abierto()).toBe(true);
    expect(document.querySelector('.pm__error')).not.toBeNull();
  });

  it('no guarda si falta lo obligatorio, y dice qué falta', async () => {
    const { fixture, projects } = await montar();

    boton('Registrar el proyecto').click();
    await fixture.whenStable();

    expect(projects.creados.length).toBe(0);
    expect(document.querySelector('.pm__error')?.textContent).toContain('nombre');
  });
});

describe('ProjectModal · editar', () => {
  it('NO manda el estado: la etapa se mueve en el tablero', async () => {
    // Mandarlo pisaría la etapa y dejaría una entrada falsa en el historial.
    const { fixture, projects } = await montar('p1');

    boton('Guardar cambios').click();
    await fixture.whenStable();

    expect(projects.editados.length).toBe(1);
    expect('estado' in projects.editados[0].patch).toBe(false);
  });

  it('se cierra al guardar los cambios', async () => {
    const { fixture } = await montar('p1');

    boton('Guardar cambios').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.abierto()).toBe(false);
  });

  it('precarga el cliente y el tipo de prestación del proyecto', async () => {
    const { fixture } = await montar('p1');

    expect(document.querySelector<HTMLInputElement>('#pf-cl')!.value).toBe('Bancolombia');
    expect(borradorDe(fixture)().tipoPrestacion).toBe('talento');
  });

  it('a quien no es el autor lo saca en vez de dejarlo llenar el formulario', async () => {
    const { fixture, projects, auth } = await montar('p1');
    auth.autorId = 'otro';

    // Se vuelve a abrir para que corra la comprobación con el autor cambiado.
    fixture.componentInstance.abierto.set(false);
    await fixture.whenStable();
    fixture.componentInstance.abierto.set(true);
    await fixture.whenStable();

    expect(fixture.componentInstance.abierto()).toBe(false);
    expect(projects.editados.length).toBe(0);
  });
});
