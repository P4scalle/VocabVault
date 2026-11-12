import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { animate, query, style, transition, trigger } from '@angular/animations';
import { toSignal } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';
import { ActionDrawer, ActionDrawerConfig, ActionDrawerItem, AdaptiveNav, BackHintService, KeyboardShortcuts, NavItem, ToastContainer, ToastService } from '@vocavault/ui';
import { DataExportService, HasUnsavedChanges, WordService } from '@vocavault/data-access';
import { ChromeService, OnboardingService, ThemeService } from '@vocavault/util';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ],
      { optional: true },
    ),
  ]),
]);

@Component({
  selector: 'lib-feature-shell',
  imports: [RouterOutlet, ActionDrawer, AdaptiveNav, ToastContainer, KeyboardShortcuts],
  templateUrl: './feature-shell.html',
  styleUrl: './feature-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [routeAnimations],
})
export class FeatureShell implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly backHint = inject(BackHintService);
  protected readonly chrome = inject(ChromeService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly dataExport = inject(DataExportService);
  private readonly el = inject(ElementRef);
  private lastDisabledTap = 0;

  protected readonly settingsOpen = signal(false);

  protected toggleSettings(): void {
    this.settingsOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.settingsOpen() && !this.el.nativeElement.querySelector('.vv-settings-dropdown')?.contains(event.target as Node)) {
      this.settingsOpen.set(false);
    }
  }

  /** Track whether the current route is an "add" page where the FAB should be hidden */
  protected readonly isOnAddPage = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e: NavigationEnd) => {
        const url = new URL(e.urlAfterRedirects, 'http://x');
        const path = url.pathname;
        const params = url.searchParams;
        return (
          params.has('addWord') ||
          params.has('addFolder') ||
          path === '/quiz/create'
        );
      }),
      startWith(false),
    ),
    { initialValue: false },
  );

  protected readonly fabDisabled = computed(() => this.isOnAddPage());

  protected readonly hideFab = computed(() => this.isOnAddPage());

  protected readonly isNavigating = toSignal(
    merge(
      this.router.events.pipe(filter((e) => e instanceof NavigationStart), map(() => true)),
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => false)),
    ).pipe(startWith(false)),
    { initialValue: false },
  );

  protected getRouteAnimationState(outlet: RouterOutlet): string {
    if (!outlet?.isActivated) return '';
    return outlet.activatedRouteData?.['animation'] ?? outlet.activatedRoute?.snapshot?.url?.[0]?.path ?? '';
  }

  ngOnInit(): void {
    const onResize = () => this.isDesktop.set(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));

    // No VisualViewport keyboard detection needed — the fixed footer
    // sits under the keyboard naturally (same as the bottom nav bar).
  }

  protected readonly navItems: NavItem[] = [
    { label: 'Home', path: '/home', iconClass: 'pi pi-home' },
    { label: 'Dictionary', path: '/dictionary', iconClass: 'pi pi-book' },
    { label: 'Quiz', path: '/quiz', iconClass: 'pi pi-bolt' },
    { label: 'Progress', path: '/progress', iconClass: 'pi pi-chart-line' },
  ];

  protected readonly addTriggerId = 'vv-add-trigger';
  protected readonly addDrawerVisible = signal(false);
  protected readonly isDesktop = signal(typeof window !== 'undefined' && window.innerWidth >= 1024);
  protected readonly addDrawerConfig = computed<Partial<ActionDrawerConfig>>(() => ({
    drawerId: 'vv-add-drawer',
    title: 'Add',
    ariaLabel: 'Add options',
    triggerId: this.addTriggerId,
    position: 'bottom',
  }));
  private readonly wordService = inject(WordService);
  private readonly onboarding = inject(OnboardingService);
  private readonly hasWords = computed(() => this.wordService.words().length > 0);
  /** Quizzes need at least one *complete* word (incomplete ones can't be quizzed). */
  private readonly hasQuizzableWords = computed(() => this.wordService.quizzableWords().length > 0);

  /**
   * Nudge a brand-new user toward the add button: pulse it while the dictionary
   * is empty, the user hasn't dismissed onboarding, and the button is active.
   */
  protected readonly showAddHint = computed(
    () => !this.hasWords() && !this.onboarding.dismissed() && !this.fabDisabled(),
  );
  protected readonly addActions = computed<readonly ActionDrawerItem[]>(() => {
    const hw = this.hasWords();
    const guide = this.showAddHint();
    return [
      { id: 'word', label: 'Word', description: 'Add a new word to your dictionary.', iconClass: 'pi pi-file-edit', highlight: guide },
      { id: 'quiz', label: 'Quiz', description: 'Create a new quiz set.', iconClass: 'pi pi-bolt', disabled: !this.hasQuizzableWords() },
      { id: 'folder', label: 'Folder', description: 'Create a folder to organize words.', iconClass: 'pi pi-folder', disabled: !hw },
      { id: 'import', label: 'Import Words', description: 'Paste or upload multiple words at once.', iconClass: 'pi pi-upload' },
    ];
  });

  /** Helper line shown in the add sheet while quizzes and/or folders are locked. */
  protected readonly addFooterNote = computed(() => {
    if (!this.hasWords()) return 'Add your first word to unlock quizzes and folders.';
    if (!this.hasQuizzableWords()) return "Finish a word's definition to unlock quizzes.";
    return '';
  });

  protected onFabClick(): void {
    if (this.fabDisabled()) {
      const now = Date.now();
      if (now - this.lastDisabledTap < 500) {
        this.backHint.trigger();
        this.lastDisabledTap = 0;
      } else {
        this.lastDisabledTap = now;
      }
      return;
    }
    this.addDrawerVisible.set(!this.addDrawerVisible());
  }

  private readonly routerOutlet = viewChild(RouterOutlet);

  protected navigateHome(): void {
    const component = this.findActiveComponent();
    if (component && 'hasUnsavedChanges' in component) {
      const guarded = component as HasUnsavedChanges;
      if (guarded.hasUnsavedChanges()) {
        const leave = window.confirm(
          'You have unsaved changes. Leaving now means your progress will be lost. Leave anyway?'
        );
        if (!leave) return;
      }
    }
    void this.router.navigate(['/home']);
  }

  private findActiveComponent(): object | null {
    const outlet = this.routerOutlet();
    if (!outlet?.isActivated) return null;
    return outlet.component as object;
  }

  protected onExport(): void {
    this.dataExport.exportAll();
    this.toast.show('Backup downloaded!');
  }

  protected readonly fileInput = signal<HTMLInputElement | null>(null);

  protected onImportClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const counts = await this.dataExport.importFromFile(file);
        const parts: string[] = [];
        if (counts.words) parts.push(`${counts.words} words`);
        if (counts.folders) parts.push(`${counts.folders} folders`);
        if (counts.quizSets) parts.push(`${counts.quizSets} quizzes`);
        this.toast.show(parts.length > 0 ? `Imported ${parts.join(', ')}` : 'No new data to import', 'info');
      } catch {
        this.toast.show('Invalid backup file', 'error');
      }
    };
    input.click();
  }

  protected onAddActionSelected(action: ActionDrawerItem): void {
    switch (action.id) {
      case 'word':
        void this.router.navigate(['/dictionary'], { queryParams: { addWord: 'true' } });
        break;
      case 'quiz':
        void this.router.navigate(['/quiz', 'create']);
        break;
      case 'folder':
        void this.router.navigate(['/dictionary'], { queryParams: { addFolder: 'true' } });
        break;
      case 'import':
        void this.router.navigate(['/dictionary'], { queryParams: { importWords: 'true' } });
        break;
      default:
        break;
    }
    this.addDrawerVisible.set(false);
  }
}
