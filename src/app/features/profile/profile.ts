import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import { GENEROS, Genero, ROL_LABEL, generoLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';

/**
 * Mi perfil: la ficha de identidad es la página, y lo editable vive en un
 * diálogo. Es el mismo reparto que usuarios y grupos —una pantalla que muestra,
 * un modal que edita— y el que quedó para proyectos.
 *
 * El modal se abre desde la URL (`/perfil?editar=1`) y no desde una bandera
 * interna, por lo mismo que en proyectos: recargar reabre lo mismo y "atrás"
 * cierra el diálogo en vez de sacarte de la pantalla.
 */
@Component({
  selector: 'app-profile',
  imports: [FormsModule, ButtonModule, Dialog, InputText, IconField, InputIcon, DatePicker, Select],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected generos = GENEROS;
  protected generoLabel = generoLabel;

  linkedin = signal('');
  telefono = signal('');
  genero = signal<Genero>(null);
  fechaNacimiento = signal('');
  avatarUrl = signal<string | null>(null);

  /**
   * Rol en palabras. Sale de ROL_LABEL y no de un ternario sobre `isAdmin()`:
   * la ficha decía "Colaborador" para cualquiera que no fuera admin, así que
   * con el rol comercial mentía. ROL_LABEL además no compila si se agrega un
   * rol y nadie lo nombra.
   */
  protected rolLabel = computed(() => {
    const rol = this.auth.currentUser()?.rol;
    return rol ? ROL_LABEL[rol] : '—';
  });

  /** La foto de la ficha es la guardada, no la que se esté probando en el modal. */
  protected avatarActual = computed(() => this.auth.currentUser()?.avatarUrl ?? null);

  private params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected editarAbierto = computed(() => !!this.params().get('editar'));

  constructor() {
    // Se rellena al ABRIR y no al construir: si se cancela y se vuelve a entrar,
    // el formulario tiene que mostrar lo guardado y no lo que se dejó a medias.
    effect(() => {
      if (!this.editarAbierto()) return;
      const u = this.auth.currentUser();
      this.linkedin.set(u?.linkedin ?? '');
      this.telefono.set(u?.telefono ?? '');
      this.genero.set(u?.genero ?? null);
      this.fechaNacimiento.set(u?.fechaNacimiento ?? '');
      this.avatarUrl.set(u?.avatarUrl ?? null);
    });
  }

  protected abrirEdicion(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { editar: 1 },
      queryParamsHandling: 'merge',
    });
  }

  /** p-dialog avisa el cierre por Escape o por clic en el fondo. */
  protected alCambiarVisible(abierto: boolean): void {
    if (!abierto) this.cerrar();
  }

  protected cerrar(): void {
    if (this.guardando()) return; // no se cierra a mitad de un guardado
    this.cerrarYa();
  }

  /**
   * Cierre incondicional. Va separado de `cerrar()` por la misma razón que en
   * `ProjectModal`: el cierre del final de `save()` corre con `guardando`
   * todavía en true, y el guard de "no cerrar a mitad de un guardado" se lo
   * comería.
   */
  private cerrarYa(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { editar: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

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
      this.cerrarYa();
    } catch (e) {
      this.toast.error(mensajeDeError(e, 'No se pudo guardar el perfil.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
