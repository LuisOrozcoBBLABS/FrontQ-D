// Modelos del dominio. Espejan los DTO que devuelve la API de BackQ-D.

/**
 * `comercial` es de solo lectura. No lleva ningun permiso de escritura, y la
 * restriccion la impone el servidor: las cinco rutas que escriben proyectos
 * exigen o un permiso que este rol no tiene, o ser el autor o admin. Lo que el
 * front hace es esconder lo que igual iba a dar 403 — no es la barrera, es
 * cortesia para no ofrecer botones que no funcionan.
 */
export type RoleId = 'admin' | 'colaborador' | 'comercial';

/**
 * Nombre visible de cada rol, en un solo lugar.
 *
 * Estaba escrito dos veces como ternario binario (`rol === 'admin' ? A : B`),
 * en el riel y en la ficha de usuario. Con dos roles eso funcionaba; con el
 * tercero, un comercial aparecia rotulado "Colaborador" en las dos. Un Record
 * sobre RoleId hace que agregar un rol sin nombrarlo no compile.
 */
export const ROL_LABEL: Record<RoleId, string> = {
  admin: 'Administrador',
  colaborador: 'Colaborador',
  comercial: 'Comercial',
};

export interface Permission {
  id: string;      // ej. 'users.manage'
  label: string;   // texto legible
  desc: string;    // descripción corta
  group: string;   // agrupador para la UI
}

export interface Role {
  id: RoleId;
  label: string;
  permissions: string[]; // ids de permisos base del rol
}

export type Genero = 'hombre' | 'mujer' | 'prefiero-no-decirlo' | null;

export interface User {
  id: string;
  nombre: string;
  email: string;
  cargo: string;
  rol: RoleId;
  groupId: string | null;
  grupo: string | null;      // nombre del grupo (Manglar, Delta, ...)
  activo: boolean;
  permisosExtra: string[];   // permisos adicionales sobre el rol (override)
  /** Rol + extras, ya resueltos por el servidor. Es la fuente de verdad. */
  permisosEfectivos: string[];
  avatarUrl: string | null;
  linkedin: string | null;
  genero: Genero;
  fechaNacimiento: string | null;
  onboardingCompleto: boolean;
  telefono?: string | null;
  /** El servidor exige cambiar la clave temporal en el primer ingreso. */
  debeCambiarPassword?: boolean;
  ultimoLoginAt?: string | null;
  createdAt?: string;
}




// Opciones de género (inclusivo)
export const GENEROS: { value: Exclude<Genero, null>; label: string }[] = [
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'prefiero-no-decirlo', label: 'Prefiero no decirlo' },
];

export function generoLabel(g: Genero): string {
  return GENEROS.find(x => x.value === g)?.label ?? '—';
}

// ------------------------- Grupos -------------------------
export interface Group {
  id: string;
  nombre: string;   // Manglar, Delta, ...
  lema: string;     // frase corta del equipo
}

