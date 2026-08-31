import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService, mensajeDeError } from '../../core/auth.service';
import {
  BorradorProyecto,
  aNuevoProyecto,
  borradorVacio,
  validarBorrador,
} from '../../core/borrador-proyecto';
import {
  BorradorGuardado,
  DocumentsService,
  guardarBorrador,
  leerBorrador,
  mensajeDeAnalisis,
  olvidarBorrador,
} from '../../core/documents.service';
import { ProjectsService } from '../../core/projects.service';
import { ToastService } from '../../core/toast.service';
import { ProjectFields } from '../projects/project-fields';
import { DocDropzone } from './doc-dropzone';

/**
 * Documentos — borrador de proyecto asistido por IA.
 *
 * Se sube un PDF o un DOCX, el backend extrae el texto y le pide a un modelo un
 * borrador de la ficha, y la persona **corrige en vez de redactar**. El guardado
 * final es el POST /projects que ya existía, así que el proyecto creado es
 * indistinguible de uno hecho a mano.
 *
 * Lo que este módulo NO hace, y conviene que siga así:
 * - No guarda el archivo. Se procesa en memoria del servidor y se descarta.
 * - No guarda el borrador en el servidor. Vive acá hasta que la persona guarda.
 * - No inventa progreso. Ver el comentario del stepper más abajo.
 *
 * ADVERTENCIA: el texto del documento se envía a un proveedor externo de IA. El
 * cartel de la pantalla lo dice antes de que la persona elija el archivo, no
 * después.
 *
 * Una sola ruta y sin subruta para la revisión: el borrador no tiene id, así que
 * una /documentos/revisar sería una URL cuyo estado no se puede reconstruir — un
 * F5 ahí dejaría un formulario vacío en una ruta que promete un borrador, y eso
 * se lee como un bug. Acá el F5 cae en 'vacio', que es honesto, y el borrador se
 * recupera de sessionStorage con un aviso.
 */
type Fase = 'vacio' | 'subiendo' | 'procesando' | 'revision';

