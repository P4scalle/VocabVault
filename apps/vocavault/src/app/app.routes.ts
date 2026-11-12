import { Route } from '@angular/router';
import { unsavedChangesGuard } from '@vocavault/data-access';
import { FeatureShell } from '@vocavault/feature-shell';
import { NotFoundComponent } from './not-found';

export const appRoutes: Route[] = [
  {
    path: '',
    component: FeatureShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () =>
          import('@vocavault/feature-home').then((module) => module.FeatureHome),
      },
      {
        path: 'dictionary',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@vocavault/feature-dictionary').then(
            (module) => module.FeatureDictionary
          ),
      },
      {
        path: 'quiz',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.FeatureQuiz
              ),
          },
          {
            path: 'create',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.QuizCreate
              ),
          },
          {
            path: 'launch',
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.QuizLauncher
              ),
          },
          {
            path: 'smart-review',
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.SmartReviewLauncher
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.QuizDetail
              ),
          },
          {
            path: ':id/edit',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.QuizEdit
              ),
          },
          {
            path: ':id/play',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.QuizPlayRouter
              ),
          },
          {
            path: ':id/results',
            loadComponent: () =>
              import('@vocavault/feature-quiz').then(
                (module) => module.QuizResults
              ),
          },
        ],
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('@vocavault/feature-progress').then(
            (module) => module.FeatureProgress
          ),
      },
      { path: '**', component: NotFoundComponent },
    ],
  },
];
