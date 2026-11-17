// @vitest-environment jsdom
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OnboardingService } from '@vocavault/util';
import { OnboardingCelebration } from './celebration';

interface Counts {
  totalWords: WritableSignal<number>;
  quizzableWords: WritableSignal<number>;
  quizSets: WritableSignal<number>;
  completedQuizzes: WritableSignal<number>;
}

describe('OnboardingCelebration', () => {
  let fixture: ComponentFixture<OnboardingCelebration>;
  let onboarding: OnboardingService;
  let counts: Counts;

  function wire(init: Partial<Record<keyof Counts, number>> = {}): void {
    counts = {
      totalWords: signal(init.totalWords ?? 0),
      quizzableWords: signal(init.quizzableWords ?? 0),
      quizSets: signal(init.quizSets ?? 0),
      completedQuizzes: signal(init.completedQuizzes ?? 0),
    };
    onboarding.setContext({
      totalWords: counts.totalWords.asReadonly(),
      quizzableWords: counts.quizzableWords.asReadonly(),
      quizSets: counts.quizSets.asReadonly(),
      completedQuizzes: counts.completedQuizzes.asReadonly(),
    });
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [OnboardingCelebration],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    onboarding = TestBed.inject(OnboardingService);
    fixture = TestBed.createComponent(OnboardingCelebration);
  });

  // Focus-trap autocapture in the bottom sheet needs an explicit teardown.
  afterEach(() => fixture.destroy());

  function panel(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="bottom-sheet-panel"]');
  }

  it('stays hidden until the loop is complete', () => {
    wire({ totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 0 });
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('shows the celebration once the first quiz is completed', () => {
    wire({ totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 0 });
    fixture.detectChanges();

    counts.completedQuizzes.set(1);
    fixture.detectChanges();

    const p = panel();
    expect(p).not.toBeNull();
    expect(p?.textContent).toContain('Congratulations!');
    expect(p?.textContent).toContain("You're now expanding your vocabulary!");
    // Decorative confetti is rendered inside the sheet.
    expect(p?.querySelectorAll('.vv-confetti-piece').length).toBeGreaterThan(0);
  });

  it('"Continue" acknowledges the celebration and hides it', () => {
    wire({ totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 0 });
    fixture.detectChanges();
    counts.completedQuizzes.set(1); // complete the loop for the first time
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    const cta = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b): b is HTMLButtonElement => (b as HTMLButtonElement).textContent?.trim() === 'Continue');
    cta?.click();
    fixture.detectChanges();

    expect(onboarding.showCelebration()).toBe(false);
    expect(panel()).toBeNull();
  });
});
