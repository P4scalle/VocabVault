import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, Signal, signal } from '@angular/core';
import { vi } from 'vitest';
import { SmartReviewLauncher } from './smart-review-launcher';
import {
  QuizService,
  QuizModeInfo,
  SpacedRepetitionService,
  WordService,
  Word,
  MasteryLevel,
  StorageService,
  LocalStorageService,
  makeWord,
} from '@vocavault/data-access';

interface SmartReviewLauncherInternals {
  dueCount: Signal<number>;
  quizModes: readonly QuizModeInfo[];
  startMode: (mode: string) => void;
  goBack: () => void;
}

const mockDueWords: Word[] = [
  makeWord({ id: 'w1', word: 'Apple', pronunciation: '/ˈæp.əl/', definition: 'A round fruit', examples: ['I ate an apple'], masteryLevel: MasteryLevel.Learning }),
  makeWord({ id: 'w2', word: 'Banana', pronunciation: '/bəˈnɑː.nə/', definition: 'A yellow fruit', examples: ['The banana is ripe'] }),
];

describe('SmartReviewLauncher', () => {
  let component: SmartReviewLauncher;
  let fixture: ComponentFixture<SmartReviewLauncher>;
  let router: Router;
  let mockQuizService: { createTempQuizSet: ReturnType<typeof vi.fn> };
  let mockSrService: { getWordsDueForReview: ReturnType<typeof vi.fn> };
  let mockWordService: { words: ReturnType<typeof signal<Word[]>>; quizzableWords: ReturnType<typeof computed> };

  const setup = async (dueWords: Word[] = mockDueWords) => {
    const wordsSignal = signal(dueWords);
    mockWordService = { words: wordsSignal, quizzableWords: computed(() => wordsSignal().filter((w) => !w.incomplete)) };
    mockSrService = { getWordsDueForReview: vi.fn().mockReturnValue(dueWords) };
    mockQuizService = { createTempQuizSet: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SmartReviewLauncher],
      providers: [
        provideRouter([]),
        { provide: WordService, useValue: mockWordService },
        { provide: SpacedRepetitionService, useValue: mockSrService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(SmartReviewLauncher);
    component = fixture.componentInstance;
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

  it('dueCount reflects number of due words', async () => {
    await setup(mockDueWords);
    expect((component as unknown as SmartReviewLauncherInternals).dueCount()).toBe(2);
  });

  it('renders due word count in template', async () => {
    await setup(mockDueWords);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('2 words due for review');
  });

  it('renders singular "word" when dueCount is 1', async () => {
    await setup([mockDueWords[0]]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1 word due for review');
  });

  it('renders quiz mode buttons when words are due', async () => {
    await setup(mockDueWords);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Flashcard');
    expect(compiled.textContent).toContain('Multiple Choice');
    expect(compiled.textContent).toContain('Write');
    expect(compiled.textContent).toContain('Match');
  });

  it('renders empty state when no words are due', async () => {
    await setup([]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('All caught up');
  });

  it('startMode creates temp quiz set and navigates to play route with direction', async () => {
    await setup(mockDueWords);

    (component as unknown as SmartReviewLauncherInternals).startMode('flashcard');

    expect(mockQuizService.createTempQuizSet).toHaveBeenCalledWith(['w1', 'w2']);
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', '__smart_review__', 'play'], {
      queryParams: { mode: 'flashcard', direction: 'definition-to-word' },
    });
  });

  it('startMode works with different modes and includes direction', async () => {
    // Match needs at least 4 words to be viable, so provide enough.
    const fourDue = [
      ...mockDueWords,
      makeWord({ id: 'w3', word: 'Cherry', definition: 'A small red fruit' }),
      makeWord({ id: 'w4', word: 'Date', definition: 'A sweet brown fruit' }),
    ];
    await setup(fourDue);

    (component as unknown as SmartReviewLauncherInternals).startMode('match');

    expect(router.navigate).toHaveBeenCalledWith(['/quiz', '__smart_review__', 'play'], {
      queryParams: { mode: 'match', direction: 'definition-to-word' },
    });
  });

  it('locks match and multiple-choice until enough words are due', async () => {
    await setup(mockDueWords); // only 2 due words

    const internals = component as unknown as SmartReviewLauncherInternals & {
      isModeDisabled: (mode: string) => boolean;
    };
    expect(internals.isModeDisabled('match')).toBe(true);
    expect(internals.isModeDisabled('multiple-choice')).toBe(true);
    expect(internals.isModeDisabled('flashcard')).toBe(false);
    expect(internals.isModeDisabled('type')).toBe(false);

    // A locked mode must not navigate even if invoked directly.
    internals.startMode('match');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('goBack navigates to /home', async () => {
    await setup();

    (component as unknown as SmartReviewLauncherInternals).goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('quizModes has 4 entries', async () => {
    await setup();
    expect((component as unknown as SmartReviewLauncherInternals).quizModes).toHaveLength(4);
  });

  it('dueCount is 0 when no words are due', async () => {
    await setup([]);
    expect((component as unknown as SmartReviewLauncherInternals).dueCount()).toBe(0);
  });
});
