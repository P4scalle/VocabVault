import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  template: `
    <div class="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div class="w-24 h-24 bg-vv-brandLight rounded-full flex items-center justify-center mb-6">
        <i class="pi pi-map text-4xl text-vv-brand" aria-hidden="true"></i>
      </div>
      <h1 class="text-3xl font-bold text-slate-800 mb-2">Page not found</h1>
      <p class="text-slate-500 mb-6 max-w-xs">The page you're looking for doesn't exist or has been moved.</p>
      <a routerLink="/home" class="bg-vv-brand hover:bg-[#2F6380] text-white font-semibold py-3 px-8 rounded-xl transition-colors">
        Go Home
      </a>
    </div>
  `,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
