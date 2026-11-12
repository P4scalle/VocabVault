import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActionDrawer,
  ActionDrawerCloseReason,
  ActionDrawerConfig,
  ActionDrawerItem,
} from './action-drawer';

describe('ActionDrawer', () => {
  let fixture: ComponentFixture<ActionDrawer>;
  let component: ActionDrawer;

  const actions: readonly ActionDrawerItem[] = [
    {
      id: 'word',
      label: 'Word',
      description: 'Add a new word.',
      iconClass: 'pi pi-file-edit',
    },
    {
      id: 'folder',
      label: 'Folder',
      description: 'Group words in a new folder.',
      iconClass: 'pi pi-folder',
    },
    {
      id: 'quiz',
      label: 'Quiz',
      description: 'Create a quiz set.',
      iconClass: 'pi pi-bolt',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionDrawer],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionDrawer);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('actions', actions);
  });

  it('should use the simplified config input', async () => {
    fixture.componentRef.setInput('config', {
      title: 'Add',
      ariaLabel: 'Add options',
    } satisfies Partial<ActionDrawerConfig>);
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('h2') as HTMLHeadingElement | null;
    const section = fixture.nativeElement.querySelector('section') as HTMLElement | null;
    const actionButtons = fixture.nativeElement.querySelectorAll(
      'section li button'
    ) as NodeListOf<HTMLButtonElement>;

    expect(title?.textContent?.trim()).toBe('Add');
    expect(section?.getAttribute('aria-label')).toBe('Add options');
    expect(actionButtons.length).toBe(3);
  });

  it('should emit action and close by default', async () => {
    const emittedActions: ActionDrawerItem[] = [];
    const closeReasons: ActionDrawerCloseReason[] = [];
    component.actionSelected.subscribe((action) => emittedActions.push(action));
    component.closed.subscribe((reason) => closeReasons.push(reason));

    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const actionButton = fixture.nativeElement.querySelector(
      'section button'
    ) as HTMLButtonElement;
    actionButton.click();
    fixture.detectChanges();

    expect(emittedActions).toEqual([actions[0]]);
    expect(closeReasons).toEqual(['action']);
    expect(component.visible()).toBe(false);
  });

  it('should keep drawer open when closeOnAction is false', async () => {
    fixture.componentRef.setInput('config', {
      closeOnAction: false,
    } satisfies Partial<ActionDrawerConfig>);
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const actionButton = fixture.nativeElement.querySelector(
      'section button'
    ) as HTMLButtonElement;
    actionButton.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
  });

  it('should return focus to the trigger element on close', async () => {
    const trigger = document.createElement('button');
    trigger.id = 'drawer-trigger';
    document.body.appendChild(trigger);

    fixture.componentRef.setInput('config', {
      triggerId: trigger.id,
    } satisfies Partial<ActionDrawerConfig>);
    trigger.focus();

    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();

    component.visible.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it('should close on escape and emit escape reason', () => {
    const closeReasons: ActionDrawerCloseReason[] = [];
    component.closed.subscribe((reason) => closeReasons.push(reason));

    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    expect(closeReasons).toEqual(['escape']);
  });

  it('should not close on escape when closeOnEscape is false', () => {
    fixture.componentRef.setInput('config', {
      closeOnEscape: false,
    } satisfies Partial<ActionDrawerConfig>);
    component.visible.set(true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
  });

  it('should close on backdrop click when dismissible', () => {
    const closeReasons: ActionDrawerCloseReason[] = [];
    component.closed.subscribe((reason) => closeReasons.push(reason));

    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector(
      '.vv-action-drawer__backdrop'
    ) as HTMLButtonElement | null;

    backdrop?.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    expect(closeReasons).toEqual(['backdrop']);
  });

  it('should ignore backdrop click when dismissible is false', () => {
    fixture.componentRef.setInput('config', {
      dismissible: false,
    } satisfies Partial<ActionDrawerConfig>);
    component.visible.set(true);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector(
      '.vv-action-drawer__backdrop'
    ) as HTMLButtonElement | null;

    backdrop?.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
  });

  it('should ignore disabled actions', async () => {
    const emittedActions: ActionDrawerItem[] = [];
    const disabledActions: readonly ActionDrawerItem[] = [
      { ...actions[0], disabled: true },
      actions[1],
    ];

    component.actionSelected.subscribe((action) => emittedActions.push(action));

    fixture.componentRef.setInput('actions', disabledActions);
    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const actionButtons = fixture.nativeElement.querySelectorAll(
      'section li button'
    ) as NodeListOf<HTMLButtonElement>;

    actionButtons[0].click();
    fixture.detectChanges();

    expect(emittedActions).toEqual([]);
    expect(component.visible()).toBe(true);
  });

  it('should emit button reason when closed with close button', async () => {
    const closeReasons: ActionDrawerCloseReason[] = [];
    component.closed.subscribe((reason) => closeReasons.push(reason));

    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const closeButton = fixture.nativeElement.querySelector(
      '.vv-action-drawer__close-button'
    ) as HTMLButtonElement | null;

    closeButton?.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
    expect(closeReasons).toEqual(['button']);
  });

  it('should trap focus with tab and shift+tab', async () => {
    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const closeButton = fixture.nativeElement.querySelector(
      '.vv-action-drawer__close-button'
    ) as HTMLButtonElement | null;
    const actionButtons = fixture.nativeElement.querySelectorAll(
      'section li button'
    ) as NodeListOf<HTMLButtonElement>;
    const lastActionButton = actionButtons[actionButtons.length - 1];

    lastActionButton.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement).toBe(closeButton);

    closeButton?.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
    );
    expect(document.activeElement).toBe(lastActionButton);
  });

  it('should keep drawer mounted while close animation runs', async () => {
    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('aside')).not.toBeNull();

    component.visible.set(false);
    fixture.detectChanges();

    const drawerPanel = fixture.nativeElement.querySelector(
      'aside'
    ) as HTMLElement | null;
    expect(drawerPanel).not.toBeNull();
    expect(drawerPanel?.classList.contains('vv-action-drawer--closing')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 181));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('aside')).toBeNull();
  });

  it('should keep scroll lock until all drawers are closed', () => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'scroll';
    document.body.style.paddingRight = '3px';

    const secondFixture = TestBed.createComponent(ActionDrawer);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.componentRef.setInput('actions', actions);
    secondFixture.componentRef.setInput('config', {});

    fixture.componentRef.setInput('config', {});
    component.visible.set(true);
    fixture.detectChanges();

    secondComponent.visible.set(true);
    secondFixture.detectChanges();

    expect(document.body.style.overflow).toBe('hidden');

    component.visible.set(false);
    fixture.detectChanges();

    expect(document.body.style.overflow).toBe('hidden');

    secondComponent.visible.set(false);
    secondFixture.detectChanges();

    expect(document.body.style.overflow).toBe('scroll');
    expect(document.body.style.paddingRight).toBe('3px');

    secondFixture.destroy();
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  });

  it('renders a footer note when provided', async () => {
    fixture.componentRef.setInput('footerNote', 'Add your first word to unlock quizzes and folders.');
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const footer = fixture.nativeElement.querySelector('[data-testid="action-drawer-footer"]');
    expect(footer?.textContent).toContain('Add your first word to unlock quizzes and folders.');
  });

  it('omits the footer note when empty', async () => {
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="action-drawer-footer"]')).toBeFalsy();
  });

  it('marks a highlighted action with a ring and a "Start here" badge, and disables others', async () => {
    fixture.componentRef.setInput('actions', [
      { id: 'word', label: 'Word', highlight: true },
      { id: 'quiz', label: 'Quiz', disabled: true },
    ] satisfies readonly ActionDrawerItem[]);
    component.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('section li button') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].classList.contains('vv-action-highlight')).toBe(true);
    expect(buttons[0].textContent).toContain('Start here');
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[1].classList.contains('vv-action-highlight')).toBe(false);
  });
});
