import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { vi } from 'vitest';
import { QuizPlayRouter } from './quiz-play-router';
import { ChromeService } from '@vocavault/util';

@Component({ selector: 'lib-flashcard-quiz', template: '<p>flashcard-stub</p>', standalone: true })
class MockFlashcardQuiz {
  readonly hasUnsavedChanges = signal(false);
}

@Component({ selector: 'lib-multiple-choice-quiz', template: '<p>multiple-choice-stub</p>', standalone: true })
class MockMultipleChoiceQuiz {
  readonly hasUnsavedChanges = signal(false);
}

@Component({ selector: 'lib-type-quiz', template: '<p>type-stub</p>', standalone: true })
class MockTypeQuiz {
  readonly hasUnsavedChanges = signal(false);
}

@Component({ selector: 'lib-match-quiz', template: '<p>match-stub</p>', standalone: true })
class MockMatchQuiz {
  readonly hasUnsavedChanges = signal(false);
}

describe('QuizPlayRouter', () => {
  let component: QuizPlayRouter;
  let fixture: ComponentFixture<QuizPlayRouter>;
  let mockChrome: { enterFocus: ReturnType<typeof vi.fn>; leaveFocus: ReturnType<typeof vi.fn>; focusMode: ReturnType<typeof signal<boolean>> };

  const setup = async (modeParam = 'flashcard') => {
    mockChrome = { enterFocus: vi.fn(), leaveFocus: vi.fn(), focusMode: signal(false) };

    await TestBed.configureTestingModule({
      imports: [QuizPlayRouter],
      providers: [
        provideRouter([]),
        { provide: ChromeService, useValue: mockChrome },
      ],
    })
      .overrideComponent(QuizPlayRouter, {
        set: { imports: [MockFlashcardQuiz, MockMultipleChoiceQuiz, MockTypeQuiz, MockMatchQuiz] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(QuizPlayRouter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'test-id');
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

  it('defaults to flashcard mode', async () => {
    await setup('flashcard');
    expect(component.mode()).toBe('flashcard');
  });

  it('reads mode from input', async () => {
    await setup('type');
    expect(component.mode()).toBe('type');
  });

  it('renders flashcard quiz component for flashcard mode', async () => {
    await setup('flashcard');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('flashcard-stub');
  });

  it('renders multiple-choice quiz component for multiple-choice mode', async () => {
    await setup('multiple-choice');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('multiple-choice-stub');
  });

  it('renders type quiz component for type mode', async () => {
    await setup('type');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('type-stub');
  });

  it('renders match quiz component for match mode', async () => {
    await setup('match');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('match-stub');
  });

  it('renders unknown mode message for unrecognized mode', async () => {
    await setup('bogus');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Unknown quiz mode');
  });

  // ── hasUnsavedChanges delegation ──

  it('hasUnsavedChanges is false when child has no unsaved changes', async () => {
    await setup('flashcard');
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('hasUnsavedChanges returns false when no viewChild resolves (mock override)', async () => {
    await setup('flashcard');
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  // ── ChromeService focus mode ──

  it('enters focus mode on creation', async () => {
    await setup();
    expect(mockChrome.enterFocus).toHaveBeenCalled();
  });

  // ── Sticky header (mobile layout) ──

  it('wraps page header in a sticky container with mobile-only classes', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const stickyWrapper = el.querySelector('.sticky.top-0');
    expect(stickyWrapper).toBeTruthy();
    expect(stickyWrapper?.classList.contains('z-30')).toBe(true);
  });

  it('sticky header reverts to static on tablet via md: breakpoint classes', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const stickyWrapper = el.querySelector('.sticky.top-0');
    expect(stickyWrapper?.className).toContain('md:static');
    expect(stickyWrapper?.className).toContain('md:bg-transparent');
  });
});
