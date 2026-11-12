import { Injectable, signal, computed, effect, DestroyRef, inject } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'vv_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly destroyRef = inject(DestroyRef);

  /** User's explicit choice — persisted to localStorage */
  readonly mode = signal<ThemeMode>(this.loadMode());

  /** OS-level preference — updated via matchMedia listener */
  private readonly systemDark = signal(this.querySystemDark());

  /** Resolved visual state — derived from mode + OS preference */
  readonly isDark = computed(() => {
    const m = this.mode();
    if (m === 'dark') return true;
    if (m === 'light') return false;
    return this.systemDark();
  });

  constructor() {
    // Side effects: sync DOM class + localStorage whenever isDark/mode change
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
      localStorage.setItem(THEME_KEY, this.mode());
    });

    // Keep systemDark signal in sync with OS preference changes
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => this.systemDark.set(mq.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
  }

  toggle(): void {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private loadMode(): ThemeMode {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  }

  private querySystemDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
