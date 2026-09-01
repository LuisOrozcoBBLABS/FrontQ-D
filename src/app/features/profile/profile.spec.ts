import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';
import { convertToParamMap, ParamMap } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { RoleId, User } from '../../core/models';
import { Profile } from './profile';

/**
 * Lo que cuida este spec: que la ficha diga el rol correcto —el bug que traía
 * el ternario binario— y que el diálogo se abra y cierre desde la URL.
 */

function usuario(patch: Partial<User> = {}): Partial<User> {
  return {
    id: 'u1',
    nombre: 'Ana Pérez',
    email: 'ana@bblabs.io',
    rol: 'colaborador' as RoleId,
    cargo: 'Analista',
    grupo: 'Delta',
    linkedin: null,
    telefono: null,
    genero: null,
    fechaNacimiento: null,
    avatarUrl: null,
    ...patch,
  };
}

class AuthFalso {
  user = signal<Partial<User>>(usuario());
  currentUser = () => this.user();
  isAdmin = () => this.user().rol === 'admin';
  guardados: Partial<User>[] = [];
  updateCurrent = (patch: Partial<User>) => {
    this.guardados.push(patch);
    return Promise.resolve();
  };
}

/** ActivatedRoute falso con query params que se pueden mover a mano. */
class RutaFalsa {
  private sujeto = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  queryParamMap = this.sujeto.asObservable();
  snapshot = { queryParamMap: convertToParamMap({}) };
  poner(params: Record<string, string>): void {
    this.sujeto.next(convertToParamMap(params));
  }
}

@Component({ imports: [Profile], template: `<app-profile />` })
class Host {}

async function montar(rol: RoleId = 'colaborador') {
  const auth = new AuthFalso();
  auth.user.set(usuario({ rol }));
  const ruta = new RutaFalsa();
  const router = { navigate: (_c: unknown[], _e: unknown) => Promise.resolve(true) };

  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      MessageService,
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: ruta },
      { provide: Router, useValue: router },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, auth, ruta };
}

describe('Profile · la ficha', () => {
  it('nombra el rol comercial en vez de decirle Colaborador', async () => {
    // Regresión: la ficha usaba `isAdmin() ? 'Administrador' : 'Colaborador'`,
    // así que con el tercer rol mentía sin que nada fallara.
    const { fixture } = await montar('comercial');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Comercial');
    expect(texto).not.toContain('Colaborador');
  });

  it('nombra al administrador', async () => {
    const { fixture } = await montar('admin');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Administrador');
  });
});

describe('Profile · el modal', () => {
  it('no se muestra sin el parámetro en la URL', async () => {
    await montar();
    expect(document.querySelector('#li')).toBeNull();
  });

  it('se abre con ?editar=1 y precarga lo guardado', async () => {
    const { fixture, auth, ruta } = await montar();
    auth.user.set(usuario({ linkedin: 'https://linkedin.com/in/ana' }));

    ruta.poner({ editar: '1' });
    await fixture.whenStable();

    expect(document.querySelector<HTMLInputElement>('#li')!.value).toBe(
      'https://linkedin.com/in/ana',
    );
  });

  it('al reabrir muestra lo guardado y no lo que se dejó a medias', async () => {
    const { fixture, ruta } = await montar();
    ruta.poner({ editar: '1' });
    await fixture.whenStable();

    const input = document.querySelector<HTMLInputElement>('#li')!;
    input.value = 'a medio escribir';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    ruta.poner({});
    await fixture.whenStable();
    ruta.poner({ editar: '1' });
    await fixture.whenStable();

    expect(document.querySelector<HTMLInputElement>('#li')!.value).toBe('');
  });
});
