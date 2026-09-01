import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BorradorProyecto, LIMITES, borradorVacio } from '../../core/borrador-proyecto';
import { ProjectFields } from './project-fields';

/** Host mínimo: el componente pide un `model`, así que necesita quien lo ate. */
@Component({
  imports: [ProjectFields],
  template: `<app-project-fields [(valor)]="borrador" [camposIA]="camposIA()" />`,
})
class Host {
  borrador = signal<BorradorProyecto>(borradorVacio());
  camposIA = signal<readonly string[]>([]);
}

async function montar(camposIA: string[] = []) {
  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.camposIA.set(camposIA);
  await fixture.whenStable();
  return fixture;
}

describe('ProjectFields', () => {
  it('monta todos los campos del proyecto', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#pf-n')).not.toBeNull();
    expect(el.querySelector('#pf-s')).not.toBeNull();
    expect(el.querySelector('#pf-c')).not.toBeNull();
    expect(el.querySelector('#pf-tp')).not.toBeNull();
    expect(el.querySelector('#pf-pr')).not.toBeNull();
    expect(el.querySelector('#pf-do')).not.toBeNull();
    expect(el.querySelector('#pf-so')).not.toBeNull();
    expect(el.querySelector('#pf-pl')).not.toBeNull();
    expect(el.querySelector('.similar-row')).not.toBeNull();
  });

  /**
   * Regresión de los maxlength que faltaban: project-form.html no tenía ni uno,
   * así que se podía tipear más de lo que el servidor acepta y el POST fallaba
   * con un 400 recién al guardar.
   */
  it('pone el maxlength de cada campo, alineado con el DTO del servidor', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector<HTMLInputElement>('#pf-n')!.maxLength).toBe(LIMITES.nombre);
    expect(el.querySelector<HTMLInputElement>('#pf-c')!.maxLength).toBe(LIMITES.cliente);
    for (const id of ['#pf-pr', '#pf-do', '#pf-so', '#pf-pl']) {
      expect(el.querySelector<HTMLTextAreaElement>(id)!.maxLength).toBe(LIMITES.texto);
    }

    // pInputText es una directiva sobre un <input> nativo, así que el maxlength
    // sigue siendo el del elemento real y no algo que dependa de PrimeNG.
    const [nombre, url] = Array.from(el.querySelectorAll<HTMLInputElement>('.similar-row input'));
    expect(nombre.maxLength).toBe(LIMITES.similarNombre);
    expect(url.maxLength).toBe(LIMITES.similarUrl);
    expect(url.type).toBe('url');
  });

  it('marca los campos que propuso la IA', async () => {
    const fixture = await montar(['nombre', 'problema']);
    const el = fixture.nativeElement as HTMLElement;

    const badges = Array.from(el.querySelectorAll('.badge')).map(b => b.textContent?.trim());
    expect(badges.length).toBe(2);
    expect(badges.every(t => t === 'Propuesto por IA')).toBe(true);
  });

  it('no marca nada cuando la persona escribe desde cero', async () => {
    const fixture = await montar();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.badge').length).toBe(0);
  });

  it('la etiqueta de un campo desaparece al editarlo, y solo la de ese campo', async () => {
    // Así el badge significa "todavía sin revisar" y no solo "vino de la IA".
    const fixture = await montar(['nombre', 'problema']);
    const el = fixture.nativeElement as HTMLElement;

    const input = el.querySelector<HTMLInputElement>('#pf-n')!;
    input.value = 'Corregido a mano';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(el.querySelectorAll('.badge').length).toBe(1);
    expect(fixture.componentInstance.borrador().nombre).toBe('Corregido a mano');
  });

  it('el cliente y el tipo de prestación no llevan badge: la IA no los propone', async () => {
    // Son datos comerciales que el documento rara vez dice. Si algún día se le
    // pidieran al modelo, este test es el que hay que cambiar a conciencia.
    const fixture = await montar(['nombre', 'sector', 'problema', 'dolores', 'solucion', 'plusIA']);
    const el = fixture.nativeElement as HTMLElement;

    const etiquetas = Array.from(el.querySelectorAll('label'))
      .filter(l => l.querySelector('.badge'))
      .map(l => l.getAttribute('for'));
    expect(etiquetas).not.toContain('pf-c');
    expect(etiquetas).not.toContain('pf-tp');
  });

  it('escribir el cliente lo sube al borrador del padre', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;

    const input = el.querySelector<HTMLInputElement>('#pf-c')!;
    input.value = 'Bancolombia';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.borrador().cliente).toBe('Bancolombia');
  });

  it('el contador aparece solo pasado el 80% del límite', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;
    const antes = el.querySelectorAll('.field__hint').length;

    fixture.componentInstance.borrador.update(b => ({ ...b, nombre: 'x'.repeat(130) }));
    await fixture.whenStable();

    const hints = Array.from(el.querySelectorAll('.field__hint')).map(h => h.textContent);
    expect(hints.some(t => t?.includes(`130 / ${LIMITES.nombre}`))).toBe(true);
    expect(el.querySelectorAll('.field__hint').length).toBeGreaterThan(antes);
  });

  it('agregar y quitar una app parecida cambia las filas', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;
    const agregar = Array.from(el.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Agregar otra'),
    )!;

    agregar.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.similar-row').length).toBe(2);

    el.querySelector<HTMLButtonElement>('.similar-row button')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.similar-row').length).toBe(1);
  });

  it('deshabilita todo mientras el padre está guardando', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectFields],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectFields);
    fixture.componentRef.setInput('valor', borradorVacio());
    fixture.componentRef.setInput('deshabilitado', true);
    await fixture.whenStable();

    // Se verifican los controles nativos, que son los que este componente ata.
    // El estado del p-select lo pinta PrimeNG con sus propias clases: afirmarlo
    // sería testear la librería, no este código.
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector<HTMLInputElement>('#pf-n')!.disabled).toBe(true);
    expect(el.querySelector<HTMLTextAreaElement>('#pf-pr')!.disabled).toBe(true);
  });
});
