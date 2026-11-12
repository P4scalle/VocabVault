import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdaptiveNav, NavItem } from './adaptive-nav';

const TEST_ITEMS: NavItem[] = [
  { label: 'Home', path: '/home', iconClass: 'pi pi-home' },
  { label: 'Dictionary', path: '/dictionary', iconClass: 'pi pi-book' },
  { label: 'Quiz', path: '/quiz', iconClass: 'pi pi-bolt' },
  { label: 'Progress', path: '/progress', iconClass: 'pi pi-chart-line' },
];

function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => { /* mock: no-op */ },
      removeListener: () => { /* mock: no-op */ },
      addEventListener: () => { /* mock: no-op */ },
      removeEventListener: () => { /* mock: no-op */ },
      dispatchEvent: () => false,
    }),
  });
}

describe('AdaptiveNav', () => {
  let fixture: ComponentFixture<AdaptiveNav>;

  beforeEach(async () => {
    stubMatchMedia();
    await TestBed.configureTestingModule({
      imports: [AdaptiveNav],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdaptiveNav);
    fixture.componentRef.setInput('items', TEST_ITEMS);
  });

  it('renders exactly one nav element (active breakpoint only)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const navs = fixture.nativeElement.querySelectorAll('nav');
    expect(navs.length).toBe(1);
  });

  it('renders item labels', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Home');
    expect(text).toContain('Dictionary');
    expect(text).toContain('Quiz');
    expect(text).toContain('Progress');
  });

  it('renders nav item anchors for the active layout', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const anchors = fixture.nativeElement.querySelectorAll('a');
    // Mobile layout: 4 items split across left/right halves
    expect(anchors.length).toBe(4);
  });
});
