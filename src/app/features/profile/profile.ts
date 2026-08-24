import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { GENEROS, Genero, generoLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ButtonModule } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, ButtonModule, InputText, IconField, InputIcon, DatePicker, Select],
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

  /** Se antepone la opción de no declararlo. */
  protected opcionesGenero = computed(() => [
    { label: 'Sin especificar', value: null },
    ...this.generos.map(g => ({ label: g.label, value: g.value })),
  ]);

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
