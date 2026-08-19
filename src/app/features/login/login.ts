import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private tema = inject(ThemeService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  verClave = signal(false);
  error = signal<string | null>(null);
  loading = signal(false);

  protected esOscuro = computed(() => this.tema.mode() === 'dark');

  toggleTema(): void {
    this.tema.toggle();
  }

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
