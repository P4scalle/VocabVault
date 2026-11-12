import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressBubble } from './progress-bubble';

describe('ProgressBubble', () => {
  let fixture: ComponentFixture<ProgressBubble>;
  let component: ProgressBubble;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBubble],
    }).compileComponents();
    fixture = TestBed.createComponent(ProgressBubble);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', 5);
  });

  it('creates successfully', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // --- percentage calculation ---

  it('computes pct correctly for value/max', () => {
    fixture.componentRef.setInput('value', 3);
    fixture.componentRef.setInput('max', 10);
    fixture.detectChanges();
    expect(component['pct']()).toBe(30);
  });

  it('caps pct at 100 when value exceeds max', () => {
    fixture.componentRef.setInput('value', 200);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    expect(component['pct']()).toBe(100);
  });

  it('returns 0 pct when max is 0', () => {
    fixture.componentRef.setInput('value', 5);
    fixture.componentRef.setInput('max', 0);
    fixture.detectChanges();
    expect(component['pct']()).toBe(0);
  });

  it('uses default max of 100', () => {
    fixture.componentRef.setInput('value', 25);
    fixture.detectChanges();
    expect(component['pct']()).toBe(25);
  });

  // --- CSS custom properties ---

  it('sets --bubble-size from size input', () => {
    fixture.componentRef.setInput('size', 80);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.style.getPropertyValue('--bubble-size')).toBe('80px');
  });

  it('sets --bubble-color from color input', () => {
    fixture.componentRef.setInput('color', '#FF5733');
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.style.getPropertyValue('--bubble-color')).toBe('#FF5733');
  });

  it('sets --bubble-fill-pct from computed percentage', () => {
    fixture.componentRef.setInput('value', 50);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.style.getPropertyValue('--bubble-fill-pct')).toBe('50%');
  });

  // --- filled class toggling ---

  it('does not apply --filled class when filled signal is false', () => {
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--filled')).toBe(false);
  });

  it('applies --filled class when filled signal is true', () => {
    component['filled'].set(true);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--filled')).toBe(true);
  });

  it('removes --filled class when filled toggles back to false', () => {
    component['filled'].set(true);
    fixture.detectChanges();
    component['filled'].set(false);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--filled')).toBe(false);
  });

  // --- high-fill class ---

  it('applies --high-fill class when pct >= 50', () => {
    fixture.componentRef.setInput('value', 60);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--high-fill')).toBe(true);
  });

  it('does not apply --high-fill class when pct < 50', () => {
    fixture.componentRef.setInput('value', 30);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--high-fill')).toBe(false);
  });

  it('applies --high-fill class at exactly 50% boundary', () => {
    fixture.componentRef.setInput('value', 50);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--high-fill')).toBe(true);
  });

  it('does not apply --high-fill at 49%', () => {
    fixture.componentRef.setInput('value', 49);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--high-fill')).toBe(false);
  });

  // --- accessibility ---

  it('sets aria-valuenow to current value', () => {
    fixture.componentRef.setInput('value', 7);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('[role="meter"]');
    expect(bubble.getAttribute('aria-valuenow')).toBe('7');
  });

  it('sets aria-valuemax to max', () => {
    fixture.componentRef.setInput('max', 50);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('[role="meter"]');
    expect(bubble.getAttribute('aria-valuemax')).toBe('50');
  });

  it('sets aria-label with label and percentage', () => {
    fixture.componentRef.setInput('value', 25);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('label', 'Mastered');
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('[role="meter"]');
    expect(bubble.getAttribute('aria-label')).toBe('Mastered 25%');
  });

  it('sets generic aria-label when no label is provided', () => {
    fixture.componentRef.setInput('value', 40);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('[role="meter"]');
    expect(bubble.getAttribute('aria-label')).toBe('40% progress');
  });

  // --- label rendering ---

  it('renders label text when label input is set', () => {
    fixture.componentRef.setInput('label', 'Learning');
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('span');
    expect(label.textContent).toBe('Learning');
  });

  it('does not render label span when label is empty', () => {
    fixture.componentRef.setInput('label', '');
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('span');
    expect(label).toBeNull();
  });

  // --- reactive updates ---

  it('updates --bubble-fill-pct when value changes', () => {
    fixture.componentRef.setInput('value', 20);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.style.getPropertyValue('--bubble-fill-pct')).toBe('20%');

    fixture.componentRef.setInput('value', 80);
    fixture.detectChanges();
    expect(bubble.style.getPropertyValue('--bubble-fill-pct')).toBe('80%');
  });

  it('updates high-fill class when value crosses 50% threshold', () => {
    fixture.componentRef.setInput('value', 30);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.classList.contains('vv-progress-bubble--high-fill')).toBe(false);

    fixture.componentRef.setInput('value', 70);
    fixture.detectChanges();
    expect(bubble.classList.contains('vv-progress-bubble--high-fill')).toBe(true);
  });

  // --- edge cases ---

  it('handles negative max as 0 pct', () => {
    fixture.componentRef.setInput('value', 5);
    fixture.componentRef.setInput('max', -10);
    fixture.detectChanges();
    expect(component['pct']()).toBe(0);
  });

  // --- defaults ---

  it('uses default color #3A7CA5', () => {
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.style.getPropertyValue('--bubble-color')).toBe('#3A7CA5');
  });

  it('uses default size 64px', () => {
    fixture.detectChanges();
    const bubble = fixture.nativeElement.querySelector('.vv-progress-bubble');
    expect(bubble.style.getPropertyValue('--bubble-size')).toBe('64px');
  });
});
