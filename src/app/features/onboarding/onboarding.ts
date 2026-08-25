import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { GENEROS, Genero } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule, DatePicker, SelectButton, ButtonModule],
  templateUrl: './onboarding.html',
  // La hoja de las pantallas de acceso, mas lo especifico de esta.
  styleUrls: ['../login/login.scss', './onboarding.scss'],
})
export class Onboarding {
  private auth = inject(AuthService);
  private router = inject(Router);
  private tema = inject(ThemeService);

  protected esOscuro = computed(() => this.tema.mode() === 'dark');

  toggleTema(): void {
    this.tema.toggle();
  }

  protected generos = GENEROS;
  protected nombre = this.auth.currentUser()?.nombre?.split(/\s+/)[0] ?? '';

  fechaNacimiento = signal<string>('');
  genero = signal<Genero>(null);
  error = signal<string | null>(null);

  /** Tope del calendario: no se puede nacer mañana. */
  protected readonly hoy = new Date();

  /** El modelo guarda ISO (aaaa-mm-dd); el calendario trabaja con Date. */
  protected fechaComoDato = computed(() => {
    const v = this.fechaNacimiento();
    return v ? new Date(v + 'T00:00:00') : null;
  });

  protected fijarFecha(d: Date | null): void {
    this.fechaNacimiento.set(d ? d.toISOString().slice(0, 10) : '');
  }

  async finish(): Promise<void> {
    this.error.set(null);
    if (!this.fechaNacimiento()) { this.error.set('Ingresa tu fecha de nacimiento.'); return; }
    if (!this.genero()) { this.error.set('Selecciona una opción para continuar.'); return; }
    try {
      await this.auth.updateCurrent({
        fechaNacimiento: this.fechaNacimiento(),
        genero: this.genero(),
        onboardingCompleto: true,
      });
      await this.router.navigateByUrl('/inicio');
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo guardar tus datos.'));
    }
  }
}