// ------------------------- Proyectos -------------------------
export type Prioridad = 'urgente' | 'alta' | 'media' | 'baja';
export const PRIORIDADES: { value: Prioridad; label: string }[] = [
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

/**
 * Un solo flujo de punta a punta. Los valores son los mismos que el enum de
 * Prisma (guion bajo, no guion medio como en asignaciones): así el PATCH viaja
 * sin conversión y `@IsEnum` del backend los acepta tal cual.
 */
export type ProjectStatus =
  | 'idea'
  | 'evaluacion'
  | 'aprobado'
  | 'analisis_diseno'
  | 'desarrollo'
  | 'code_review_qa'
  | 'uat'
  | 'listo_despliegue'
  | 'produccion'
  | 'descartado';

/** Familia de la etapa: agrupa las columnas del tablero y decide su color. */
export type FaseProyecto = 'embudo' | 'desarrollo' | 'cierre' | 'fuera';

export interface EtapaProyecto {
  value: ProjectStatus;
  /** Nombre corto, para pastillas y tarjetas. */
  label: string;
  /** Nombre de la columna en el tablero, más explícito. */
  columna: string;
  fase: FaseProyecto;
}

/**
 * Orden del tablero, de izquierda a derecha. Es la única fuente del orden: el
 * enum de la base no se recorre para pintar columnas.
 */
export const ETAPAS: EtapaProyecto[] = [
  { value: 'idea',             label: 'Idea',          columna: 'Backlog / Por iniciar',  fase: 'embudo' },
  { value: 'evaluacion',       label: 'Evaluación',    columna: 'En evaluación',          fase: 'embudo' },
  { value: 'aprobado',         label: 'Aprobado',      columna: 'Aprobado',               fase: 'embudo' },
  { value: 'analisis_diseno',  label: 'Análisis',      columna: 'Análisis y diseño',      fase: 'desarrollo' },
  { value: 'desarrollo',       label: 'Desarrollo',    columna: 'En desarrollo',          fase: 'desarrollo' },
  { value: 'code_review_qa',   label: 'Code review',   columna: 'Code review / QA',       fase: 'desarrollo' },
  { value: 'uat',              label: 'UAT',           columna: 'En pruebas (UAT)',       fase: 'desarrollo' },
  { value: 'listo_despliegue', label: 'Por desplegar', columna: 'Listo para despliegue',  fase: 'desarrollo' },
  { value: 'produccion',       label: 'Producción',    columna: 'En producción',          fase: 'cierre' },
  { value: 'descartado',       label: 'Descartado',    columna: 'Descartado',             fase: 'fuera' },
];

/** Compatibilidad: el formulario y los filtros ya usaban esta lista. */
export const ESTADOS_PROYECTO: { value: ProjectStatus; label: string }[] = ETAPAS.map(
  e => ({ value: e.value, label: e.label }),
);

export function etapaDe(estado: ProjectStatus): EtapaProyecto {
  return ETAPAS.find(e => e.value === estado) ?? ETAPAS[0];
}

/**
 * Etapa contigua en el orden de ETAPAS, que es el mismo en que se pintan las
 * columnas: lo que el ojo ve a la izquierda es lo que la flecha izquierda
 * alcanza. Devuelve null en los extremos y con un estado desconocido.
 *
 * Vive acá, como funcion pura, y no dentro del tablero, porque es la unica
 * parte del movimiento por teclado con casos de borde de verdad — y asi se
 * testea sin TestBed ni servicios simulados.
 */
export function etapaVecina(estado: ProjectStatus, direccion: -1 | 1): ProjectStatus | null {
  const i = ETAPAS.findIndex(e => e.value === estado);
  if (i === -1) return null;
  return ETAPAS[i + direccion]?.value ?? null;
}

/** Una entrada del historial: cuándo el proyecto entró a una etapa. */
export interface CambioEstado {
  estado: ProjectStatus;
  /** De dónde venía. Null en la primera entrada del proyecto. */
  anterior: ProjectStatus | null;
  createdAt: string;
  porNombre?: string | null;
}

/**
 * Qué le presta la empresa al cliente en este proyecto: gente (talento) o el
 * producto terminado (solución). Los valores son los mismos que el enum de
 * Prisma, así que viajan sin conversión.
 *
 * OJO con el nombre: `Project.solucion` es otra cosa —el texto de la solución
 * planteada— y son dos campos distintos que se llaman parecido. Por eso el tipo
 * es `tipoPrestacion` y no `solucion` a secas.
 */
export type TipoPrestacion = 'talento' | 'solucion';

export const TIPOS_PRESTACION: { value: TipoPrestacion; label: string; nota: string }[] = [
  { value: 'talento', label: 'Talento', nota: 'Se prestan desarrolladores al cliente.' },
  { value: 'solucion', label: 'Solución', nota: 'Se entrega el proyecto terminado.' },
];

/**
 * `null` es un valor con significado: el proyecto todavía no se clasificó. Los
 * registrados antes de que la distinción existiera quedaron así a propósito, y
 * la etiqueta lo dice en lugar de dejar un hueco.
 */
export function prestacionLabel(t: TipoPrestacion | null | undefined): string {
  return TIPOS_PRESTACION.find(x => x.value === t)?.label ?? 'Sin clasificar';
}

export const SECTORES = [
  'Logística', 'Retail / E-commerce', 'Finanzas', 'Fintech',
  'Salud', 'Educación', 'Farma', 'Otro',
] as const;

export interface AppSimilar { name: string; url: string; }

export interface Project {
  id: string;
  nombre: string;           // nombre de la solución
  sector: string;
  /** Cliente para el que se hace. Opcional: hay ideas internas sin cliente. */
  cliente?: string | null;
  /** Qué se presta. Null = sin clasificar. */
  tipoPrestacion: TipoPrestacion | null;
  problema: string;         // problema identificado
  dolores: string;          // dolores dentro del problema
  solucion: string;         // solución planteada
  similares: AppSimilar[];  // apps/programas parecidos (con URL)
  plusIA: string;           // qué se agregaría con IA (el PLUS)
  grupo: string | null;     // nombre del grupo, resuelto por la API
  groupId?: string | null;
  autorId: string;
  autorNombre?: string | null; // la API ya trae el autor resuelto
  estado: ProjectStatus;
  createdAt: string;
  /**
   * Entradas a cada etapa, de la más vieja a la más nueva. En las listas la API
   * manda solo la última (para saber desde cuándo está en su etapa); en el
   * detalle manda todas. Vacío = proyecto sin historial registrado.
   */
  historial: CambioEstado[];
  /** Responsables resueltos por la API desde las asignaciones. */
  responsables?: string[];
  /**
   * Fin estimado. El proyecto no tiene ese campo: es la fecha límite más
   * lejana de sus asignaciones. Null si ninguna tiene plazo.
   */
  finEstimado?: string | null;
}


// ------------------------- Asignaciones + notificaciones -------------------------
export type AssignmentStatus = 'pendiente' | 'aceptada' | 'en-curso' | 'completada';
export const ASIG_ESTADOS: { value: AssignmentStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'en-curso', label: 'En curso' },
  { value: 'completada', label: 'Completada' },
];

