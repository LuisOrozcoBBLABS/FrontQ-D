import { Injectable, computed, inject, signal } from '@angular/core';
import { Group, User } from './models';
import { UsersService } from './users.service';

const STORAGE_KEY = 'plataforma-id.groups';

// Semilla de grupos (equipos de alto rendimiento, estilo RIWI)
const SEED: Group[] = [
  { id: 'g-manglar', nombre: 'Manglar', lema: 'Raíces profundas, ideas que crecen.' },
  { id: 'g-delta',   nombre: 'Delta',   lema: 'Cambio constante, mejora continua.' },
  { id: 'g-bravo',   nombre: 'Bravo',   lema: 'Ejecución valiente y sin fricción.' },
  { id: 'g-alpha',   nombre: 'Alpha',   lema: 'Primeros en explorar lo nuevo.' },
];

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private users = inject(UsersService);
  private readonly _groups = signal<Group[]>(this.load());
  readonly groups = this._groups.asReadonly();
  readonly count = computed(() => this._groups().length);

  private load(): Group[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Group[];
    } catch { /* ignore */ }
    return structuredClone(SEED);
  }
  private persist(list: Group[]): void {
    this._groups.set(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }

  byName(nombre: string): Group | undefined { return this._groups().find(g => g.nombre === nombre); }

  /** La membresía vive en user.grupo (una persona pertenece a un grupo). */
  members(nombre: string): User[] { return this.users.users().filter(u => u.grupo === nombre); }
  memberCount(nombre: string): number { return this.members(nombre).length; }

  create(nombre: string, lema: string): Group {
    const g: Group = { id: 'g-' + Math.random().toString(36).slice(2, 8), nombre: nombre.trim(), lema: lema.trim() };
    this.persist([...this._groups(), g]);
    return g;
  }
  update(id: string, patch: Partial<Group>): void {
    const prev = this._groups().find(g => g.id === id);
    this.persist(this._groups().map(g => (g.id === id ? { ...g, ...patch } : g)));
    // si cambió el nombre, mover a sus miembros
    if (prev && patch.nombre && patch.nombre !== prev.nombre) {
      this.users.users().filter(u => u.grupo === prev.nombre).forEach(u => this.users.update(u.id, { grupo: patch.nombre! }));
    }
  }
  remove(id: string): void {
    const g = this._groups().find(x => x.id === id);
    if (g) this.users.users().filter(u => u.grupo === g.nombre).forEach(u => this.users.update(u.id, { grupo: null }));
    this.persist(this._groups().filter(x => x.id !== id));
  }

  setMembership(userId: string, groupName: string, isMember: boolean): void {
    this.users.update(userId, { grupo: isMember ? groupName : null });
  }
}
