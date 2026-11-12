import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuizProgressBar } from './quiz-progress-bar';

describe('QuizProgressBar', () => {
  let fixture: ComponentFixture<QuizProgressBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizProgressBar],
    }).compileComponents();
    fixture = TestBed.createComponent(QuizProgressBar);
    fixture.componentRef.setInput('current', 3);
    fixture.componentRef.setInput('total', 10);
  });

  it('creates successfully', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders label when provided', async () => {
    fixture.componentRef.setInput('label', 'Progress');
    fixture.detectChanges();
    await fixture.whenStable();

    const label = fixture.nativeElement.querySelector('span');
    expect(label).toBeTruthy();
    expect(label.textContent).toContain('Progress');
  });

  it('hides label when not provided', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const label = fixture.nativeElement.querySelector('span');
    expect(label).toBeNull();
  });

  it('progress bar width reflects percentage', async () => {
    fixture.componentRef.setInput('current', 3);
    fixture.componentRef.setInput('total', 10);
    fixture.detectChanges();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector('.bg-vv-brand');
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBe('30%');
  });

  it('progress bar width is 0% when total is 0', async () => {
    fixture.componentRef.setInput('current', 0);
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector('.bg-vv-brand');
    expect(bar.style.width).toBe('0%');
  });

  it('progress bar width is 100% when current equals total', async () => {
    fixture.componentRef.setInput('current', 10);
    fixture.componentRef.setInput('total', 10);
    fixture.detectChanges();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector('.bg-vv-brand');
    expect(bar.style.width).toBe('100%');
  });

  it('progress bar width is 0% when current is 0', async () => {
    fixture.componentRef.setInput('current', 0);
    fixture.componentRef.setInput('total', 12);
    fixture.detectChanges();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector('.bg-vv-brand');
    expect(bar.style.width).toBe('0%');
  });

  it('progress bar clamps to 100% when current exceeds total', async () => {
    fixture.componentRef.setInput('current', 15);
    fixture.componentRef.setInput('total', 10);
    fixture.detectChanges();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector('.bg-vv-brand');
    expect(bar.style.width).toBe('100%');
  });
});
