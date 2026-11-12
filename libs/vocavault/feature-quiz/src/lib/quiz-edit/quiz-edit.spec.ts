import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { computed, signal } from '@angular/core';
import { vi } from 'vitest';
import { QuizEdit } from './quiz-edit';
import { QuizService, QuizSet, WordService, FolderService, StorageService, LocalStorageService, Word } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';
import { Signal } from '@angular/core';
import { QuizSetFormData } from '../quiz-set-form/quiz-set-form';

interface QuizEditInternals {
  quizSet: Signal<QuizSet | undefined>;
  onSaved: (data: QuizSetFormData) => void;
  onCancelled: () => void;
  onDelete: () => void;
}

const mockQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Test Quiz',
  description: 'A test description',
  wordIds: ['w1', 'w2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('QuizEdit', () => {
  let component: QuizEdit;
  let fixture: ComponentFixture<QuizEdit>;
  let router: Router;
  let mockQuizService: {
    getQuizSet: ReturnType<typeof vi.fn>;
    updateQuizSet: ReturnType<typeof vi.fn>;
    deleteQuizSet: ReturnType<typeof vi.fn>;
    restoreQuizSet: ReturnType<typeof vi.fn>;
  };
  let mockToastService: {
    show: ReturnType<typeof vi.fn>;
    showWithAction: ReturnType<typeof vi.fn>;
  };

  const setup = async (paramId = 'qs1', quizSetData: QuizSet | undefined = mockQuizSet) => {
    mockQuizService = {
      getQuizSet: vi.fn().mockReturnValue(quizSetData),
      updateQuizSet: vi.fn().mockReturnValue(true),
      deleteQuizSet: vi.fn().mockReturnValue(true),
      restoreQuizSet: vi.fn().mockReturnValue(true),
    };
    mockToastService = { show: vi.fn(), showWithAction: vi.fn() };

    TestBed.overrideProvider(QuizService, { useValue: mockQuizService });
    TestBed.overrideProvider(ToastService, { useValue: mockToastService });
    const editWords = signal<Word[]>([]);
    TestBed.overrideProvider(WordService, { useValue: { words: editWords, quizzableWords: computed(() => editWords().filter((w: Word) => !w.incomplete)) } });
    TestBed.overrideProvider(FolderService, { useValue: { folders: signal([]) } });

    await TestBed.configureTestingModule({
      imports: [QuizEdit],
      providers: [
        provideRouter([]),
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(QuizEdit);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', paramId);
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

  it('quizSet computed returns the quiz set from service', async () => {
    await setup('qs1');
    expect((component as unknown as QuizEditInternals).quizSet()).toEqual(mockQuizSet);
    expect(mockQuizService.getQuizSet).toHaveBeenCalledWith('qs1');
  });

  it('calls getQuizSet with the input id', async () => {
    await setup('my-quiz-id');
    (component as unknown as QuizEditInternals).quizSet();
    expect(mockQuizService.getQuizSet).toHaveBeenCalledWith('my-quiz-id');
  });

  it('onSaved calls updateQuizSet, shows toast, and navigates to quiz detail', async () => {
    await setup('qs1');
    const formData = { name: 'Updated Quiz', description: 'Updated desc', wordIds: ['w1'] };

    (component as unknown as QuizEditInternals).onSaved(formData);

    expect(mockQuizService.updateQuizSet).toHaveBeenCalledWith('qs1', formData);
    expect(mockToastService.show).toHaveBeenCalledWith('Quiz updated!');
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'qs1']);
  });

  it('onCancelled navigates to quiz detail', async () => {
    await setup('qs1');

    (component as unknown as QuizEditInternals).onCancelled();

    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'qs1']);
  });

  it('onDelete calls deleteQuizSet, shows undo toast, and navigates to /quiz', async () => {
    await setup('qs1');

    (component as unknown as QuizEditInternals).onDelete();

    expect(mockQuizService.deleteQuizSet).toHaveBeenCalledWith('qs1');
    expect(mockToastService.showWithAction).toHaveBeenCalledWith(
      'Quiz deleted',
      expect.objectContaining({ label: 'Undo' }),
      'info',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/quiz']);
  });

  it('onDelete undo restores quiz set and navigates back to edit', async () => {
    await setup('qs1');

    let undoCallback: (() => void) | undefined;
    mockToastService.showWithAction.mockImplementation(
      (_msg: string, action: { label: string; callback: () => void }) => {
        undoCallback = action.callback;
      },
    );

    (component as unknown as QuizEditInternals).onDelete();

    expect(undoCallback).toBeDefined();
    if (undoCallback) undoCallback();

    expect(mockQuizService.restoreQuizSet).toHaveBeenCalledWith(mockQuizSet);
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'qs1', 'edit']);
  });
});
