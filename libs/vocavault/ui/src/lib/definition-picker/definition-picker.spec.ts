import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DefinitionMeaning, DefinitionPicker } from './definition-picker';

const mockMeanings: DefinitionMeaning[] = [
  {
    pos: 'noun',
    posAbbrev: 'n.',
    definition: 'A large aquatic mammal',
    example: 'The whale breached the surface.',
    pronunciation: '/weɪl/',
    sourceIndex: 0,
  },
  {
    pos: 'noun',
    posAbbrev: 'n.',
    definition: 'A very large amount of something',
    example: undefined,
    pronunciation: '/weɪl/',
    sourceIndex: 1,
  },
  {
    pos: 'verb',
    posAbbrev: 'v.',
    definition: 'To hunt whales',
    example: 'They used to whale in these waters.',
    pronunciation: '/weɪl/',
    sourceIndex: 0,
  },
  {
    pos: 'verb',
    posAbbrev: 'v.',
    definition: 'To strike heavily',
    example: undefined,
    pronunciation: '/weɪl/',
    sourceIndex: 1,
  },
];

function createFixture(opts: {
  addedDefinitions?: string[];
  addedExamples?: string[];
} = {}) {
  const fixture = TestBed.createComponent(DefinitionPicker);
  const ref = fixture.componentRef;
  ref.setInput('meanings', mockMeanings);
  ref.setInput('visible', true);
  if (opts.addedDefinitions !== undefined) {
    ref.setInput('addedDefinitions', opts.addedDefinitions);
  }
  if (opts.addedExamples !== undefined) {
    ref.setInput('addedExamples', opts.addedExamples);
  }
  fixture.detectChanges();
  return fixture;
}

describe('DefinitionPicker', () => {
  let componentRef: ComponentRef<DefinitionPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
    const fixture = TestBed.createComponent(DefinitionPicker);
    componentRef = fixture.componentRef;
    componentRef.setInput('meanings', mockMeanings);
    componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  it('renders grouped meanings by POS', () => {
    const fixture = createFixture();
    const headings = fixture.debugElement.queryAll(By.css('[data-testid="pos-group"]'));
    expect(headings.length).toBe(2);
  });

  it('shows POS abbreviation badge for each group', () => {
    const fixture = createFixture();
    const badges = fixture.debugElement.queryAll(By.css('[data-testid="pos-badge"]'));
    expect(badges.length).toBe(2);
    expect(badges[0].nativeElement.textContent.trim()).toContain('n.');
    expect(badges[1].nativeElement.textContent.trim()).toContain('v.');
  });

  it('shows definition text for each meaning', () => {
    const fixture = createFixture();
    const definitionEls = fixture.debugElement.queryAll(By.css('[data-testid="definition-text"]'));
    expect(definitionEls.length).toBe(4);
    expect(definitionEls[0].nativeElement.textContent).toContain('A large aquatic mammal');
  });

  it('shows example text in italics when present', () => {
    const fixture = createFixture();
    const exampleEls = fixture.debugElement.queryAll(By.css('[data-testid="definition-example"]'));
    expect(exampleEls.length).toBe(2);
    expect(exampleEls[0].nativeElement.textContent).toContain('The whale breached the surface.');
  });

  it('renders clear "Choose a definition" and "Choose an example" headers', () => {
    const fixture = createFixture();
    const headers = fixture.debugElement
      .queryAll(By.css('h2'))
      .map((h) => h.nativeElement.textContent.trim());
    expect(headers).toContain('Choose a definition');
    expect(headers).toContain('Choose an example');
  });

  it('does NOT show sourceIndex or any API source label', () => {
    const fixture = createFixture();
    const html = fixture.debugElement.nativeElement.innerHTML as string;
    expect(html).not.toContain('sourceIndex');
    expect(html).not.toContain('primary');
    expect(html).not.toContain('fallback');
    expect(html).not.toContain('api');
  });

  it('examples section shows all unique examples', () => {
    const fixture = createFixture();
    const exRows = fixture.debugElement.queryAll(By.css('[data-testid="example-row"]'));
    expect(exRows.length).toBe(2);
  });

  it('shows "No definitions available" when meanings is empty', () => {
    const fixture = TestBed.createComponent(DefinitionPicker);
    fixture.componentRef.setInput('meanings', []);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const el = fixture.debugElement.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No definitions available');
  });
});

