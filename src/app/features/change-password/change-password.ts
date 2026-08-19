import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

const MINIMO = 10;

/**
 * Primer ingreso con clave temporal. El servidor no deja operar hasta cambiarla,
 * y al cambiarla cierra las sesiones abiertas: por eso vuelve al login.
 */
@Component({
  selector: 'app-change-password',
  imports: [FormsModule],
  templateUrl: './change-password.html',
  styleUrl: '../login/login.scss',
})
export class ChangePassword {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected nombre = computed(() => this.auth.currentUser()?.nombre ?? '');

  actual = signal('');
  nueva = signal('');
  repetida = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  protected readonly minimo = MINIMO;

  protected valida = computed(
    () =>
      this.actual().length > 0 &&
      this.nueva().length >= MINIMO &&
      this.nueva() === this.repetida() &&
      this.nueva() !== this.actual(),
  );

  /** Pista de qué falta, sin regañar antes de que la persona termine de escribir. */
  protected pista = computed<string | null>(() => {
    if (this.nueva().length > 0 && this.nueva().length < MINIMO) {
      return `Faltan ${MINIMO - this.nueva().length} caracteres.`;
    }
    if (this.repetida().length > 0 && this.nueva() !== this.repetida()) {
      return 'Las dos contraseñas no coinciden.';
    }
    if (this.nueva().length >= MINIMO && this.nueva() === this.actual()) {
      return 'La nueva contraseña tiene que ser distinta de la temporal.';
    }
    return null;
  });

  async submit(): Promise<void> {
    if (this.loading() || !this.valida()) return;
    this.error.set(null);
    this.loading.set(true);

    const res = await this.auth.changePassword(this.actual(), this.nueva());
    this.loading.set(false);

    if (!res.ok) {
      this.error.set(res.error ?? 'No se pudo cambiar la contraseña.');
      return;
    }
    await this.router.navigateByUrl('/login');
  }
}
