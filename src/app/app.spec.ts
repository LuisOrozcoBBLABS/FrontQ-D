import { TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // Las capas globales de UI son de PrimeNG y piden sus servicios. En la
      // aplicación los aporta app.config; acá hay que declararlos a mano.
      providers: [MessageService, ConfirmationService],
    }).compileComponents();
  });

  it('debería crear el componente raíz', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('debería montar el router-outlet y las capas globales de UI', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('app-toasts')).not.toBeNull();
    expect(compiled.querySelector('app-confirm')).not.toBeNull();
  });
});