describe('selection state', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
  });

  it('defaults: no inputs → every definition checkbox is unchecked, aria-label=Add definition', () => {
    const fixture = createFixture();
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    expect(boxes.length).toBe(4);
    for (const b of boxes) {
      expect(b.nativeElement.checked).toBe(false);
      expect(b.nativeElement.getAttribute('aria-label')).toBe('Add definition');
    }
  });

  it('defaults: no inputs → every example checkbox is unchecked', () => {
    const fixture = createFixture();
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="example-checkbox"]'));
    for (const b of boxes) {
      expect(b.nativeElement.checked).toBe(false);
    }
  });

  it('added definition → checkbox checked + aria-label=Remove definition; others unchecked', () => {
    const fixture = createFixture({ addedDefinitions: ['A large aquatic mammal'] });
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    expect(boxes[0].nativeElement.checked).toBe(true);
    expect(boxes[0].nativeElement.getAttribute('aria-label')).toBe('Remove definition');
    expect(boxes[1].nativeElement.checked).toBe(false);
    expect(boxes[1].nativeElement.getAttribute('aria-label')).toBe('Add definition');
  });

  it('added example → checkbox checked + aria-label=Remove example', () => {
    const fixture = createFixture({ addedExamples: ['The whale breached the surface.'] });
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="example-checkbox"]'));
    expect(boxes[0].nativeElement.checked).toBe(true);
    expect(boxes[0].nativeElement.getAttribute('aria-label')).toBe('Remove example');
  });

  it('case-insensitive/trimmed match: padded lowercase input still checks the box', () => {
    const fixture = createFixture({ addedDefinitions: ['  a large aquatic mammal '] });
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    expect(boxes[0].nativeElement.checked).toBe(true);
  });

  it('item not in meanings list has no effect: all unchecked, no crash', () => {
    const fixture = createFixture({ addedDefinitions: ['something not present'] });
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    for (const b of boxes) {
      expect(b.nativeElement.checked).toBe(false);
    }
  });
});

describe('toggle emits', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
  });

  it('toggling a NOT-added definition checkbox emits definitionAppended with {definition, pronunciation}', () => {
    const fixture = createFixture();
    const emitted: { definition: string; pronunciation: string }[] = [];
    fixture.componentInstance.definitionAppended.subscribe((v) => emitted.push(v));

    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    boxes[0].nativeElement.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].definition).toBe('A large aquatic mammal');
    expect(emitted[0].pronunciation).toBe('/weɪl/');
  });

  it('toggling an ADDED definition checkbox emits definitionRemoved with {definition}', () => {
    const fixture = createFixture({ addedDefinitions: ['A large aquatic mammal'] });
    const removed: { definition: string }[] = [];
    fixture.componentInstance.definitionRemoved.subscribe((v) => removed.push(v));

    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    boxes[0].nativeElement.click();
    fixture.detectChanges();

    expect(removed.length).toBe(1);
    expect(removed[0].definition).toBe('A large aquatic mammal');
  });

  it('toggling a NOT-added example checkbox emits exampleAppended', () => {
    const fixture = createFixture();
    const emitted: string[] = [];
    fixture.componentInstance.exampleAppended.subscribe((v) => emitted.push(v));

    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="example-checkbox"]'));
    boxes[0].nativeElement.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toBe('The whale breached the surface.');
  });

  it('toggling an ADDED example checkbox emits exampleRemoved', () => {
    const fixture = createFixture({ addedExamples: ['The whale breached the surface.'] });
    const removed: string[] = [];
    fixture.componentInstance.exampleRemoved.subscribe((v) => removed.push(v));

    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="example-checkbox"]'));
    boxes[0].nativeElement.click();
    fixture.detectChanges();

    expect(removed.length).toBe(1);
    expect(removed[0]).toBe('The whale breached the surface.');
  });

  it('sheet stays open after a toggle: visible() === true', () => {
    const fixture = createFixture();
    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    boxes[0].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.visible()).toBe(true);
  });
});

