// @vitest-environment jsdom
import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { FeatureHome } from './feature-home';
import { WordService, ProgressService, SpacedRepetitionService, QuizService, MasteryLevel, Word, makeWord } from '@vocavault/data-access';
import { OnboardingService } from '@vocavault/util';

const mockWordsSignal = signal<Word[]>([]);
const mockToughSignal = signal<Word[]>([]);
const mockEloquenceScore = signal(0);
const mockWordsLearned = signal(0);
const mockMasteryDist = signal({
  [MasteryLevel.New]: 0,
  [MasteryLevel.Learning]: 0,
  [MasteryLevel.Review]: 0,
  [MasteryLevel.Mastered]: 0,
});

const mockWordService = {
  words: mockWordsSignal.asReadonly(),
  quizzableWords: mockWordsSignal.asReadonly(),
  toughWords: mockToughSignal.asReadonly(),
  getWord: (id: string) => mockWordsSignal().find((w) => w.id === id),
};
const mockProgressService = {
  eloquenceScore: mockEloquenceScore.asReadonly(),
  wordsLearned: mockWordsLearned.asReadonly(),
  masteryDistribution: mockMasteryDist.asReadonly(),
};
const mockSrService = { getDueCount: () => 0 };
const mockQuizService = {
  createTempQuizSet: vi.fn(),
  startQuickQuiz: vi.fn().mockReturnValue({
    quizSet: { id: '__quick_quiz__', name: 'Quick Quiz', wordIds: [], createdAt: new Date(), updatedAt: new Date() },
    mode: 'flashcard',
  }),
};
const mockOnboardingStep = signal<'add-word' | 'create-quiz' | 'start-quiz' | null>(null);
// The shell owns the onboarding state machine now; home only reads the current
// step and can dismiss. No setWordCount/markQuizDone here.
const mockOnboardingService = { currentStep: mockOnboardingStep.asReadonly(), dismiss: vi.fn() };

