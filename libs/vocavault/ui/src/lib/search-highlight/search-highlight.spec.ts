import { TestBed } from '@angular/core/testing';
import { SafeHtml } from '@angular/platform-browser';
import { SearchHighlightPipe } from './search-highlight';

/** Angular's runtime SafeHtml wrapper exposes the inner string via this property. */
interface SafeHtmlInternal {
  changingThisBreaksApplicationSecurity: string;
}

function unwrapSafeHtml(result: SafeHtml | string): string {
  const internal = result as unknown as Partial<SafeHtmlInternal>;
  return internal.changingThisBreaksApplicationSecurity ?? (result as string);
}

describe('SearchHighlightPipe', () => {
  let pipe: SearchHighlightPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new SearchHighlightPipe());
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns original text when query is empty', () => {
    expect(pipe.transform('hello world', '')).toBe('hello world');
  });

  it('returns original text when text is empty', () => {
    expect(pipe.transform('', 'query')).toBe('');
  });

  it('wraps matching text in mark tags', () => {
    const html = unwrapSafeHtml(pipe.transform('hello world', 'world'));
    expect(html).toContain('<mark');
    expect(html).toContain('world');
  });

  it('is case insensitive', () => {
    const html = unwrapSafeHtml(pipe.transform('Hello World', 'hello'));
    expect(html).toContain('<mark');
    expect(html).toContain('Hello');
  });

  it('highlights multiple occurrences', () => {
    const html = unwrapSafeHtml(pipe.transform('the cat and the dog', 'the'));
    const matches = html.match(/<mark/g);
    expect(matches?.length).toBe(2);
  });

  it('escapes regex special characters in query', () => {
    const html = unwrapSafeHtml(pipe.transform('price is $5.00', '$5'));
    expect(html).toContain('<mark');
  });

  it('returns text as-is when no match found', () => {
    const html = unwrapSafeHtml(pipe.transform('hello world', 'xyz'));
    expect(html).toBe('hello world');
  });
});