export type Canal = 'correo' | 'whatsapp' | 'teams';
export const CANALES: { value: Canal; label: string; nota: string }[] = [
  { value: 'correo',   label: 'Correo corporativo', nota: 'Gratis. Vía n8n / Microsoft Graph.' },
  { value: 'whatsapp', label: 'WhatsApp',           nota: 'Al teléfono. WhatsApp Cloud API (más barato que SMS).' },
  { value: 'teams',    label: 'Microsoft Teams',    nota: 'Gratis si la empresa usa M365 (Graph API).' },
];

export interface Assignment {
  id: string;
  projectId: string;
  /** Nombres que la API ya resuelve: evitan depender de otra lista cargada. */
  projectNombre?: string;
  asignadoANombre?: string;
  asignadoPorNombre?: string;
  /** Estado real de cada canal de aviso, tal como lo dejo el despachador. */
  envios?: CanalEnvio[];
  asignadoA: string;   // userId del trabajador
  asignadoPor: string; // userId del jefe/admin
  prioridad: Prioridad;
  nota: string;
  fechaLimite: string | null;
  estado: AssignmentStatus;
  canales: Canal[];
  createdAt: string;
}

export interface CanalEnvio { canal: Canal; destino: string; estado: string; }

/** De que es el aviso: define a donde lleva el clic. */
export type TipoAviso = 'asignacion' | 'reset_password' | 'general';

export interface NotificationItem {
  id: string;
  userId: string;      // destinatario
  tipo: TipoAviso;
  /** De quien habla el aviso, no el destinatario. */
  sujetoId?: string | null;
  titulo: string;
  detalle: string;
  leida: boolean;
  createdAt: string;
  assignmentId: string;
  projectId: string;
  envios: CanalEnvio[]; // estado de cada canal, resuelto por el despachador del backend
}