describe('FeatureHome', () => {
  let fixture: ComponentFixture<FeatureHome>;
  let router: Router;

  beforeEach(async () => {
    // Mock IntersectionObserver so scoreVisible triggers immediately
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe() { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      disconnect() { /* mock: no-op */ }
      unobserve() { /* mock: no-op */ }
    });

    // Prefer reduced motion so animatedValue sets immediately without requestAnimationFrame.
    // Return a complete MediaQueryList stub. CDK's MediaMatcher calls addListener,
    // so a bare { matches: true } throws "addListener is not a function".
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '',
      onchange: null,
      addListener: () => { /* mock: no-op */ },
      removeListener: () => { /* mock: no-op */ },
      addEventListener: () => { /* mock: no-op */ },
      removeEventListener: () => { /* mock: no-op */ },
      dispatchEvent: () => false,
    } as MediaQueryList);

    mockWordsSignal.set([]);
    mockToughSignal.set([]);
    mockEloquenceScore.set(0);
    mockOnboardingStep.set(null);
    mockQuizService.createTempQuizSet.mockClear();
    mockQuizService.startQuickQuiz.mockClear();
    mockQuizService.startQuickQuiz.mockReturnValue({
      quizSet: { id: '__quick_quiz__', name: 'Quick Quiz', wordIds: [], createdAt: new Date(), updatedAt: new Date() },
      mode: 'flashcard',
    });
    mockMasteryDist.set({
      [MasteryLevel.New]: 0,
      [MasteryLevel.Learning]: 0,
      [MasteryLevel.Review]: 0,
      [MasteryLevel.Mastered]: 0,
    });

    await TestBed.configureTestingModule({
      imports: [FeatureHome],
      providers: [
        provideRouter([]),
        { provide: WordService, useValue: mockWordService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: SpacedRepetitionService, useValue: mockSrService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: OnboardingService, useValue: mockOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureHome);
    router = TestBed.inject(Router);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows dictionary CTA when no words', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Add Your First Word');
  });

  it('shows quiz cards and recent words when words exist', async () => {
    mockWordsSignal.set([makeWord()]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="empty-state"]')).toBeFalsy();
    expect(el.querySelector('[data-testid="quiz-card-flashcard"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="quiz-card-multiple-choice"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="quiz-card-type"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="quiz-card-match"]')).toBeTruthy();
  });

  it('limits recent words to 5', () => {
    mockWordsSignal.set(
      Array.from({ length: 8 }, (_, i) =>
        makeWord({ id: String(i), word: `word${i}`, createdAt: new Date(Date.now() - i * 1000) })
      )
    );
    fixture.detectChanges();
    // recentWords computed slices to 5
    expect(fixture.componentInstance['recentWords']().length).toBe(5);
  });

  it('sorts recent words newest first', () => {
    const older = makeWord({ id: 'old', createdAt: new Date('2026-01-01') });
    const newer = makeWord({ id: 'new', createdAt: new Date('2026-06-01') });
    mockWordsSignal.set([older, newer]);
    fixture.detectChanges();
    const recent = fixture.componentInstance['recentWords']();
    expect(recent[0].id).toBe('new');
  });

  it('navigates to /quiz/create with mode when quiz card clicked', async () => {
    mockWordsSignal.set([makeWord()]);
    fixture.detectChanges();
    await fixture.whenStable();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const card = fixture.nativeElement.querySelector('[data-testid="quiz-card-flashcard"]') as HTMLButtonElement;
    card.click();
    expect(navigateSpy).toHaveBeenCalledWith(['/quiz', 'launch'], { queryParams: { mode: 'flashcard' } });
  });

  it('shows progress preview with eloquence score', async () => {
    // Score must be set before component creation so afterNextRender captures it
    mockWordsSignal.set([makeWord()]);
    mockEloquenceScore.set(42);

    const fresh = TestBed.createComponent(FeatureHome);
    await fresh.whenStable();
    fresh.detectChanges();

    const preview: HTMLElement = fresh.nativeElement.querySelector('[data-testid="progress-preview"]');
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain('42');
  });

  describe('onboarding banner', () => {
    it('shows add-word banner when onboarding step is add-word', () => {
      mockOnboardingStep.set('add-word');
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Welcome to VocaVault!');
    });

    it('shows the "How VocaVault works" 3-step strip in the add-word banner', () => {
      mockOnboardingStep.set('add-word');
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const strip = el.querySelector('[data-testid="how-it-works"]');
      expect(strip).toBeTruthy();
      expect(strip?.textContent).toContain('How VocaVault works');
      expect(strip?.textContent).toContain('Add words');
      expect(strip?.textContent).toContain('Practice');
      expect(strip?.textContent).toContain('Master');
    });

    it('does not show the "How it works" strip once onboarding is past add-word', () => {
      mockOnboardingStep.set('create-quiz');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="how-it-works"]')).toBeFalsy();
    });

    it('shows the create-quiz banner (with the approved teaching copy) at that step', () => {
      mockOnboardingStep.set('create-quiz');
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Nice! Now build your first quiz');
      expect(el.textContent).toContain('A quiz is an editable set of words');
    });

    it('create-quiz banner navigates to /quiz/create when "Create a Quiz" is clicked', () => {
      mockOnboardingStep.set('create-quiz');
      fixture.detectChanges();
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const createBtn = Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('button, lib-button'))
        .find((el) => el.textContent?.includes('Create a Quiz'));
      expect(createBtn).toBeTruthy();
      createBtn!.click();
      expect(navigateSpy).toHaveBeenCalledWith(['/quiz', 'create']);
    });

    it('shows the start-quiz banner at that step', () => {
      mockOnboardingStep.set('start-quiz');
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Your quiz is ready!');
    });

    it('start-quiz banner navigates to /quiz when "Start Your Quiz" is clicked', () => {
      mockOnboardingStep.set('start-quiz');
      fixture.detectChanges();
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const startBtn = Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('button, lib-button'))
        .find((el) => el.textContent?.includes('Start Your Quiz'));
      expect(startBtn).toBeTruthy();
      startBtn!.click();
      expect(navigateSpy).toHaveBeenCalledWith(['/quiz']);
    });

    it('hides onboarding banner when step is null', () => {
      mockOnboardingStep.set(null);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Welcome to VocaVault!');
      expect(el.textContent).not.toContain('Nice! Now build your first quiz');
      expect(el.textContent).not.toContain('Your quiz is ready!');
    });

    it('calls dismiss when Dismiss is clicked', () => {
      mockOnboardingStep.set('add-word');
      fixture.detectChanges();
      const dismissBtn = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((b: HTMLButtonElement) => b.textContent?.trim() === 'Dismiss') as HTMLButtonElement;
      expect(dismissBtn).toBeTruthy();
      dismissBtn.click();
      expect(mockOnboardingService.dismiss).toHaveBeenCalled();
    });
  });

  it('navigates to /dictionary?addWord=true when "Add Your First Word" clicked', () => {
    mockOnboardingStep.set('add-word');
    fixture.detectChanges();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const addBtn = Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('button, lib-button'))
      .find((el) => el.textContent?.includes('Add Your First Word'));
    expect(addBtn).toBeTruthy();
    addBtn.click();
    expect(navigateSpy).toHaveBeenCalledWith(['/dictionary'], { queryParams: { addWord: true } });
  });

  describe('quick quiz', () => {
    it('delegates to quizService.startQuickQuiz and navigates to play', async () => {
      mockWordsSignal.set([makeWord()]);
      fixture.detectChanges();
      await fixture.whenStable();

      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const quickBtn = fixture.nativeElement.querySelector('button[class*="vv-card-cta"]') as HTMLButtonElement;
      expect(quickBtn).toBeTruthy();
      quickBtn.click();

      expect(mockQuizService.startQuickQuiz).toHaveBeenCalledOnce();
      expect(navigateSpy).toHaveBeenCalledWith(
        ['/quiz', '__quick_quiz__', 'play'],
        { queryParams: { mode: 'flashcard' } },
      );
    });

    it('uses the quizSet id and mode from service response for navigation', async () => {
      mockQuizService.startQuickQuiz.mockReturnValue({
        quizSet: { id: '__custom_id__', name: 'Quick Quiz', wordIds: [] },
        mode: 'match',
      });
      mockWordsSignal.set([makeWord()]);
      fixture.detectChanges();
      await fixture.whenStable();

      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const quickBtn = fixture.nativeElement.querySelector('button[class*="vv-card-cta"]') as HTMLButtonElement;
      quickBtn.click();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/quiz', '__custom_id__', 'play'],
        { queryParams: { mode: 'match' } },
      );
    });

    it('does not show quick quiz button when user has no words', () => {
      mockWordsSignal.set([]);
      fixture.detectChanges();
      const quickBtn = fixture.nativeElement.querySelector('button[class*="vv-card-cta"]');
      expect(quickBtn).toBeFalsy();
    });

    it('does not show quick quiz CTA when onboarding is active', () => {
      mockWordsSignal.set([makeWord()]);
      mockOnboardingStep.set('create-quiz');
      fixture.detectChanges();
      const ctaBtn = fixture.nativeElement.querySelector('button[class*="vv-card-cta"]');
      expect(ctaBtn).toBeFalsy();
    });
  });

  describe('tough words card', () => {
    it('does not show tough card when no tough words', () => {
      mockToughSignal.set([]);
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('[data-testid="tough-words-card"]');
      expect(card).toBeFalsy();
    });

    it('shows tough card when tough words exist', async () => {
      mockWordsSignal.set([makeWord()]);
      mockToughSignal.set([makeWord({ id: 's1' }), makeWord({ id: 's2' })]);
      fixture.detectChanges();
      await fixture.whenStable();
      const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tough-words-card"]');
      expect(card).toBeTruthy();
      expect(card.textContent).toContain('2 words worth another round');
    });

    it('navigates to flashcard play when Practice Now clicked', async () => {
      mockWordsSignal.set([makeWord()]);
      mockToughSignal.set([makeWord({ id: 's1' }), makeWord({ id: 's2' })]);
      fixture.detectChanges();
      await fixture.whenStable();

      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tough-words-card"]');
      const practiceBtn = card.querySelector('lib-button') as HTMLElement;
      practiceBtn.click();

      expect(mockQuizService.createTempQuizSet).toHaveBeenCalledWith(['s1', 's2'], 'The Tough Ones', '__tough-ones__');
      expect(navigateSpy).toHaveBeenCalledWith(
        ['/quiz', '__tough-ones__', 'play'],
        { queryParams: { mode: 'flashcard', direction: 'definition-to-word' } },
      );
    });
  });
});
