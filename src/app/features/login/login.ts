import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ThemeToggle } from '../../ui/theme-toggle';

@Component({
  selector: 'app-login',
  imports: [FormsModule, ThemeToggle],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const res = await this.auth.login(this.email().trim(), this.password());
    this.loading.set(false);

    if (!res.ok) {
      this.error.set(res.error ?? 'No se pudo iniciar sesión.');
      return;
    }

    // Con clave temporal, el servidor no deja operar hasta cambiarla.
    await this.router.navigateByUrl(res.debeCambiarPassword ? '/cambiar-clave' : '/inicio');
  }
}
