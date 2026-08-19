import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GENEROS, Genero } from '../../core/models';
import { ThemeToggle } from '../../ui/theme-toggle';

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule, ThemeToggle],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected generos = GENEROS;
  protected nombre = this.auth.currentUser()?.nombre?.split(/\s+/)[0] ?? '';

  fechaNacimiento = signal<string>('');
  genero = signal<Genero>(null);
  error = signal<string | null>(null);

  finish(): void {
    this.error.set(null);
    if (!this.fechaNacimiento()) { this.error.set('Ingresa tu fecha de nacimiento.'); return; }
    if (!this.genero()) { this.error.set('Selecciona una opción para continuar.'); return; }
    this.auth.updateCurrent({
      fechaNacimiento: this.fechaNacimiento(),
      genero: this.genero(),
      onboardingCompleto: true,
    });
    this.router.navigateByUrl('/inicio');
  }
}
