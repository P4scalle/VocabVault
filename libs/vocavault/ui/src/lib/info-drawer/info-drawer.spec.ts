import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InfoDrawer } from './info-drawer';

@Component({
  selector: 'lib-test-host',
  imports: [InfoDrawer],
  template: `
    <lib-info-drawer [(topic)]="topic" />
  `,
})
class TestHost {
  topic = signal<string | null>(null);
}

describe('InfoDrawer', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
  });

  it('should render bottom-sheet when topic is set', () => {
    host.topic.set('mastery');
    fixture.detectChanges();

    const bottomSheet = fixture.nativeElement.querySelector('lib-bottom-sheet');
    expect(bottomSheet).not.toBeNull();
  });

  it('should render info-content when topic is set', () => {
    host.topic.set('mastery');
    fixture.detectChanges();

    const infoContent = fixture.nativeElement.querySelector('lib-info-content');
    expect(infoContent).not.toBeNull();
  });

  it('should not render info-content when topic is null', () => {
    host.topic.set(null);
    fixture.detectChanges();

    const infoContent = fixture.nativeElement.querySelector('lib-info-content');
    expect(infoContent).toBeNull();
  });

  it('should hide everything when topic becomes null', () => {
    host.topic.set('mastery');
    fixture.detectChanges();

    host.topic.set(null);
    fixture.detectChanges();

    const infoContent = fixture.nativeElement.querySelector('lib-info-content');
    expect(infoContent).toBeNull();
  });
});
