import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  let fixture: ComponentFixture<PageHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeader],
    }).compileComponents();
    fixture = TestBed.createComponent(PageHeader);
    fixture.componentRef.setInput('title', 'My Page');
  });

  it('renders the title as a heading', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('My Page');
  });

  it('hides back button when showBack is false (default)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('shows back button when showBack is true', async () => {
    fixture.componentRef.setInput('showBack', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });

  it('emits backClicked when back button is clicked', async () => {
    fixture.componentRef.setInput('showBack', true);
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = false;
    fixture.componentInstance.backClicked.subscribe(() => (emitted = true));

    fixture.nativeElement.querySelector('button').click();
    expect(emitted).toBe(true);
  });
});
