import { Injectable, computed, signal } from '@angular/core';
import { User } from './models';

const STORAGE_KEY = 'plataforma-id.users';

// Semilla de usuarios (SIMULADO — en producción vendría del backend/DB)
const SEED: User[] = [
  {
    id: 'u-admin', nombre: 'Luis Orozco', email: 'admin@bblabs.io', cargo: 'Jefe de Innovación',
    rol: 'admin', grupo: null, activo: true, permisosExtra: [], avatarUrl: null,
    linkedin: 'https://www.linkedin.com/in/luisr26', genero: null, fechaNacimiento: null,
    onboardingCompleto: true,
  },
  {
    id: 'u-ana', nombre: 'Ana Gómez', email: 'ana@bblabs.io', cargo: 'AI Engineer',
    rol: 'colaborador', grupo: 'Manglar', activo: true, permisosExtra: ['projects.viewAll'],
    avatarUrl: null, linkedin: null, genero: 'mujer', fechaNacimiento: '1998-04-12', onboardingCompleto: true,
  },
  {
    id: 'u-carlos', nombre: 'Carlos Ruiz', email: 'carlos@bblabs.io', cargo: 'Data Scientist',
    rol: 'colaborador', grupo: 'Delta', activo: true, permisosExtra: [], avatarUrl: null,
    linkedin: null, genero: 'hombre', fechaNacimiento: null, onboardingCompleto: false,
  },
  {
    id: 'u-sara', nombre: 'Sara Torres', email: 'sara@bblabs.io', cargo: 'Product Designer',
    rol: 'colaborador', grupo: 'Bravo', activo: false, permisosExtra: [], avatarUrl: null,
    linkedin: null, genero: 'prefiero-no-decirlo', fechaNacimiento: null, onboardingCompleto: false,
  },
];

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly _users = signal<User[]>(this.load());
  readonly users = this._users.asReadonly();
  readonly count = computed(() => this._users().length);
  readonly activos = computed(() => this._users().filter(u => u.activo).length);

  private load(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as User[];
    } catch { /* ignore */ }
    return structuredClone(SEED);
  }

  private persist(list: User[]): void {
    this._users.set(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }

  byEmail(email: string): User | undefined {
    return this._users().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  }
  byId(id: string): User | undefined {
    return this._users().find(u => u.id === id);
  }

  create(data: Omit<User, 'id'>): User {
    const user: User = { ...data, id: 'u-' + Math.random().toString(36).slice(2, 9) };
    this.persist([...this._users(), user]);
    return user;
  }

  update(id: string, patch: Partial<User>): void {
    this.persist(this._users().map(u => (u.id === id ? { ...u, ...patch } : u)));
  }

  toggleActivo(id: string): void {
    const u = this.byId(id);
    if (u) this.update(id, { activo: !u.activo });
  }

  remove(id: string): void {
    this.persist(this._users().filter(u => u.id !== id));
  }

  // Solo para demo: reinicia a la semilla
  resetSeed(): void {
    this.persist(structuredClone(SEED));
  }
}
