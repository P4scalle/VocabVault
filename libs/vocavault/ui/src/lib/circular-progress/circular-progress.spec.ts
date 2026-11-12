import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { CircularProgress } from './circular-progress';

interface CircularProgressInternals {
  animated: WritableSignal<boolean>;
}

describe('CircularProgress', () => {
  let fixture: ComponentFixture<CircularProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CircularProgress],
    }).compileComponents();
    fixture = TestBed.createComponent(CircularProgress);
    fixture.componentRef.setInput('value', 50);
  });

  it('creates successfully', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders SVG circles with correct attributes', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const circles = fixture.nativeElement.querySelectorAll('circle');
    expect(circles.length).toBe(3);

    // Track circle (first)
    const track = circles[0];
    expect(track.getAttribute('cx')).toBe('70');
    expect(track.getAttribute('cy')).toBe('70');
    expect(track.getAttribute('r')).toBe('52');
    expect(track.getAttribute('stroke')).toBe('var(--vv-track-color, #A2C4C9)');

    // Progress circle (second)
    const progress = circles[1];
    expect(progress.getAttribute('cx')).toBe('70');
    expect(progress.getAttribute('cy')).toBe('70');
    expect(progress.getAttribute('r')).toBe('52');
    expect(progress.getAttribute('stroke')).toBe('var(--vv-color-brand, #3A7CA5)');
    expect(progress.getAttribute('stroke-width')).toBe('18');
  });

  it('computes dashOffset correctly for 0%', async () => {
    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();
    await fixture.whenStable();

    // animated is false initially (afterNextRender hasn't fired in test),
    // so dashOffset equals circumference regardless of value.
    // Force animated to true to test the calculation.
    (fixture.componentInstance as unknown as CircularProgressInternals).animated.set(true);
    fixture.detectChanges();

    const radius = 52; // (140/2) - 18
    const circumference = 2 * Math.PI * radius;
    // 0% => dashOffset = circumference - 0 = circumference
    const progress = fixture.nativeElement.querySelectorAll('circle')[1];
    const offset = parseFloat(progress.getAttribute('stroke-dashoffset'));
    expect(offset).toBeCloseTo(circumference, 1);
  });

  it('computes dashOffset correctly for 50%', async () => {
    fixture.componentRef.setInput('value', 50);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.componentInstance as unknown as CircularProgressInternals).animated.set(true);
    fixture.detectChanges();

    const radius = 52; // (140/2) - 18
    const circumference = 2 * Math.PI * radius;
    const expected = circumference - 0.5 * circumference;
    const progress = fixture.nativeElement.querySelectorAll('circle')[1];
    const offset = parseFloat(progress.getAttribute('stroke-dashoffset'));
    expect(offset).toBeCloseTo(expected, 1);
  });

  it('computes dashOffset correctly for 100%', async () => {
    fixture.componentRef.setInput('value', 100);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.componentInstance as unknown as CircularProgressInternals).animated.set(true);
    fixture.detectChanges();

    const progress = fixture.nativeElement.querySelectorAll('circle')[1];
    const offset = parseFloat(progress.getAttribute('stroke-dashoffset'));
    expect(offset).toBeCloseTo(0, 1);
  });

  it('applies color input to stroke', async () => {
    fixture.componentRef.setInput('color', '#FF0000');
    fixture.detectChanges();
    await fixture.whenStable();

    const progress = fixture.nativeElement.querySelectorAll('circle')[1];
    expect(progress.getAttribute('stroke')).toBe('#FF0000');
  });

  it('size input affects viewBox', async () => {
    fixture.componentRef.setInput('size', 200);
    fixture.detectChanges();
    await fixture.whenStable();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 200');
  });
});
