import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { QuizSetCard } from './quiz-set-card';
import { MasteryLevel, QuizService, QuizSet, makeWord } from '@vocavault/data-access';

const mockWords = [
  makeWord({ id: 'w1', word: 'w1' }),
  makeWord({ id: 'w2', word: 'w2', masteryLevel: MasteryLevel.Mastered }),
];

const mockQuizSet: QuizSet = {
  id: '1',
  name: 'My Quiz Set',
  description: 'A test quiz set.',
  wordIds: ['w1', 'w2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockQuizService = {
  getWordsForQuizSet: vi.fn().mockReturnValue(mockWords),
};

describe('QuizSetCard', () => {
  let fixture: ComponentFixture<QuizSetCard>;

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });
    }
    await TestBed.configureTestingModule({
      imports: [QuizSetCard],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(QuizSetCard);
    fixture.componentRef.setInput('quizSet', mockQuizSet);
  });

  it('renders quiz set name', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('My Quiz Set');
  });

  it('emits selected when card clicked', async () => {
    const emitted: QuizSet[] = [];
    fixture.componentInstance.selected.subscribe((qs: QuizSet) => emitted.push(qs));
    fixture.detectChanges();
    await fixture.whenStable();
    const cardDiv = fixture.nativeElement.querySelector('[role="button"]');
    cardDiv.click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe('1');
  });

  it('renders mastery distribution bar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('[role="img"]');
    expect(bar).toBeTruthy();
    const segments = bar.querySelectorAll('div');
    // 2 words: 1 New + 1 Mastered = 2 segments
    expect(segments.length).toBe(2);
  });

  it('mastery bar has correct aria-label', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('[role="img"]');
    const label = bar.getAttribute('aria-label');
    expect(label).toContain('Mastered: 1');
    expect(label).toContain('New: 1');
  });

  it('hides mastery bar when quiz set has no words', async () => {
    mockQuizService.getWordsForQuizSet.mockReturnValue([]);
    fixture.componentRef.setInput('quizSet', { ...mockQuizSet, wordIds: [] });
    fixture.detectChanges();
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('[role="img"]');
    expect(bar).toBeFalsy();
    mockQuizService.getWordsForQuizSet.mockReturnValue(mockWords);
  });

  describe('color display', () => {
    it('should render left border when quiz set has color', async () => {
      fixture.componentRef.setInput('quizSet', { ...mockQuizSet, color: '#EC4899' });
      fixture.detectChanges();
      await fixture.whenStable();
      const card: HTMLElement = fixture.nativeElement.querySelector('[role="button"]');
      expect(card.style.borderLeft).toContain('#EC4899');
    });

    it('should NOT render left border when quiz set has no color', async () => {
      fixture.componentRef.setInput('quizSet', { ...mockQuizSet, color: undefined });
      fixture.detectChanges();
      await fixture.whenStable();
      const card: HTMLElement = fixture.nativeElement.querySelector('[role="button"]');
      expect(card.style.borderLeft).toBe('');
    });

    it('should render color dot when quiz set has color', async () => {
      fixture.componentRef.setInput('quizSet', { ...mockQuizSet, color: '#EC4899' });
      fixture.detectChanges();
      await fixture.whenStable();
      const dot: HTMLElement = fixture.nativeElement.querySelector('[aria-hidden="true"].rounded-full.flex-shrink-0');
      expect(dot).toBeTruthy();
      // happy-dom returns the raw hex value, not converted to rgb
      expect(dot.style.backgroundColor).toBeTruthy();
    });

    it('should NOT render color dot when quiz set has no color', async () => {
      fixture.componentRef.setInput('quizSet', { ...mockQuizSet, color: undefined });
      fixture.detectChanges();
      await fixture.whenStable();
      // The small dot span has w-2.5 h-2.5 rounded-full, so use a distinguishing selector
      const dot = fixture.nativeElement.querySelector('.w-2\\.5.h-2\\.5.rounded-full.flex-shrink-0');
      expect(dot).toBeFalsy();
    });
  });

  it('emits deleteRequested via hold button keyboard confirm', async () => {
    const deleted: QuizSet[] = [];
    const selected: QuizSet[] = [];
    fixture.componentInstance.deleteRequested.subscribe((qs: QuizSet) => deleted.push(qs));
    fixture.componentInstance.selected.subscribe((qs: QuizSet) => selected.push(qs));
    fixture.detectChanges();
    await fixture.whenStable();
    const holdBtn = fixture.nativeElement.querySelector('lib-hold-button button');
    holdBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    holdBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(deleted).toHaveLength(1);
  });
});
