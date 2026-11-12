import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { vi } from 'vitest';
import { QuizCreate } from './quiz-create';
import { QuizService, StorageService, LocalStorageService } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';
import { OnboardingService } from '@vocavault/util';
import { QuizSetFormData } from '../quiz-set-form/quiz-set-form';

interface QuizCreateInternals {
  onSaved: (data: QuizSetFormData) => void;
  onCancelled: () => void;
}

@Component({ selector: 'lib-quiz-set-form', template: '', standalone: true })
class MockQuizSetForm {}

describe('QuizCreate', () => {
  let component: QuizCreate;
  let fixture: ComponentFixture<QuizCreate>;
  let router: Router;
  let mockQuizService: {
    addQuizSet: ReturnType<typeof vi.fn>;
  };
  let mockToastService: {
    show: ReturnType<typeof vi.fn>;
  };

  const setup = async (modeInput?: string) => {
    localStorage.clear();
    mockQuizService = {
      addQuizSet: vi.fn().mockReturnValue({ quizSet: { id: 'new-qs-1', name: 'New Quiz', wordIds: ['w1'] }, ok: true }),
    };
    mockToastService = { show: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [QuizCreate],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
        { provide: ToastService, useValue: mockToastService },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    })
      .overrideComponent(QuizCreate, {
        set: { imports: [MockQuizSetForm] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(QuizCreate);
    component = fixture.componentInstance;
    if (modeInput) {
      fixture.componentRef.setInput('mode', modeInput);
    }
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

  it('onSaved calls addQuizSet, shows toast, and navigates to /quiz/:id detail page when no preselected mode', async () => {
    await setup();
    const formData = { name: 'My Quiz', description: 'Desc', wordIds: ['w1', 'w2'] };

    (component as unknown as QuizCreateInternals).onSaved(formData);

    expect(mockQuizService.addQuizSet).toHaveBeenCalledWith(formData);
    expect(mockToastService.show).toHaveBeenCalledWith('Quiz created!');
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'new-qs-1']);
  });

  it('onSaved navigates to play route with mode and direction when preselected mode exists', async () => {
    await setup('flashcard');
    const formData = { name: 'My Quiz', description: 'Desc', wordIds: ['w1'] };

    (component as unknown as QuizCreateInternals).onSaved(formData);

    expect(mockQuizService.addQuizSet).toHaveBeenCalledWith(formData);
    expect(mockToastService.show).toHaveBeenCalledWith('Quiz created!');
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'new-qs-1', 'play'], {
      queryParams: { mode: 'flashcard', direction: 'definition-to-word' },
    });
  });

  it('onSaved shows error toast when storage fails', async () => {
    await setup('flashcard');
    mockQuizService.addQuizSet.mockReturnValue({ quizSet: null, ok: false });
    const formData = { name: 'My Quiz', description: 'Desc', wordIds: ['w1'] };

    (component as unknown as QuizCreateInternals).onSaved(formData);

    expect(mockToastService.show).toHaveBeenCalledWith('Could not save. Storage may be full.', 'error');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('onCancelled navigates to /quiz', async () => {
    await setup();

    (component as unknown as QuizCreateInternals).onCancelled();

    expect(router.navigate).toHaveBeenCalledWith(['/quiz']);
  });

  it('shows the teaching banner at the create-quiz milestone', async () => {
    await setup();
    TestBed.inject(OnboardingService).setContext({
      totalWords: signal(1),
      quizzableWords: signal(1),
      quizSets: signal(0),
      completedQuizzes: signal(0),
    });
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="create-quiz-teaching"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('editable set of words');
  });

  it('hides the teaching banner when not at the create-quiz milestone', async () => {
    await setup();
    // Default context has 0 words, so the step is add-word, not create-quiz.
    expect(fixture.nativeElement.querySelector('[data-testid="create-quiz-teaching"]')).toBeFalsy();
  });
});
