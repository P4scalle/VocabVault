import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WordCard, MockWord } from './word-card';
import { makeWord } from '@vocavault/data-access';

const mockWord = makeWord({
  id: '1',
  word: 'Test',
  pronunciation: '/test/',
  definition: 'A test word.',
  examples: ['This is a test.'],
});

describe('WordCard', () => {
  let fixture: ComponentFixture<WordCard>;

  beforeEach(async () => {
    // Provide matchMedia stub for HoldButton's prefersReducedMotion check
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });
    }
    await TestBed.configureTestingModule({
      imports: [WordCard],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(WordCard);
    fixture.componentRef.setInput('word', mockWord);
  });

  it('renders word name', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Test');
  });

  it('emits selected when card clicked', async () => {
    const emitted: MockWord[] = [];
    fixture.componentInstance.selected.subscribe((w: MockWord) => emitted.push(w));
    fixture.detectChanges();
    await fixture.whenStable();
    const cardDiv = fixture.nativeElement.querySelector('[role="button"]');
    cardDiv.click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe('1');
  });

  it('emits deleteRequested via hold button keyboard confirm', async () => {
    const deleted: MockWord[] = [];
    fixture.componentInstance.deleteRequested.subscribe((w: MockWord) => deleted.push(w));
    fixture.detectChanges();
    await fixture.whenStable();
    // HoldButton keyboard confirm: press Enter twice (first activates confirm mode, second confirms)
    const holdBtn = fixture.nativeElement.querySelector('lib-hold-button button');
    holdBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    holdBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(deleted).toHaveLength(1);
  });

  it('shows POS badge for API-fetched definition', async () => {
    fixture.componentRef.setInput('word', makeWord({
      definition: 'n. a test word',
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('n.');
    expect(el.textContent).toContain('a test word');
    const badge = el.querySelector('.vv-pos-badge');
    expect(badge).toBeTruthy();
    expect(badge.className).toContain('bg-blue-100');
  });

  it('shows primary and secondary meanings for multi-POS definition', async () => {
    fixture.componentRef.setInput('word', makeWord({
      definition: 'n. a thing \u00B7 v. to do a thing',
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    const badges = fixture.nativeElement.querySelectorAll('.vv-pos-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent.trim()).toBe('n.');
    expect(badges[1].textContent.trim()).toBe('v.');
    expect(badges[0].className).toContain('bg-blue-100');
    expect(badges[1].className).toContain('bg-emerald-100');
  });

  it('renders plain definition without POS badge', async () => {
    fixture.componentRef.setInput('word', makeWord({
      definition: 'the act of running',
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('the act of running');
    const badge = fixture.nativeElement.querySelector('.vv-pos-badge');
    expect(badge).toBeNull();
  });

  it('shows first example sentence in italics', async () => {
    fixture.componentRef.setInput('word', makeWord({
      examples: ['This is an example.'],
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('This is an example.');
    const italicP = fixture.nativeElement.querySelector('p.italic');
    expect(italicP).toBeTruthy();
  });

  it('shows no example when examples array is empty', async () => {
    fixture.componentRef.setInput('word', makeWord({
      examples: [],
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    const italicP = fixture.nativeElement.querySelector('p.italic');
    expect(italicP).toBeNull();
  });

  it('shows "No definition" placeholder for empty definition', async () => {
    fixture.componentRef.setInput('word', makeWord({
      definition: '',
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No definition');
    const badge = fixture.nativeElement.querySelector('.vv-pos-badge');
    expect(badge).toBeNull();
  });

  it('search highlight still works on parsed definition', async () => {
    fixture.componentRef.setInput('word', makeWord({
      definition: 'n. a test word',
    }));
    fixture.componentRef.setInput('searchQuery', 'test');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.innerHTML).toContain('<mark');
  });
});
