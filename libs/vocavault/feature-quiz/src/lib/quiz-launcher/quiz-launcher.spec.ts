import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { QuizLauncher } from './quiz-launcher';
import { QuizService, QuizSet, StorageService, LocalStorageService, QuizModeInfo } from '@vocavault/data-access';
import { Signal } from '@angular/core';

interface QuizLauncherInternals {
  modeInfo: Signal<QuizModeInfo>;
  quizSets: Signal<QuizSet[]>;
  startWithExisting: (quizSetId: string) => void;
  createNew: () => void;
  goBack: () => void;
}

const mockQuizSets: QuizSet[] = [
  {
    id: 'qs1',
    name: 'Fruits Quiz',
    description: 'A quiz about fruits',
    wordIds: ['w1', 'w2'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'qs2',
    name: 'Empty Quiz',
    description: 'No words',
    wordIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('QuizLauncher', () => {
  let component: QuizLauncher;
  let fixture: ComponentFixture<QuizLauncher>;
  let router: Router;
  let mockQuizService: { quizSets: ReturnType<typeof signal> };

  const setup = async (modeParam = 'flashcard', quizSets: QuizSet[] = mockQuizSets) => {
    mockQuizService = {
      quizSets: signal(quizSets),
    };

    await TestBed.configureTestingModule({
      imports: [QuizLauncher],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(QuizLauncher);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', modeParam);
    fixture.detectChanges();
  };

  // Settle pending async work while the component is still attached, then
  // destroy deterministically so no stale real-router navigation can surface in
  // a later test as an unhandled rejection under parallel load.
  afterEach(async () => {
    if (fixture) {
      await fixture.whenStable();
      fixture.destroy();
    }
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('defaults mode to flashcard', async () => {
    await setup('flashcard');
    expect(component.mode()).toBe('flashcard');
  });

  it('reads mode from input', async () => {
    await setup('multiple-choice');
    expect(component.mode()).toBe('multiple-choice');
  });

  it('resolves modeInfo for known modes', async () => {
    await setup('multiple-choice');
    expect((component as unknown as QuizLauncherInternals).modeInfo().label).toBe('Multiple Choice');
  });

  it('falls back to flashcard modeInfo for unknown mode', async () => {
    await setup('unknown-mode');
    expect((component as unknown as QuizLauncherInternals).modeInfo().label).toBe('Flashcard');
  });

  it('quizSets computed filters out sets with empty wordIds', async () => {
    await setup('flashcard', mockQuizSets);
    const filtered = (component as unknown as QuizLauncherInternals).quizSets();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('qs1');
  });

  it('renders quiz set names in the template', async () => {
    await setup();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Fruits Quiz');
    expect(compiled.textContent).not.toContain('Empty Quiz');
  });

  it('renders mode label in heading', async () => {
    await setup('flashcard');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Start Flashcard Quiz');
  });

  it('startWithExisting navigates to play route with mode and direction query params', async () => {
    await setup('type');

    (component as unknown as QuizLauncherInternals).startWithExisting('qs1');

    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'qs1', 'play'], {
      queryParams: { mode: 'type', direction: 'definition-to-word' },
    });
  });

  it('createNew navigates to /quiz/create', async () => {
    await setup();

    (component as unknown as QuizLauncherInternals).createNew();

    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'create']);
  });

  it('goBack navigates to /home', async () => {
    await setup();

    (component as unknown as QuizLauncherInternals).goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('shows "Create New Quiz Set" button in template', async () => {
    await setup();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Create New Quiz Set');
  });

  it('renders no quiz set buttons when all sets have empty wordIds', async () => {
    await setup('flashcard', [
      { id: 'qs-empty', name: 'Empty', description: '', wordIds: [], createdAt: new Date(), updatedAt: new Date() },
    ]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Empty');
    expect(compiled.textContent).not.toContain('Your Quiz Sets');
  });
});