describe('a11y & regression guards', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
  });

  it('[RG-A11Y] the toggle control is a native checkbox inside a <label>, no nested button', () => {
    const fixture = createFixture();
    const cards = fixture.debugElement.queryAll(By.css('[data-testid="definition-card"]'));
    const box = cards[0].nativeElement.querySelector('[data-testid="definition-checkbox"]');
    expect(box).not.toBeNull();
    expect(box.nodeName).toBe('INPUT');
    expect(box.getAttribute('type')).toBe('checkbox');
    // native checkbox = free keyboard access; label wrapper = large tap target
    expect(cards[0].nativeElement.nodeName).toBe('LABEL');
    expect(cards[0].nativeElement.querySelector('button')).toBeNull();
  });

  it('[RG-A11Y] example control is a native checkbox, no nested button', () => {
    const fixture = createFixture();
    const exRows = fixture.debugElement.queryAll(By.css('[data-testid="example-row"]'));
    const box = exRows[0].nativeElement.querySelector('[data-testid="example-checkbox"]');
    expect(box.nodeName).toBe('INPUT');
    expect(box.getAttribute('type')).toBe('checkbox');
    expect(exRows[0].nativeElement.querySelector('button')).toBeNull();
  });

  it('[RG-PICKER-ADD] multi-add still accumulates: toggling two distinct not-added checkboxes emits twice', () => {
    const fixture = createFixture();
    const emitted: { definition: string; pronunciation: string }[] = [];
    fixture.componentInstance.definitionAppended.subscribe((v) => emitted.push(v));

    const boxes = fixture.debugElement.queryAll(By.css('[data-testid="definition-checkbox"]'));
    boxes[0].nativeElement.click();
    boxes[1].nativeElement.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(2);
    expect(emitted[0].definition).toBe('A large aquatic mammal');
    expect(emitted[1].definition).toBe('A very large amount of something');
  });

  // Dark-mode readability guard: card background variants MUST be applied as whole
  // literal class tokens (via the [class] ternary, reusing the Select Words pattern),
  // never escaped [class.dark:bg-…\/…] bindings that Tailwind's scanner skips (which
  // left a white, unreadable card in dark mode).
  it('[RG-DARKMODE] not-selected card carries the light + dark hover background variants', () => {
    const fixture = createFixture({ addedDefinitions: ['A large aquatic mammal'] });
    const cards = fixture.debugElement.queryAll(By.css('[data-testid="definition-card"]'));
    const notSelected = cards[1].nativeElement as HTMLElement; // card[0] is selected
    expect(notSelected.classList.contains('hover:bg-slate-50')).toBe(true);
    expect(notSelected.classList.contains('dark:hover:bg-slate-700/50')).toBe(true);
  });

  it('[RG-DARKMODE] selected card carries the brand tint + ring in both themes', () => {
    const fixture = createFixture({ addedDefinitions: ['A large aquatic mammal'] });
    const cards = fixture.debugElement.queryAll(By.css('[data-testid="definition-card"]'));
    const selected = cards[0].nativeElement as HTMLElement;
    expect(selected.classList.contains('bg-vv-brandLight/50')).toBe(true);
    expect(selected.classList.contains('dark:bg-vv-brand/10')).toBe(true);
    expect(selected.classList.contains('ring-vv-brand/20')).toBe(true);
  });

  it('[RG-DARKMODE] not-selected example row carries the dark hover background variant', () => {
    const fixture = createFixture();
    const exRows = fixture.debugElement.queryAll(By.css('[data-testid="example-row"]'));
    const notSelected = exRows[0].nativeElement as HTMLElement;
    expect(notSelected.classList.contains('dark:hover:bg-slate-700/50')).toBe(true);
  });
});
