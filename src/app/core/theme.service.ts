import { Injectable, signal } from '@angular/core';

type Mode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<Mode>('dark');

  init(): void {
    let saved: string | null = null;
    try { saved = localStorage.getItem('theme'); } catch { /* ignore */ }
    this.set(saved === 'light' ? 'light' : 'dark'); // dark-first
  }

  set(mode: Mode): void {
    this.mode.set(mode);
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', mode === 'dark' ? '#0A0A0A' : '#FFFFFF');
    try { localStorage.setItem('theme', mode); } catch { /* ignore */ }
  }

  toggle(): void {
    this.set(this.mode() === 'dark' ? 'light' : 'dark');
  }
}
