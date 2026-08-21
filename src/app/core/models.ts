// Modelos del dominio. Espejan los DTO que devuelve la API de BackQ-D.

export type RoleId = 'admin' | 'colaborador';

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

export type ProjectStatus = 'idea' | 'evaluacion' | 'aprobado' | 'descartado';
export const ESTADOS_PROYECTO: { value: ProjectStatus; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'evaluacion', label: 'En evaluación' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'descartado', label: 'Descartado' },
];

export const SECTORES = [
  'Logística', 'Retail / E-commerce', 'Finanzas', 'Fintech',
  'Salud', 'Educación', 'Farma', 'Otro',
] as const;

export interface AppSimilar { name: string; url: string; }

export interface Project {
  id: string;
  nombre: string;           // nombre de la solución
  sector: string;
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


