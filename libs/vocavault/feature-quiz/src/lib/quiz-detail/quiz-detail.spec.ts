import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { QuizDetail } from './quiz-detail';
import { QuizService, WordService, QuizSet, Word, MasteryLevel, makeWord } from '@vocavault/data-access';

const mockQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Test Quiz',
  description: 'A test quiz set',
  wordIds: ['w1', 'w2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockWords: Word[] = [
  makeWord({ id: 'w1', word: 'Apple', pronunciation: '/\u02C8\u00E6p.\u0259l/', definition: 'A round fruit', examples: ['I ate an apple'] }),
  makeWord({ id: 'w2', word: 'Banana', pronunciation: '/b\u0259\u02C8n\u0251\u02D0.n\u0259/', definition: 'A yellow fruit', examples: ['The banana is ripe'], masteryLevel: MasteryLevel.Learning }),
];

describe('QuizDetail', () => {
  let fixture: ComponentFixture<QuizDetail>;

  const setupWithQuizSet = async (quizSetId: string, quizSetData: QuizSet | undefined) => {
    const mockQuizService = {
      getQuizSet: vi.fn().mockReturnValue(quizSetData),
      getWordsForQuizSet: vi.fn().mockReturnValue(mockWords),
      getSessionInfo: vi.fn().mockReturnValue({ totalWords: mockWords.length, practicedWords: 0, totalSessions: 1, needsChunking: false }),
      getSessionWords: vi.fn().mockReturnValue(mockWords.map((w) => w.id)),
      createTempQuizSet: vi.fn(),
    };
    const mockWordService = {
      words: vi.fn().mockReturnValue(mockWords),
      getWord: vi.fn().mockImplementation((id: string) =>
        mockWords.find((w) => w.id === id)
      ),
    };

    await TestBed.configureTestingModule({
      imports: [QuizDetail],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordService, useValue: mockWordService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizDetail);
    fixture.componentRef.setInput('id', quizSetId);
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

  it('renders quiz set name when found', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Quiz');
  });

  it('shows quiz set not found when quizSet returns undefined', async () => {
    await setupWithQuizSet('nonexistent', undefined);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Quiz set not found');
  });

  it('renders word count', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('2 word');
  });

  it('has four mode start buttons', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Flashcard');
    expect(compiled.textContent).toContain('Multiple Choice');
    expect(compiled.textContent).toContain('Type');
    expect(compiled.textContent).toContain('Match');
  });

  it('renders direction picker', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Quiz direction');
  });
});
