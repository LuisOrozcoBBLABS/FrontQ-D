import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { GENEROS, Genero, generoLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  protected generos = GENEROS;
  protected generoLabel = generoLabel;

  private u = this.auth.currentUser();
  linkedin = signal(this.u?.linkedin ?? '');
  telefono = signal(this.u?.telefono ?? '');
  genero = signal<Genero>(this.u?.genero ?? null);
  fechaNacimiento = signal(this.u?.fechaNacimiento ?? '');
  avatarUrl = signal<string | null>(this.u?.avatarUrl ?? null);

  initials(n: string): string { return n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      // El backend rechaza fotos de mas de 400 KB; avisamos antes de intentar.
      if (dataUri.length > 400_000) {
        this.toast.error('La foto pesa demasiado. Usá una imagen más liviana (menos de 300 KB).');
        return;
      }
      this.avatarUrl.set(dataUri);
    };
    reader.readAsDataURL(file);
  }
  removePhoto(): void { this.avatarUrl.set(null); }

  protected guardando = signal(false);

  async save(): Promise<void> {
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.auth.updateCurrent({
        linkedin: this.linkedin().trim() || null,
        telefono: this.telefono().trim() || null,
        genero: this.genero(),
        fechaNacimiento: this.fechaNacimiento() || null,
        avatarUrl: this.avatarUrl(),
      });
      this.toast.success('Perfil actualizado');
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo guardar el perfil.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
