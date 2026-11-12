import { ChangeDetectionStrategy, Component, afterNextRender, computed, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavItem {
  label: string;
  path: string;
  iconClass: string;
}

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

@Component({
  selector: 'lib-adaptive-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './adaptive-nav.html',
  styleUrl: './adaptive-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdaptiveNav {
  readonly items = input.required<NavItem[]>();
  readonly logoClicked = output<void>();

  protected readonly breakpoint = signal<Breakpoint>('mobile');

  /** Left half of nav items (for mobile bottom bar with center + button) */
  protected readonly leftItems = computed(() => {
    const all = this.items();
    return all.slice(0, Math.ceil(all.length / 2));
  });

  /** Right half of nav items */
  protected readonly rightItems = computed(() => {
    const all = this.items();
    return all.slice(Math.ceil(all.length / 2));
  });

  constructor() {
    afterNextRender(() => {
      const mdQuery = matchMedia('(min-width: 768px)');
      const lgQuery = matchMedia('(min-width: 1024px)');

      const update = () => {
        if (lgQuery.matches) {
          this.breakpoint.set('desktop');
        } else if (mdQuery.matches) {
          this.breakpoint.set('tablet');
        } else {
          this.breakpoint.set('mobile');
        }
      };

      update();
      mdQuery.addEventListener('change', update);
      lgQuery.addEventListener('change', update);
    });
  }
}
