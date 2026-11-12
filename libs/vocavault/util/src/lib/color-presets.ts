/** Curated preset colors for folders, quiz sets, and any color picker in the app.
 *  9 hues with even color-wheel coverage + a custom picker affordance in the UI. */
export const PRESET_COLORS = [
  '#3A7CA5', '#6366F1', '#EC4899', '#EF4444',
  '#F97316', '#CA8A04', '#22C55E', '#06B6D4',
  '#A855F7',
] as const;

export const PRESET_COLOR_NAMES: Record<string, string> = {
  '#3A7CA5': 'Steel Blue',
  '#6366F1': 'Indigo',
  '#EC4899': 'Pink',
  '#EF4444': 'Red',
  '#F97316': 'Orange',
  '#CA8A04': 'Gold',
  '#22C55E': 'Green',
  '#06B6D4': 'Cyan',
  '#A855F7': 'Purple',
};
