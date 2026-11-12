import { NgTemplateOutlet, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  TemplateRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { acquireScrollLock, releaseScrollLock } from '../scroll-lock/scroll-lock';

export interface ActionDrawerItem {
  id: string;
  label: string;
  iconClass?: string;
  description?: string;
  disabled?: boolean;
  /** Visually emphasise this item (ring + "Start here" badge) to guide first-run users. */
  highlight?: boolean;
}

export type ActionDrawerPosition = 'left' | 'right' | 'bottom' | 'top' | 'full';
export type ActionDrawerSize = 'sm' | 'md' | 'lg' | 'full';

export type ActionItemTemplateContext = {
  $implicit: ActionDrawerItem;
  selectAction: (action: ActionDrawerItem) => void;
};

export type ActionDrawerCloseReason = 'action' | 'backdrop' | 'escape' | 'button';

interface ActionDrawerDefaults {
  title: string;
  ariaLabel: string;
  closeOnAction: boolean;
  closeAriaLabel: string;
  position: ActionDrawerPosition;
  size: ActionDrawerSize;
  modal: boolean;
  dismissible: boolean;
  closeOnEscape: boolean;
  blockScroll: boolean;
  closable: boolean;
  panelStyle: Record<string, string | number>;
  panelClass: string;
}

export interface ActionDrawerConfig extends ActionDrawerDefaults {
  drawerId: string;
  triggerId: string | null;
}

export const ACTION_DRAWER_DEFAULTS: ActionDrawerDefaults = {
  title: 'Actions',
  ariaLabel: 'Available actions',
  closeOnAction: true,
  closeAriaLabel: 'Close actions drawer',
  position: 'bottom',
  size: 'md',
  modal: true,
  dismissible: true,
  closeOnEscape: true,
  blockScroll: true,
  closable: true,
  panelStyle: {},
  panelClass: '',
};

const ACTION_DRAWER_ANIMATION_MS = 180;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'lib-action-drawer',
  imports: [NgTemplateOutlet],
  templateUrl: './action-drawer.html',
  styleUrl: './action-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ActionDrawer {
  private static nextUniqueId = 0;
  // Scroll lock now delegated to shared utility (scroll-lock.ts)

  private readonly generatedDrawerId = `vv-action-drawer-${ActionDrawer.nextUniqueId++}`;

  readonly config = input<Partial<ActionDrawerConfig>>({});
  readonly actions = input.required<readonly ActionDrawerItem[]>();
  readonly visible = model(false);
  readonly itemTemplate = input<TemplateRef<ActionItemTemplateContext> | null>(
    null
  );
  /** Optional helper line shown under the actions (e.g. why some are locked). */
  readonly footerNote = input<string>('');

  readonly actionSelected = output<ActionDrawerItem>();
  readonly closed = output<ActionDrawerCloseReason>();

  protected readonly drawerPanel = viewChild<ElementRef<HTMLElement>>('drawerPanel');
  protected readonly closeButton =
    viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  protected readonly actionButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('actionButton');
  protected readonly rendered = signal(false);
  protected readonly closing = signal(false);

  private readonly document = inject(DOCUMENT);
  private wasVisible = false;
  private previouslyFocusedElement: HTMLElement | null = null;

  protected readonly resolvedConfig = computed<ActionDrawerConfig>(() => {
    const config = this.config();

    return {
      title: config.title ?? ACTION_DRAWER_DEFAULTS.title,
      drawerId: config.drawerId ?? this.generatedDrawerId,
      triggerId: config.triggerId ?? null,
      ariaLabel: config.ariaLabel ?? ACTION_DRAWER_DEFAULTS.ariaLabel,
      closeOnAction: config.closeOnAction ?? ACTION_DRAWER_DEFAULTS.closeOnAction,
      closeAriaLabel: config.closeAriaLabel ?? ACTION_DRAWER_DEFAULTS.closeAriaLabel,
      position: config.position ?? ACTION_DRAWER_DEFAULTS.position,
      size: config.size ?? ACTION_DRAWER_DEFAULTS.size,
      modal: config.modal ?? ACTION_DRAWER_DEFAULTS.modal,
      dismissible: config.dismissible ?? ACTION_DRAWER_DEFAULTS.dismissible,
      closeOnEscape: config.closeOnEscape ?? ACTION_DRAWER_DEFAULTS.closeOnEscape,
      blockScroll: config.blockScroll ?? ACTION_DRAWER_DEFAULTS.blockScroll,
      closable: config.closable ?? ACTION_DRAWER_DEFAULTS.closable,
      panelStyle: { ...ACTION_DRAWER_DEFAULTS.panelStyle, ...(config.panelStyle ?? {}) },
      panelClass: config.panelClass ?? ACTION_DRAWER_DEFAULTS.panelClass,
    };
  });

  protected readonly titleId = computed(
    () => `${this.resolvedConfig().drawerId}-title`
  );

  protected readonly selectAction = (action: ActionDrawerItem): void => {
    this.onActionClick(action);
  };

  protected readonly shellClass = computed(
    () =>
      `vv-action-drawer-shell vv-action-drawer-shell--${this.resolvedConfig().position}`
  );

  protected readonly mergedPanelClass = computed((): string => {
    const resolvedConfig = this.resolvedConfig();
    const customClass = resolvedConfig.panelClass.trim();
    const baseClass =
      `vv-action-drawer vv-action-drawer--${resolvedConfig.position} ` +
      `vv-action-drawer--size-${resolvedConfig.size}`;

    return customClass ? `${baseClass} ${customClass}` : baseClass;
  });

  constructor() {
    effect((onCleanup) => {
      const isVisible = this.visible();

      if (isVisible && !this.wasVisible) {
        this.rendered.set(true);
        this.closing.set(false);
        const activeElement = this.document.activeElement;
        this.previouslyFocusedElement =
          activeElement instanceof HTMLElement ? activeElement : null;
        queueMicrotask(() => this.focusFirstAction());
      }

      if (!isVisible && this.wasVisible) {
        this.closing.set(true);
        this.returnFocusToTrigger();
        const closeTimer = setTimeout(() => {
          if (!this.visible()) {
            this.rendered.set(false);
            this.closing.set(false);
          }
        }, ACTION_DRAWER_ANIMATION_MS);
        onCleanup(() => clearTimeout(closeTimer));
      }

      if (isVisible) {
        this.rendered.set(true);
        this.closing.set(false);
      }

      if (!isVisible && !this.wasVisible) {
        this.rendered.set(false);
        this.closing.set(false);
      }

      this.wasVisible = isVisible;
    });

    effect((onCleanup) => {
      if (!this.visible()) {
        return;
      }

      const onKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          if (!this.resolvedConfig().closeOnEscape) {
            return;
          }

          event.preventDefault();
          this.closeWithReason('escape');
          return;
        }

        if (event.key !== 'Tab') {
          return;
        }

        this.trapFocus(event);
      };

      this.document.addEventListener('keydown', onKeydown);
      onCleanup(() => this.document.removeEventListener('keydown', onKeydown));
    });

    effect((onCleanup) => {
      if (!(this.visible() && this.resolvedConfig().blockScroll)) {
        return;
      }

      this.acquireScrollLock();
      onCleanup(() => this.releaseScrollLock());
    });
  }

  protected onActionClick(action: ActionDrawerItem): void {
    if (action.disabled) {
      return;
    }

    this.actionSelected.emit(action);

    if (this.resolvedConfig().closeOnAction) {
      this.closeWithReason('action');
    }
  }

  protected onBackdropClick(): void {
    if (!this.resolvedConfig().dismissible) {
      return;
    }

    this.closeWithReason('backdrop');
  }

  protected closeDrawer(): void {
    this.closeWithReason('button');
  }

  private focusFirstAction(): void {
    const firstActionButton = this.actionButtons()
      .map((buttonRef) => buttonRef.nativeElement)
      .find((button) => !button.disabled);

    if (firstActionButton) {
      firstActionButton.focus();
      return;
    }

    const closeButton = this.closeButton()?.nativeElement;

    if (closeButton) {
      closeButton.focus();
      return;
    }

    const panelElement = this.drawerPanel()?.nativeElement;
    const firstFocusable = panelElement?.querySelector<HTMLElement>(
      FOCUSABLE_SELECTOR
    );

    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }

    panelElement?.focus();
  }

  private trapFocus(event: KeyboardEvent): void {
    const panelElement = this.drawerPanel()?.nativeElement;

    if (!panelElement) {
      return;
    }

    const focusableElements = this.getFocusableElements(panelElement);

    if (focusableElements.length === 0) {
      event.preventDefault();
      panelElement.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = this.document.activeElement;
    const activeHTMLElement =
      activeElement instanceof HTMLElement ? activeElement : null;
    const activeInsidePanel = !!activeHTMLElement && panelElement.contains(activeHTMLElement);

    if (event.shiftKey) {
      if (!activeInsidePanel || activeHTMLElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      return;
    }

    if (!activeInsidePanel || activeHTMLElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private getFocusableElements(panelElement: HTMLElement): HTMLElement[] {
    return Array.from(panelElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  private closeWithReason(reason: ActionDrawerCloseReason): void {
    if (!this.visible()) {
      return;
    }

    this.closed.emit(reason);
    this.visible.set(false);
  }

  private acquireScrollLock(): void {
    acquireScrollLock(this.document);
  }

  private releaseScrollLock(): void {
    releaseScrollLock(this.document);
  }

  private returnFocusToTrigger(): void {
    const triggerId = this.resolvedConfig().triggerId;
    const triggerElement = triggerId
      ? this.document.getElementById(triggerId)
      : null;

    if (triggerElement instanceof HTMLElement) {
      triggerElement.focus();
      return;
    }

    this.previouslyFocusedElement?.focus();
  }
}
