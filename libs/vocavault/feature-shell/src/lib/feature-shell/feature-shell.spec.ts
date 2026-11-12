// @vitest-environment jsdom
import { Component, Signal, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BackHintService } from '@vocavault/ui';
import { ActionDrawerItem } from '@vocavault/ui';
import { StorageService, WordService } from '@vocavault/data-access';
import { OnboardingService, SCROLL_CONTAINER_ID } from '@vocavault/util';
import { FeatureShell } from './feature-shell';

interface FeatureShellInternals {
  addDrawerVisible: WritableSignal<boolean>;
  navigateHome: () => void;
  onAddActionSelected: (action: ActionDrawerItem) => void;
  findActiveComponent: () => { hasUnsavedChanges: Signal<boolean> } | null;
  addActions: () => readonly { id: string; disabled?: boolean; highlight?: boolean }[];
  addFooterNote: () => string;
}

@Component({ template: '', standalone: true })
class StubComponent {}

describe('FeatureShell', () => {
  let fixture: ComponentFixture<FeatureShell>;
  let router: Router;
  let backHint: BackHintService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FeatureShell],
      providers: [
        provideRouter([
          {
            path: '',
            component: FeatureShell,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'home' },
              { path: 'home', component: StubComponent },
              { path: 'dictionary', component: StubComponent },
              {
                path: 'quiz',
                children: [
                  { path: '', pathMatch: 'full', component: StubComponent },
                  { path: 'create', component: StubComponent },
                  { path: ':id', component: StubComponent },
                ],
              },
              { path: 'progress', component: StubComponent },
            ],
          },
        ]),
        provideNoopAnimations(),
        { provide: StorageService, useValue: { get: () => null, set: () => true, remove: () => { /* mock: no-op */ }, clear: () => { /* mock: no-op */ } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    backHint = TestBed.inject(BackHintService);
    fixture = TestBed.createComponent(FeatureShell);
  });

  // ──────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────

  function getMobileFab(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('#vv-add-trigger');
  }

  function isFabDisabled(): boolean {
    const btn = getMobileFab();
    if (!btn) return true;
    return btn.getAttribute('aria-disabled') === 'true';
  }

  function isFabGreyedOut(): boolean {
    const btn = getMobileFab();
    if (!btn) return false;
    return btn.classList.contains('bg-slate-300') && btn.classList.contains('cursor-not-allowed');
  }

  async function navigateTo(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  // ──────────────────────────────────────
  // Basic rendering
  // ──────────────────────────────────────

  it('should render', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement).toBeTruthy();
  });

  // ──────────────────────────────────────
  // App-shell layout (viewport-locked)
  // ──────────────────────────────────────

  it('root container uses fixed viewport height, not min-height', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(root.classList.contains('h-svh')).toBe(true);
    expect(root.classList.contains('min-h-svh')).toBe(false);
    expect(root.classList.contains('overflow-hidden')).toBe(true);
  });

  it('main content area is independently scrollable', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const main = fixture.nativeElement.querySelector('#main-content') as HTMLElement;
    expect(main.classList.contains('overflow-y-auto')).toBe(true);
    expect(main.classList.contains('overscroll-y-contain')).toBe(true);
  });

  it(`scroll container has id="${SCROLL_CONTAINER_ID}" (shared contract with getScrollContainer)`, async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector(`#${SCROLL_CONTAINER_ID}`);
    expect(el).toBeTruthy();
    expect(el.tagName).toBe('MAIN');
  });

  it('should render adaptive nav', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('lib-adaptive-nav')).toBeTruthy();
  });

  it('should render FAB button', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getMobileFab()).toBeTruthy();
  });

  // ──────────────────────────────────────
  // FAB enabled on normal pages
  // ──────────────────────────────────────

  it('FAB is enabled on /home', async () => {
    await navigateTo('/home');
    expect(isFabDisabled()).toBe(false);
    expect(isFabGreyedOut()).toBe(false);
  });

  it('FAB is enabled on /dictionary (no query params)', async () => {
    await navigateTo('/dictionary');
    expect(isFabDisabled()).toBe(false);
  });

  it('FAB is enabled on /quiz', async () => {
    await navigateTo('/quiz');
    expect(isFabDisabled()).toBe(false);
  });

  it('FAB is enabled on /progress', async () => {
    await navigateTo('/progress');
    expect(isFabDisabled()).toBe(false);
  });

  it('FAB is enabled on /quiz/:id (detail page)', async () => {
    await navigateTo('/quiz/abc123');
    expect(isFabDisabled()).toBe(false);
  });

  // ──────────────────────────────────────
  // FAB greyed out + disabled on add pages
  // ──────────────────────────────────────

  it('FAB is greyed out on /dictionary?addWord=true', async () => {
    await navigateTo('/dictionary?addWord=true');
    expect(isFabDisabled()).toBe(true);
    expect(isFabGreyedOut()).toBe(true);
  });

  it('FAB is greyed out on /dictionary?addFolder=true', async () => {
    await navigateTo('/dictionary?addFolder=true');
    expect(isFabDisabled()).toBe(true);
    expect(isFabGreyedOut()).toBe(true);
  });

  it('FAB is greyed out on /quiz/create', async () => {
    await navigateTo('/quiz/create');
    expect(isFabDisabled()).toBe(true);
    expect(isFabGreyedOut()).toBe(true);
  });

  // ──────────────────────────────────────
  // FAB re-enables after leaving add pages
  // ──────────────────────────────────────

  it('FAB re-enables when navigating from addWord back to /dictionary', async () => {
    await navigateTo('/dictionary?addWord=true');
    expect(isFabDisabled()).toBe(true);

    await navigateTo('/dictionary');
    expect(isFabDisabled()).toBe(false);
  });

  it('FAB re-enables when navigating from /quiz/create back to /quiz', async () => {
    await navigateTo('/quiz/create');
    expect(isFabDisabled()).toBe(true);

    await navigateTo('/quiz');
    expect(isFabDisabled()).toBe(false);
  });

  it('FAB re-enables when navigating from addFolder to /progress', async () => {
    await navigateTo('/dictionary?addFolder=true');
    expect(isFabDisabled()).toBe(true);

    await navigateTo('/progress');
    expect(isFabDisabled()).toBe(false);
  });

  // ──────────────────────────────────────
  // Double-tap disabled FAB triggers back hint
  // ──────────────────────────────────────

  it('single tap on disabled FAB does NOT open drawer', async () => {
    await navigateTo('/dictionary?addWord=true');
    const fab = getMobileFab();
    if (!fab) throw new Error('FAB not found');
    fab.click();
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as FeatureShellInternals).addDrawerVisible()).toBe(false);
  });

  it('double-tap on disabled FAB triggers back hint pulse', async () => {
    await navigateTo('/dictionary?addWord=true');
    const spy = vi.spyOn(backHint, 'trigger');
    const fab = getMobileFab();
    if (!fab) throw new Error('FAB not found');

    fab.click();
    fab.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
    expect((fixture.componentInstance as unknown as FeatureShellInternals).addDrawerVisible()).toBe(false);
  });

  it('double-tap does NOT trigger back hint on enabled FAB', async () => {
    await navigateTo('/home');
    const spy = vi.spyOn(backHint, 'trigger');
    const fab = getMobileFab();
    if (!fab) throw new Error('FAB not found');

    fab.click();
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
    expect((fixture.componentInstance as unknown as FeatureShellInternals).addDrawerVisible()).toBe(true);
  });

  // ──────────────────────────────────────
  // Navigation actions trigger correct routes
  // ──────────────────────────────────────

  it('word action navigates to /dictionary with addWord query param', async () => {
    await navigateTo('/home');
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (fixture.componentInstance as unknown as FeatureShellInternals).onAddActionSelected({ id: 'word', label: 'Word' });
    expect(spy).toHaveBeenCalledWith(['/dictionary'], { queryParams: { addWord: 'true' } });
  });

  it('quiz action navigates to /quiz/create', async () => {
    await navigateTo('/home');
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (fixture.componentInstance as unknown as FeatureShellInternals).onAddActionSelected({ id: 'quiz', label: 'Quiz' });
    expect(spy).toHaveBeenCalledWith(['/quiz', 'create']);
  });

  it('folder action navigates to /dictionary with addFolder query param', async () => {
    await navigateTo('/home');
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (fixture.componentInstance as unknown as FeatureShellInternals).onAddActionSelected({ id: 'folder', label: 'Folder' });
    expect(spy).toHaveBeenCalledWith(['/dictionary'], { queryParams: { addFolder: 'true' } });
  });

  it('action drawer closes after selection', async () => {
    await navigateTo('/home');
    const component = fixture.componentInstance as unknown as FeatureShellInternals;
    component.addDrawerVisible.set(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onAddActionSelected({ id: 'word', label: 'Word' });
    expect(component.addDrawerVisible()).toBe(false);
  });

  // ──────────────────────────────────────
  // navigateHome() with unsaved changes
  // ──────────────────────────────────────

  it('navigateHome() navigates to /home on a clean page', async () => {
    await navigateTo('/home');
    const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (fixture.componentInstance as unknown as FeatureShellInternals).navigateHome();
    expect(spy).toHaveBeenCalledWith(['/home']);
  });

  it('navigateHome() prompts when component has unsaved changes and blocks on cancel', async () => {
    await navigateTo('/home');
    const dirty = signal(true);
    vi.spyOn(fixture.componentInstance as unknown as FeatureShellInternals, 'findActiveComponent').mockReturnValue({ hasUnsavedChanges: dirty });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.componentInstance as unknown as FeatureShellInternals).navigateHome();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('unsaved changes'));
    expect(navSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('navigateHome() navigates when user confirms leaving unsaved changes', async () => {
    await navigateTo('/home');
    const dirty = signal(true);
    vi.spyOn(fixture.componentInstance as unknown as FeatureShellInternals, 'findActiveComponent').mockReturnValue({ hasUnsavedChanges: dirty });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.componentInstance as unknown as FeatureShellInternals).navigateHome();

    expect(confirmSpy).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/home']);
    confirmSpy.mockRestore();
  });

  it('navigateHome() does not prompt when component has no unsaved changes', async () => {
    await navigateTo('/home');
    const clean = signal(false);
    vi.spyOn(fixture.componentInstance as unknown as FeatureShellInternals, 'findActiveComponent').mockReturnValue({ hasUnsavedChanges: clean });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.componentInstance as unknown as FeatureShellInternals).navigateHome();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/home']);
    confirmSpy.mockRestore();
  });

  // ──────────────────────────────────────
  // First-run add-button hint (pulse + tooltip), across devices
  // ──────────────────────────────────────

  // jsdom reports a mobile layout, so adaptive-nav only renders the mobile FAB
  // here; the desktop add pill is verified across viewports in the e2e suite.
  describe('first-run add hint', () => {
    it('pulses the add button when the dictionary is empty', async () => {
      await navigateTo('/home');
      expect(getMobileFab()?.classList.contains('vv-add-hint')).toBe(true);
    });

    it('shows a guiding "Add your first word" tooltip while the hint is active', async () => {
      await navigateTo('/home');
      const tooltips = fixture.nativeElement.querySelectorAll('.vv-add-hint-tooltip');
      expect(tooltips.length).toBeGreaterThan(0);
      expect(tooltips[0].textContent).toContain('Add your first word');
    });

    it('stops pulsing once the dictionary has at least one word', async () => {
      TestBed.inject(WordService).addWord({ word: 'Serendipity', pronunciation: '', definition: 'A happy accident', examples: [] });
      await navigateTo('/home');
      expect(getMobileFab()?.classList.contains('vv-add-hint')).toBe(false);
      expect(fixture.nativeElement.querySelector('.vv-add-hint-tooltip')).toBeFalsy();
    });

    it('stops pulsing once onboarding is dismissed', async () => {
      TestBed.inject(OnboardingService).dismiss();
      await navigateTo('/home');
      expect(getMobileFab()?.classList.contains('vv-add-hint')).toBe(false);
    });

    it('does not pulse while the add button is disabled (on an add page)', async () => {
      await navigateTo('/dictionary?addWord=true');
      expect(getMobileFab()?.classList.contains('vv-add-hint')).toBe(false);
    });
  });

  // ──────────────────────────────────────
  // Add-sheet gating (teach-through-disabling)
  // ──────────────────────────────────────

  describe('add sheet gating', () => {
    function internals() {
      return fixture.componentInstance as unknown as FeatureShellInternals;
    }
    const byId = (id: string) => internals().addActions().find((a) => a.id === id);

    it('locks Quiz and Folder (keeps Word + Import) and shows the helper note while empty', async () => {
      await navigateTo('/home');
      expect(byId('word')?.disabled).toBeFalsy();
      expect(byId('import')?.disabled).toBeFalsy();
      expect(byId('quiz')?.disabled).toBe(true);
      expect(byId('folder')?.disabled).toBe(true);
      expect(internals().addFooterNote()).toContain('unlock quizzes and folders');
    });

    it('highlights the Word action during onboarding', async () => {
      await navigateTo('/home');
      expect(byId('word')?.highlight).toBe(true);
    });

    it('unlocks Quiz and Folder and clears the note once a complete word exists', async () => {
      TestBed.inject(WordService).addWord({ word: 'Serendipity', pronunciation: '', definition: 'A happy accident', examples: [] });
      await navigateTo('/home');
      expect(byId('quiz')?.disabled).toBeFalsy();
      expect(byId('folder')?.disabled).toBeFalsy();
      expect(byId('word')?.highlight).toBe(false);
      expect(internals().addFooterNote()).toBe('');
    });

    it('keeps Quiz locked but unlocks Folder when the only word is incomplete', async () => {
      // No definition → incomplete → not quizzable, but still a word to organise.
      TestBed.inject(WordService).addWord({ word: 'Petrichor', pronunciation: '', definition: '', examples: [] });
      await navigateTo('/home');
      expect(byId('quiz')?.disabled).toBe(true);
      expect(byId('folder')?.disabled).toBeFalsy();
      expect(internals().addFooterNote()).toContain("Finish a word's definition");
    });

    it('stops highlighting Word after onboarding is dismissed, but keeps Quiz locked at 0 words', async () => {
      TestBed.inject(OnboardingService).dismiss();
      await navigateTo('/home');
      expect(byId('word')?.highlight).toBe(false);
      expect(byId('quiz')?.disabled).toBe(true);
    });
  });
});
