import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

/**
 * Recuperación de contraseña mediada por un administrador.
 *
 * No hay enlace por correo: el pedido queda registrado y le llega a los
 * administradores, que asignan una clave temporal desde el módulo de usuarios.
 * La persona entra con esa clave y el servidor la obliga a cambiarla.
 *
 * Se responde siempre lo mismo, exista o no la cuenta: contestar distinto
 * permitiría averiguar qué correos están registrados.
 */
@Component({
  selector: 'app-recover',
  imports: [FormsModule, RouterLink],
  templateUrl: './recover.html',
  styleUrl: '../login/login.scss',
})
export class Recover {
  private auth = inject(AuthService);
  private tema = inject(ThemeService);

  email = signal('');
  nota = signal('');
  loading = signal(false);
  enviado = signal(false);
  error = signal<string | null>(null);

  protected esOscuro = computed(() => this.tema.mode() === 'dark');
  protected valido = computed(() => /.+@.+\..+/.test(this.email().trim()));

  toggleTema(): void {
    this.tema.toggle();
  }

  async submit(): Promise<void> {
    if (this.loading() || !this.valido()) return;
    this.error.set(null);
    this.loading.set(true);

    const res = await this.auth.forgotPassword(this.email().trim(), this.nota().trim());
    this.loading.set(false);

    if (!res.ok) {
      this.error.set(res.error ?? 'No se pudo registrar el pedido. Intentá de nuevo en un momento.');
      return;
    }
    this.enviado.set(true);
  }
}
