import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'searchHighlight' })
export class SearchHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(text: string, query: string): SafeHtml {
    if (!query || !text) return text;
    const q = query.trim();
    if (!q) return text;

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const highlighted = text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600/40 text-slate-900 dark:text-slate-100 rounded-sm px-0.5">$1</mark>');
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