@Component({
  selector: 'app-documents',
  imports: [DocDropzone, ProjectFields, ButtonModule],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class Documents {
  private docsSvc = inject(DocumentsService);
  private projectsSvc = inject(ProjectsService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected fase = signal<Fase>('vacio');
  protected error = signal<string | null>(null);
  protected avisos = signal<string[]>([]);
  protected archivo = signal<string>('');
  protected camposIA = signal<string[]>([]);
  protected borrador = signal<BorradorProyecto>(borradorVacio());
  protected recuperado = signal(false);
  protected guardando = signal(false);

  /** Segundos de espera, para el aviso de "está tardando". */
  protected segundos = signal(0);
  private reloj: ReturnType<typeof setInterval> | null = null;

  protected progreso = this.docsSvc.progreso;

  /**
   * Los tres pasos que ya anunciaba la pantalla, ahora como stepper real.
   * El 03 quedó en singular: es un borrador, no varias propuestas.
   */
  protected readonly pasos = [
    {
      n: '01',
      titulo: 'Subís el documento',
      texto: 'El PDF o el DOCX donde ya está escrito el proyecto.',
    },
    {
      n: '02',
      titulo: 'Se extrae el contenido',
      texto: 'El servidor lee el texto del archivo. El archivo no se guarda.',
    },
    {
      n: '03',
      titulo: 'La IA propone el borrador',
      texto: 'Reconoce nombre, sector, problema, dolores, solución y diferencial.',
    },
  ];

  /**
   * Honestidad del progreso.
   *
   * Del cable observamos exactamente dos cosas: la subida (con % real) y la
   * espera de la respuesta. Dentro de un único POST no hay forma de distinguir
   * "extrayendo el texto" de "la IA propone", así que el paso 01 muestra una
   * barra determinada con el porcentaje real, y cuando la subida termina 02 y 03
   * quedan LOS DOS activos con la banda indeterminada. No se inventa un salto
   * temporizado entre ellos. Si algún día el backend expone SSE o un job id, el
   * stepper ya está en la forma correcta para mostrarlo.
   */
  protected estadoPaso(n: string): 'hecho' | 'activo' | 'pendiente' {
    const f = this.fase();
    if (n === '01') {
      if (f === 'subiendo') return 'activo';
      return f === 'procesando' || f === 'revision' ? 'hecho' : 'pendiente';
    }
    // 02 y 03 comparten estado: es lo único que sabemos de verdad.
    if (f === 'procesando') return 'activo';
    return f === 'revision' ? 'hecho' : 'pendiente';
  }

  protected esperando = computed(() => this.fase() === 'subiendo' || this.fase() === 'procesando');

  /**
   * Guardar entra por POST /projects, que exige projects.create — no ai.use.
   * Puede existir alguien con un permiso y sin el otro.
   */
  protected puedeCrear = computed(() => this.auth.can('projects.create'));
  protected puedeGuardar = computed(() => !this.guardando() && this.puedeCrear());

  constructor() {
    this.restaurar();

    // Salir del módulo no puede dejar la petición colgada.
    inject(DestroyRef).onDestroy(() => {
      this.pararReloj();
      if (this.esperando()) {
        this.cancelado = true;
        this.docsSvc.cancelar();
      }
    });
  }

  /**
   * Cancelar corta el Observable, y eso hace que la Promise del servicio
   * rechace. Sin esta bandera, apretar Cancelar pintaría un mensaje de error por
   * algo que la persona pidió a propósito.
   */
  private cancelado = false;

  // ------------------------------------------------------------- análisis
  async alElegirArchivo(archivo: File): Promise<void> {
    this.error.set(null);
    this.avisos.set([]);
    this.recuperado.set(false);
    this.cancelado = false;
    this.fase.set('subiendo');
    this.arrancarReloj();

    try {
      const listo = await this.docsSvc.analizar(archivo);

      this.borrador.set({
        ...listo.borrador,
        groupId: this.auth.currentUser()?.groupId ?? null,
      });
      this.camposIA.set(listo.camposIA);
      this.archivo.set(listo.archivo);
      this.avisos.set(listo.avisos);
      this.fase.set('revision');
      this.persistir();
    } catch (e) {
      if (this.cancelado) return; // lo pidió la persona, no es un error
      this.error.set(mensajeDeAnalisis(e, 'No se pudo analizar el documento.'));
      this.fase.set('vacio');
    } finally {
      this.pararReloj();
    }
  }

  protected cancelar(): void {
    this.cancelado = true;
    this.docsSvc.cancelar();
    this.pararReloj();
    this.fase.set('vacio');
    this.error.set(null);
  }

  protected descartar(): void {
    this.olvidar();
    this.borrador.set(borradorVacio());
    this.camposIA.set([]);
    this.avisos.set([]);
    this.archivo.set('');
    this.error.set(null);
    this.recuperado.set(false);
    this.fase.set('vacio');
  }

  // ------------------------------------------------------------- guardado
  async guardar(): Promise<void> {
    if (this.guardando()) return;

    const problema = validarBorrador(this.borrador());
    this.error.set(problema);
    if (problema) return;

    this.guardando.set(true);
    try {
      const p = await this.projectsSvc.create(aNuevoProyecto(this.borrador()));
      this.olvidar();
      this.toast.success('Proyecto creado');
      await this.router.navigate(['/proyectos', p.id]);
    } catch (e) {
      const mensaje = mensajeDeError(e, 'No se pudo crear el proyecto.');
      this.error.set(mensaje);
      this.toast.error(mensaje);
    } finally {
      this.guardando.set(false);
    }
  }

  // ------------------------------------------------------------- el reloj
  /**
   * El README documenta que Render duerme la instancia del plan gratuito y la
   * primera petición puede tardar cerca de un minuto. Sin este contador, la
   * espera se lee como algo colgado.
   */
  private arrancarReloj(): void {
    this.pararReloj();
    this.segundos.set(0);
    this.reloj = setInterval(() => this.segundos.update(s => s + 1), 1000);
  }

  private pararReloj(): void {
    if (this.reloj !== null) {
      clearInterval(this.reloj);
      this.reloj = null;
    }
  }

  protected tardando = computed(() => this.segundos() >= 20);

  // ------------------------------------------- persistencia de la pestaña
  /**
   * Solo el borrador ya normalizado, en sessionStorage. Las funciones viven en
   * core/documents.service.ts porque AuthService.logout() también las usa.
   */
  private persistir(): void {
    const dato: BorradorGuardado = {
      borrador: this.borrador(),
      camposIA: this.camposIA(),
      archivo: this.archivo(),
      avisos: this.avisos(),
    };
    guardarBorrador(dato);
  }

  private restaurar(): void {
    const dato = leerBorrador();
    if (!dato) return;

    this.borrador.set(dato.borrador);
    this.camposIA.set(dato.camposIA ?? []);
    this.archivo.set(dato.archivo ?? '');
    this.avisos.set(dato.avisos ?? []);
    this.recuperado.set(true);
    this.fase.set('revision');
  }

  private olvidar(): void {
    olvidarBorrador();
  }
}
