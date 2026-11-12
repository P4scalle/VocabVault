import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuizFlagBanner } from './quiz-flag-banner';

describe('QuizFlagBanner', () => {
  let fixture: ComponentFixture<QuizFlagBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizFlagBanner],
    }).compileComponents();
    fixture = TestBed.createComponent(QuizFlagBanner);
    fixture.componentRef.setInput('wordId', 'word-1');
    fixture.componentRef.setInput('wordLabel', 'ephemeral');
    fixture.componentRef.setInput('flaggedIds', new Set<string>());
  });

  it('renders with unflagged state (shows "Flag this word" and pi-flag icon)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const label = fixture.nativeElement.querySelector('.flag-label');
    expect(label.textContent).toContain('Flag this word');

    const icon = fixture.nativeElement.querySelector('i');
    expect(icon.classList.contains('pi-flag')).toBe(true);
    expect(icon.classList.contains('pi-flag-fill')).toBe(false);
  });

  it('does NOT render the word label as visible text (only the flag action)', async () => {
    // Regression guard: the banner used to print the word next to the toggle,
    // which was redundant with the card. It must only show the flag action.
    fixture.detectChanges();
    await fixture.whenStable();

    // The word is still passed in for the aria-label, but must not appear as
    // a visible label element or in the banner's rendered text.
    expect(fixture.nativeElement.querySelector('.word-label')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Flag this word');
    expect(fixture.nativeElement.textContent).not.toContain('ephemeral');
  });

  it('renders with flagged state (shows "Flagged" and pi-flag-fill icon)', async () => {
    fixture.componentRef.setInput('flaggedIds', new Set(['word-1']));
    fixture.detectChanges();
    await fixture.whenStable();

    const label = fixture.nativeElement.querySelector('.flag-label');
    expect(label.textContent).toContain('Flagged');

    const icon = fixture.nativeElement.querySelector('i');
    expect(icon.classList.contains('pi-flag-fill')).toBe(true);
  });

  it('toggle adds wordId to flaggedIds set', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('.flag-toggle');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.flaggedIds().has('word-1')).toBe(true);
  });

  it('toggle removes wordId from flaggedIds set when already flagged', async () => {
    fixture.componentRef.setInput('flaggedIds', new Set(['word-1']));
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('.flag-toggle');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.flaggedIds().has('word-1')).toBe(false);
  });

  it('aria-pressed reflects flag state', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('.flag-toggle');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    fixture.componentRef.setInput('flaggedIds', new Set(['word-1']));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('aria-label changes between "Flag" and "Remove flag"', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('.flag-toggle');
    expect(button.getAttribute('aria-label')).toContain('Flag');
    expect(button.getAttribute('aria-label')).toContain('ephemeral');

    fixture.componentRef.setInput('flaggedIds', new Set(['word-1']));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.getAttribute('aria-label')).toContain('Remove flag');
    expect(button.getAttribute('aria-label')).toContain('ephemeral');
  });
});
