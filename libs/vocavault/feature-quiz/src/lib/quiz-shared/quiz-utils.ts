import { Signal, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizResultsState } from '@vocavault/data-access';
import { OnboardingService } from '@vocavault/util';

/**
 * Pulse the Finish/See Results button while a first-run user is playing their
 * very first quiz (the start-quiz milestone), so they are carried across the
 * last gap into their results. Call from a component field initializer (an
 * injection context). Shared by all quiz modes to keep the cue consistent.
 */
export function firstQuizFinishCue(): Signal<boolean> {
  const onboarding = inject(OnboardingService);
  return computed(() => onboarding.currentStep() === 'start-quiz');
}

export function resolveQuizSetId(route: ActivatedRoute): string {
  return (
    route.snapshot.paramMap.get('id') ??
    route.parent?.snapshot.paramMap.get('id') ??
    ''
  );
}

export function navigateToResults(
  router: Router,
  quizSetId: string,
  results: QuizResultsState
): void {
  void router.navigate(['/quiz', quizSetId, 'results'], { state: results });
}
