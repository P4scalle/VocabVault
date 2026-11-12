import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  let fixture: ComponentFixture<EmptyState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyState] }).compileComponents();
    fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('heading', 'No words yet');
  });

  it('renders heading', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('No words yet');
  });

  it('shows action button when actionLabel provided', async () => {
    fixture.componentRef.setInput('actionLabel', 'Add Word');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Add Word');
  });

  it('hides action button when actionLabel is empty', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('emits action when button is clicked', async () => {
    fixture.componentRef.setInput('actionLabel', 'Add Word');
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = false;
    fixture.componentInstance.action.subscribe(() => (emitted = true));

    fixture.nativeElement.querySelector('button').click();
    expect(emitted).toBe(true);
  });
});
