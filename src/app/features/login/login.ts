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

  email = signal('admin@bblabs.io');
  password = signal('demo');
  error = signal<string | null>(null);
  loading = signal(false);

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    const res = this.auth.login(this.email(), this.password());
    this.loading.set(false);
    if (res.ok) {
      this.router.navigateByUrl('/inicio');
    } else {
      this.error.set(res.error ?? 'No se pudo iniciar sesión.');
    }
  }
}
