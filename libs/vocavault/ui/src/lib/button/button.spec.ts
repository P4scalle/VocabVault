import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Button } from './button';

@Component({
  selector: 'lib-test-host',
  imports: [Button],
  template: `
    <lib-button
      [variant]="variant()"
      [disabled]="disabled()"
      [size]="size()"
      [fullWidth]="fullWidth()"
      [type]="type()"
      [ariaLabel]="ariaLabel()"
    >
      Click me
    </lib-button>
  `,
})
class TestHost {
  variant = signal<'primary' | 'secondary' | 'danger'>('primary');
  disabled = signal(false);
  size = signal<'sm' | 'md'>('md');
  fullWidth = signal(false);
  type = signal<'button' | 'submit'>('button');
  ariaLabel = signal('');
}

describe('Button', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  function getButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render with primary variant by default', () => {
    const btn = getButton();
    expect(btn.classList.contains('vv-btn-primary')).toBe(true);
    expect(btn.textContent?.trim()).toBe('Click me');
  });

  it('should render secondary variant', () => {
    host.variant.set('secondary');
    fixture.detectChanges();
    const btn = getButton();
    expect(btn.classList.contains('vv-btn-secondary')).toBe(true);
    expect(btn.classList.contains('vv-btn-primary')).toBe(false);
  });

  it('should render danger variant', () => {
    host.variant.set('danger');
    fixture.detectChanges();
    const btn = getButton();
    expect(btn.classList.contains('vv-btn-danger')).toBe(true);
  });

  it('should be disabled when disabled input is true', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    const btn = getButton();
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('should not be disabled by default', () => {
    const btn = getButton();
    expect(btn.disabled).toBe(false);
  });

  it('should apply small size classes', () => {
    host.size.set('sm');
    fixture.detectChanges();
    const btn = getButton();
    expect(btn.classList.contains('text-sm')).toBe(true);
    expect(btn.classList.contains('py-2.5')).toBe(true);
  });

  it('should apply medium size classes by default', () => {
    const btn = getButton();
    expect(btn.classList.contains('py-3')).toBe(true);
  });

  it('should apply full width when enabled', () => {
    host.fullWidth.set(true);
    fixture.detectChanges();
    const btn = getButton();
    expect(btn.classList.contains('w-full')).toBe(true);
  });

  it('should not have w-full by default', () => {
    const btn = getButton();
    expect(btn.classList.contains('w-full')).toBe(false);
  });

  it('should set button type', () => {
    expect(getButton().type).toBe('button');
    host.type.set('submit');
    fixture.detectChanges();
    expect(getButton().type).toBe('submit');
  });

  it('should set aria-label when provided', () => {
    host.ariaLabel.set('Save changes');
    fixture.detectChanges();
    expect(getButton().getAttribute('aria-label')).toBe('Save changes');
  });

  it('should not have aria-label when not provided', () => {
    expect(getButton().getAttribute('aria-label')).toBeNull();
  });

  it('should always have focus ring class', () => {
    const btn = getButton();
    expect(btn.classList.contains('vv-focus-ring')).toBe(true);
  });

  it('should always have rounded-xl', () => {
    const btn = getButton();
    expect(btn.classList.contains('rounded-xl')).toBe(true);
  });

  it('should project content', () => {
    expect(getButton().textContent?.trim()).toBe('Click me');
  });
});
