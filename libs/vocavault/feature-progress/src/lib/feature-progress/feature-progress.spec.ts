import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { FeatureProgress } from './feature-progress';
import { WordService, ProgressService, SpacedRepetitionService, MasteryLevel, makeWord, Word, QuizResult } from '@vocavault/data-access';

const mockWords = signal<Word[]>([]);
const mockResults = signal<QuizResult[]>([]);
const mockEloquenceScore = signal(0);
const mockWordsLearned = signal(0);
const mockMasteryDist = signal({
  [MasteryLevel.New]: 0,
  [MasteryLevel.Learning]: 0,
  [MasteryLevel.Review]: 0,
  [MasteryLevel.Mastered]: 0,
});

const mockWordService = {
  words: mockWords.asReadonly(),
  quizzableWords: computed(() => mockWords().filter((w) => !w.incomplete)),
  flaggedWords: computed(() => []),
};

const mockProgressService = {
  results: mockResults.asReadonly(),
  eloquenceScore: mockEloquenceScore.asReadonly(),
  wordsLearned: mockWordsLearned.asReadonly(),
  masteryDistribution: mockMasteryDist.asReadonly(),
  snapshots: signal([]).asReadonly(),
  streak: signal({ currentStreak: 0, longestStreak: 0, lastActiveDate: '' }).asReadonly(),
  wordsThisWeek: signal(0).asReadonly(),
  quizzesThisWeek: signal(0).asReadonly(),
  weekOverWeek: signal(null).asReadonly(),
};

const mockSrService = {
  getDueCount: () => 0,
  getWordsDueForReview: () => [],
};

describe('FeatureProgress', () => {
  let fixture: ComponentFixture<FeatureProgress>;

  beforeEach(async () => {
    mockWords.set([]);
    mockResults.set([]);
    mockEloquenceScore.set(0);
    mockWordsLearned.set(0);
    mockMasteryDist.set({
      [MasteryLevel.New]: 0,
      [MasteryLevel.Learning]: 0,
      [MasteryLevel.Review]: 0,
      [MasteryLevel.Mastered]: 0,
    });

    await TestBed.configureTestingModule({
      imports: [FeatureProgress],
      providers: [
        { provide: WordService, useValue: mockWordService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: SpacedRepetitionService, useValue: mockSrService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureProgress);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows empty state when no words', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="empty-state"]')).toBeTruthy();
  });

  it('does not show eloquence card when no words', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="eloquence-card"]')).toBeFalsy();
  });

  it('shows eloquence card when words exist', async () => {
    mockWords.set([makeWord()]);
    mockEloquenceScore.set(42);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="empty-state"]')).toBeFalsy();
    expect(el.querySelector('[data-testid="eloquence-card"]')).toBeTruthy();
  });

  it('renders 4 mastery breakdown rows', async () => {
    mockWords.set([makeWord({ masteryLevel: MasteryLevel.Mastered })]);
    mockMasteryDist.set({
      [MasteryLevel.New]: 2,
      [MasteryLevel.Learning]: 1,
      [MasteryLevel.Review]: 3,
      [MasteryLevel.Mastered]: 1,
    });
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="mastery-row"]');
    expect(rows.length).toBe(4);
  });

  it('computes accuracy as average of result.accuracy values', async () => {
    mockWords.set([makeWord()]);
    mockResults.set([
      {
        id: 'r1',
        quizSetId: 'qs1',
        score: 8,
        totalQuestions: 10,
        accuracy: 80,
        wordResults: [],
        completedAt: new Date(),
      },
      {
        id: 'r2',
        quizSetId: 'qs1',
        score: 6,
        totalQuestions: 10,
        accuracy: 60,
        wordResults: [],
        completedAt: new Date(),
      },
    ]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // accuracy = round((80+60)/2) = 70
    expect(el.textContent).toContain('70%');
  });

  it('shows 0% accuracy when no results', async () => {
    mockWords.set([makeWord()]);
    mockResults.set([]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('0%');
  });

  it('reflects wordsLearned from mock service', async () => {
    mockWords.set([makeWord({ masteryLevel: MasteryLevel.Mastered })]);
    mockWordsLearned.set(5);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('5');
  });
});
