export const POS_ABBREVS: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  pronoun: 'pron.',
  preposition: 'prep.',
  conjunction: 'conj.',
  interjection: 'interj.',
  determiner: 'det.',
  exclamation: 'excl.',
};

export const POS_ABBREV_SET = new Set<string>(Object.values(POS_ABBREVS));

export const POS_ABBREV_TO_FULL: Record<string, string> = {};
for (const [full, abbrev] of Object.entries(POS_ABBREVS)) {
  POS_ABBREV_TO_FULL[abbrev] = full;
}

export const POS_BADGE_CLASSES: Record<string, string> = {
  'n.': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  'v.': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  'adj.': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  'adv.': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  'pron.': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'prep.': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'conj.': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'interj.': 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  'det.': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'excl.': 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
};
