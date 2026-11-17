import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BottomSheet, Button } from '@vocavault/ui';
import { OnboardingService } from '@vocavault/util';

interface ConfettiPiece {
  left: number;
  delayMs: number;
  durationMs: number;
  color: string;
  rotate: number;
  size: number;
}

const CONFETTI_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ec4899', '#34d399', '#a78bfa'];

/**
 * The closing beat of the onboarding loop, shown when the user lands on the
 * Progress page after completing their first quiz (and at the end of a replayed
 * tour). Responsive via BottomSheet: a bottom sheet on mobile, a centered dialog
 * on tablet/desktop. Visibility is owned entirely by OnboardingService
 * (showCelebration / dismissCelebration), so this component just renders it.
 */
@Component({
  selector: 'lib-onboarding-celebration',
  imports: [BottomSheet, Button],
  templateUrl: './celebration.html',
  styleUrl: './celebration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class OnboardingCelebration {
  protected readonly onboarding = inject(OnboardingService);

  // Deterministic, varied confetti — no Math.random so it stays stable across
  // change detection and tests. Reduced-motion hides it entirely via CSS, with
  // the static trophy + copy carrying the celebration.
  protected readonly confetti: readonly ConfettiPiece[] = Array.from({ length: 42 }, (_, i) => ({
    left: (i * 97 + 13) % 100,
    delayMs: (i % 12) * 55,
    durationMs: 2200 + (i % 7) * 170,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: ((i * 73) % 360) + 540,
    size: 6 + (i % 4) * 2,
  }));

  /** Acknowledge the celebration; during a replay this also ends the tour. */
  protected onClose(): void {
    this.onboarding.dismissCelebration();
  }
}
