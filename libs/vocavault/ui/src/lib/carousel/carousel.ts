import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Directive({
  selector: '[libCarouselSlide]',
  host: {
    'class': 'carousel-slide',
    'role': 'group',
    '[attr.aria-roledescription]': '"slide"',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.id]': 'slideId()',
  },
})
export class CarouselSlide {
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly id = input<string>('');

  protected readonly ariaLabel = computed(
    () => `${this.index() + 1} of ${this.total()}`
  );

  protected readonly slideId = computed(
    () => this.id() || `carousel-slide-${this.index()}`
  );
}

@Component({
  selector: 'lib-carousel',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-roledescription="carousel"
      [attr.aria-label]="ariaLabel()"
      class="carousel-wrapper"
    >
      @if (hasChevrons()) {
        <button
          type="button"
          class="carousel-chevron carousel-chevron--prev"
          [class.invisible]="activeIndex() === 0"
          aria-label="Previous slide"
          (click)="scrollTo(activeIndex() - 1); $event.stopPropagation()"
        >
          <i class="pi pi-chevron-left" aria-hidden="true"></i>
        </button>
      }

      <div
        class="carousel-viewport"
        #viewport
      >
        <div class="carousel-track">
          <ng-content />
        </div>
      </div>

      @if (hasChevrons()) {
        <button
          type="button"
          class="carousel-chevron carousel-chevron--next"
          [class.invisible]="activeIndex() === slideCount() - 1"
          aria-label="Next slide"
          (click)="scrollTo(activeIndex() + 1); $event.stopPropagation()"
        >
          <i class="pi pi-chevron-right" aria-hidden="true"></i>
        </button>
      }

      @if (showIndicators() && slideCount() > 1) {
        <div class="carousel-indicators" role="tablist" [attr.aria-label]="ariaLabel() + ' slide controls'">
          @for (i of slideIndices(); track i) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="i === activeIndex()"
              [attr.aria-label]="'Slide ' + (i + 1)"
              [attr.aria-controls]="slideIds()[i] || 'carousel-slide-' + i"
              [attr.tabindex]="i === activeIndex() ? 0 : -1"
              class="carousel-dot"
              [class.active]="i === activeIndex()"
              (click)="scrollTo(i)"
              (keydown.arrowRight)="focusTab(i + 1, $event)"
              (keydown.arrowLeft)="focusTab(i - 1, $event)"
            ></button>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .carousel-wrapper {
      position: relative;
    }

    .carousel-viewport {
      overflow-x: scroll;
      scroll-snap-type: x mandatory;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .carousel-track {
      display: flex;
    }

    :host ::ng-deep .carousel-slide {
      flex: 0 0 100%;
      scroll-snap-align: center;
      scroll-snap-stop: always;
    }

    .carousel-chevron {
      display: none;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      border: 1px solid #e2e8f0;
      background: var(--vv-color-surface, white);
      color: #475569;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);

      .dark & {
        border-color: #475569;
        color: #cbd5e1;
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
      }

      &:hover {
        background: #f8fafc;
        color: var(--vv-color-brand, #3A7CA5);
        border-color: var(--vv-color-brand, #3A7CA5);
      }

      .dark &:hover {
        background: #334155;
      }

      &--prev {
        left: -0.25rem;
      }

      &--next {
        right: -0.25rem;
      }
    }

    @media (min-width: 768px) {
      .carousel-chevron {
        display: flex;
      }
    }

    .carousel-indicators {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .carousel-dot {
      height: 0.5rem;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      transition: all 200ms ease;
      padding: 0;
      background-color: #cbd5e1; /* slate-300 */
      width: 0.5rem;

      .dark & {
        background-color: #64748b; /* slate-500 */
      }

      &.active {
        background-color: var(--vv-color-brand, #3A7CA5);
        width: 1.5rem;
      }

      &:focus-visible {
        outline: 2px solid var(--vv-color-brand, #3A7CA5);
        outline-offset: 2px;
      }
    }
  `],
})
export class Carousel {
  readonly ariaLabel = input<string>('Carousel');
  readonly showIndicators = input(true);
  readonly showChevrons = input(false);

  readonly activeIndexChange = output<number>();

  readonly activeIndex = signal(0);

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly slides = contentChildren(CarouselSlide, { read: ElementRef });

  readonly slideCount = computed(() => this.slides().length);

  readonly slideIndices = computed(() =>
    Array.from({ length: this.slideCount() }, (_, i) => i)
  );

  readonly slideIds = computed(() =>
    this.slides().map((_, i) => `carousel-slide-${i}`)
  );

  protected readonly hasChevrons = computed(() => this.showChevrons() && this.slideCount() > 1);

  constructor() {
    afterNextRender(() => {
      const el = this.viewport().nativeElement;

      let scrollTimer: ReturnType<typeof setTimeout> | undefined;

      const updateIndex = () => {
        const width = el.clientWidth;
        if (width === 0) return;
        const index = Math.round(el.scrollLeft / width);
        const clamped = Math.max(0, Math.min(index, this.slideCount() - 1));
        if (clamped !== this.activeIndex()) {
          this.activeIndex.set(clamped);
          this.activeIndexChange.emit(clamped);
        }
      };

      // scroll event for real-time dot updates during swipe
      el.addEventListener(
        'scroll',
        () => {
          clearTimeout(scrollTimer);
          updateIndex();
          // Fallback for browsers without scrollend (e.g. older Safari)
          scrollTimer = setTimeout(updateIndex, 100);
        },
        { passive: true }
      );

      // scrollend for precise final position
      el.addEventListener('scrollend', () => {
        clearTimeout(scrollTimer);
        updateIndex();
      }, { passive: true });
    });
  }

  scrollTo(index: number): void {
    const el = this.viewport().nativeElement;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    this.activeIndex.set(index);
    this.activeIndexChange.emit(index);
  }

  protected focusTab(index: number, event: Event): void {
    event.preventDefault();
    const count = this.slideCount();
    if (count === 0) return;
    const wrapped = ((index % count) + count) % count;
    this.scrollTo(wrapped);

    // Re-query tab buttons in case DOM changed
    const section = this.viewport().nativeElement.closest('section');
    const tabs = section?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[wrapped]?.focus();
  }
}
