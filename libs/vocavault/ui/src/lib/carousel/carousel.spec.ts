import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Carousel, CarouselSlide } from './carousel';

@Component({
  selector: 'lib-test-host',
  imports: [Carousel, CarouselSlide],
  template: `
    <lib-carousel [ariaLabel]="'Test carousel'">
      @for (item of items(); track item; let i = $index) {
        <div libCarouselSlide [index]="i" [total]="items().length">
          {{ item }}
        </div>
      }
    </lib-carousel>
  `,
})
class TestHost {
  items = signal(['Word 1', 'Word 2', 'Word 3']);
}

describe('Carousel', () => {
  let fixture: ComponentFixture<TestHost>;

  function getSection(): HTMLElement {
    return fixture.nativeElement.querySelector('section') as HTMLElement;
  }

  function getViewport(): HTMLElement {
    return fixture.nativeElement.querySelector('.carousel-viewport') as HTMLElement;
  }

  function getSlides(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.carousel-slide'));
  }

  function getDots(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.carousel-dot'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should render all slides', () => {
    expect(getSlides().length).toBe(3);
  });

  it('should have correct ARIA roledescription on section', () => {
    const section = getSection();
    expect(section.getAttribute('aria-roledescription')).toBe('carousel');
    expect(section.getAttribute('aria-label')).toBe('Test carousel');
  });

  it('should apply slide ARIA attributes', () => {
    const slides = getSlides();
    expect(slides[0].getAttribute('aria-roledescription')).toBe('slide');
    expect(slides[0].getAttribute('aria-label')).toBe('1 of 3');
    expect(slides[2].getAttribute('aria-label')).toBe('3 of 3');
  });

  it('should render dot indicators for multiple slides', () => {
    const dots = getDots();
    expect(dots.length).toBe(3);
  });

  it('should mark first dot as active by default', () => {
    const dots = getDots();
    expect(dots[0].getAttribute('aria-selected')).toBe('true');
    expect(dots[0].classList.contains('active')).toBe(true);
    expect(dots[1].getAttribute('aria-selected')).toBe('false');
  });

  it('should set tabindex correctly on dots (roving tabindex)', () => {
    const dots = getDots();
    expect(dots[0].getAttribute('tabindex')).toBe('0');
    expect(dots[1].getAttribute('tabindex')).toBe('-1');
    expect(dots[2].getAttribute('tabindex')).toBe('-1');
  });

  it('should have role=tab on dots', () => {
    const dots = getDots();
    dots.forEach(dot => {
      expect(dot.getAttribute('role')).toBe('tab');
    });
  });

  it('should have scroll-snap CSS on viewport', () => {
    const viewport = getViewport();
    expect(viewport).toBeTruthy();
    expect(viewport.classList.contains('carousel-viewport')).toBe(true);
  });

  it('should not render dots for single item', () => {
    fixture.componentInstance.items.set(['Only one']);
    fixture.detectChanges();
    expect(getDots().length).toBe(0);
  });

  it('should not render dots when empty', () => {
    fixture.componentInstance.items.set([]);
    fixture.detectChanges();
    expect(getDots().length).toBe(0);
    expect(getSlides().length).toBe(0);
  });
});
