import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Word, makeWord } from '@vocavault/data-access';
import { QuizExplainSheet } from './quiz-explain-sheet';

const baseWord = (over: Partial<Word> = {}): Word =>
  makeWord({
    id: 'w1',
    word: 'Ephemeral',
    pronunciation: '/ɪˈfɛm(ə)rəl/',
    definition: 'adj. Lasting for a very short time.',
    examples: ['The ephemeral beauty of cherry blossoms.'],
    ...over,
  });

const panelOf = (f: ComponentFixture<QuizExplainSheet>): HTMLElement | null =>
  f.nativeElement.querySelector('[data-testid="bottom-sheet-panel"]');

describe('QuizExplainSheet', () => {
  let fixture: ComponentFixture<QuizExplainSheet>;
  let component: QuizExplainSheet;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuizExplainSheet] }).compileComponents();
    fixture = TestBed.createComponent(QuizExplainSheet);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // The embedded BottomSheet traps focus (cdkTrapFocusAutoCapture). Destroy the
  // fixture so the trap is released and does not leak into sibling specs.
  afterEach(async () => {
    if (fixture) {
      await fixture.whenStable();
      fixture.destroy();
    }
  });

  const open = async (over: Partial<Word> = {}, picked = 'Whims') => {
    component.data.set({ word: baseWord(over), picked });
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('renders no panel while data is null', () => {
    expect(panelOf(fixture)).toBeNull();
  });

  it('opens and shows the expected word when data is set', async () => {
    await open();
    const panel = panelOf(fixture);
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('Ephemeral');
  });

  it('shows the definition as the meaning', async () => {
    await open();
    expect(panelOf(fixture)?.textContent).toContain('Lasting for a very short time');
  });

  it('shows pronunciation when present and hides it when empty', async () => {
    await open();
    expect(panelOf(fixture)?.textContent).toContain('/ɪˈfɛm(ə)rəl/');

    await open({ pronunciation: '' });
    expect(panelOf(fixture)?.textContent).not.toContain('/ɪˈfɛm(ə)rəl/');
  });

  it('shows the "In context" example when present and hides it when there are none', async () => {
    await open();
    const withEx = panelOf(fixture);
    expect(withEx?.textContent).toContain('In context');
    expect(withEx?.textContent).toContain('cherry blossoms');

    await open({ examples: [] });
    expect(panelOf(fixture)?.textContent).not.toContain('In context');
  });

  it('shows "You answered" with the picked text, hidden when the pick is blank', async () => {
    await open({}, 'Whims');
    expect(panelOf(fixture)?.textContent).toContain('You answered');
    expect(panelOf(fixture)?.textContent).toContain('Whims');

    await open({}, '   ');
    expect(panelOf(fixture)?.textContent).not.toContain('You answered');
  });

  it('respects quizMeaningIndex for both meaning and example', async () => {
    await open({
      definition: 'n. A sudden idea. · v. To act on impulse.',
      examples: ['She had a whim.', 'He whims constantly.'],
      quizMeaningIndex: 1,
    });
    const text = panelOf(fixture)?.textContent ?? '';
    expect(text).toContain('To act on impulse');
    expect(text).toContain('He whims constantly');
    expect(text).not.toContain('A sudden idea');
  });

  it('clears the data model when the backdrop is clicked (sheet closes)', async () => {
    await open();
    const backdrop = fixture.nativeElement.querySelector('.bg-black\\/40') as HTMLElement;
    backdrop.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.data()).toBeNull();
    expect(panelOf(fixture)).toBeNull();
  });
});
