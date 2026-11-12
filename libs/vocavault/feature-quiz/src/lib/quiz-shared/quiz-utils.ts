import { ActivatedRoute, Router } from '@angular/router';
import { QuizResultsState } from '@vocavault/data-access';

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
