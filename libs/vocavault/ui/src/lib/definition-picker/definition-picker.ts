import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

export interface DefinitionMeaning {
  pos: string;
  posAbbrev: string;
  definition: string;
  example?: string;
  pronunciation: string;
  sourceIndex: number;
}

@Component({
  selector: 'lib-definition-picker',
  imports: [BottomSheet],
  templateUrl: './definition-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefinitionPicker {
  readonly meanings = input.required<DefinitionMeaning[]>();
  readonly visible = model<boolean>(false);

  readonly addedDefinitions = input<string[]>([]);
  readonly addedExamples = input<string[]>([]);

  readonly definitionAppended = output<{ definition: string; pronunciation: string }>();
  readonly definitionRemoved = output<{ definition: string }>();
  readonly exampleAppended = output<string>();
  readonly exampleRemoved = output<string>();

  protected readonly groupedMeanings = computed(() => {
    const groups = new Map<string, DefinitionMeaning[]>();
    for (const m of this.meanings()) {
      const key = m.pos || 'other';
      const group = groups.get(key) ?? [];
      group.push(m);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([pos, items]) => ({
      pos,
      posAbbrev: items[0].posAbbrev,
      items,
    }));
  });

  protected readonly allExamples = computed(() => {
    const seen = new Set<string>();
    const examples: { text: string; pronunciation: string }[] = [];
    for (const m of this.meanings()) {
      if (m.example && !seen.has(m.example.toLowerCase())) {
        seen.add(m.example.toLowerCase());
        examples.push({ text: m.example, pronunciation: m.pronunciation });
      }
    }
    return examples;
  });

  protected readonly addedDefinitionSet = computed(
    () => new Set(this.addedDefinitions().map((d) => d.trim().toLowerCase())),
  );

  protected readonly addedExampleSet = computed(
    () => new Set(this.addedExamples().map((e) => e.trim().toLowerCase())),
  );

  protected isDefinitionAdded(def: string): boolean {
    return this.addedDefinitionSet().has(def.trim().toLowerCase());
  }

  protected isExampleAdded(text: string): boolean {
    return this.addedExampleSet().has(text.trim().toLowerCase());
  }

  protected onToggleDefinition(item: DefinitionMeaning): void {
    if (this.isDefinitionAdded(item.definition)) {
      this.definitionRemoved.emit({ definition: item.definition });
    } else {
      this.definitionAppended.emit({
        definition: item.definition,
        pronunciation: item.pronunciation,
      });
    }
  }

  protected onToggleExample(ex: { text: string; pronunciation: string }): void {
    if (this.isExampleAdded(ex.text)) {
      this.exampleRemoved.emit(ex.text);
    } else {
      this.exampleAppended.emit(ex.text);
    }
  }
}
