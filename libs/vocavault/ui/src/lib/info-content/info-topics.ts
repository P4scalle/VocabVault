export interface InfoTopicSection {
  text?: string;
  items?: Array<{ label: string; description: string; color?: string }>;
  badges?: Array<{ label: string; class: string }>;
  footnote?: string;
}

export interface InfoTopic {
  icon: string;
  iconBg: string;
  title: string;
  sections: InfoTopicSection[];
}

export const INFO_TOPICS: Record<string, InfoTopic> = {
  'quiz-types': {
    icon: 'pi pi-info-circle',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Quiz Types',
    sections: [
      {
        text: 'Choose from four different quiz types to practice your vocabulary:',
        items: [
          { label: 'Flashcards', description: 'Flip cards to review words and definitions' },
          { label: 'Multiple Choice', description: 'Pick the correct answer from options' },
          { label: 'Write', description: 'Type the answer. Close answers are accepted!' },
          { label: 'Match', description: 'Pair words with their definitions (multi-round for large sets)' },
        ],
      },
    ],
  },
  'mastery-colors': {
    icon: 'pi pi-info-circle',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Mastery Colors',
    sections: [
      {
        text: 'The colored bar on each quiz shows how well you know its words.',
        items: [
          { label: 'New', description: "haven't practiced yet", color: 'bg-slate-300 dark:bg-slate-500' },
          { label: 'Learning', description: 'getting there, keep practicing', color: 'bg-amber-400 dark:bg-amber-500' },
          { label: 'Review', description: 'almost mastered, just needs review', color: 'bg-blue-400 dark:bg-blue-500' },
          { label: 'Mastered', description: 'you know this word!', color: 'bg-emerald-400 dark:bg-emerald-500' },
        ],
        footnote: 'As you practice, the bar fills with green from left to right.',
      },
    ],
  },
  'mastery-levels': {
    icon: 'pi pi-info-circle',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Mastery Breakdown',
    sections: [
      {
        text: 'Track your words across four mastery levels:',
        items: [
          { label: 'New', description: "Words you haven't practiced yet" },
          { label: 'Learning', description: "Words you're currently studying" },
          { label: 'Review', description: 'Words ready for reinforcement' },
          { label: 'Mastered', description: 'Words you know well' },
        ],
      },
    ],
  },
  'eloquence': {
    icon: 'pi pi-info-circle',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Eloquence Score',
    sections: [
      {
        text: 'Your Eloquence Score measures how well you know your vocabulary. Each word earns points based on its mastery level:',
        items: [
          { label: 'New', description: '0 points' },
          { label: 'Learning', description: '33 points' },
          { label: 'Review', description: '66 points' },
          { label: 'Mastered', description: '100 points' },
        ],
      },
      {
        text: 'Your score is the average across all words. Master everything to reach 100!',
      },
    ],
  },
  'due-review': {
    icon: 'pi pi-clock',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    title: 'Due for Review',
    sections: [
      {
        text: 'Words move here after you learn them in a quiz. They reappear at increasing intervals based on <strong>spaced repetition</strong>. Get a word right and it comes back later. Get it wrong and it comes back sooner. Once you master a word, it stops appearing.',
      },
      {
        text: 'Tap <strong>Start Review</strong> to quiz yourself on all due words.',
      },
    ],
  },
  'tough-ones': {
    icon: 'pi pi-sync',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    title: 'The Tough Ones',
    sections: [
      {
        text: "Every word here is one you're actively working on. They just need a few more rounds to click. That's exactly how learning works!",
      },
      {
        text: 'Focused practice on these words is the fastest way to turn them into words you know by heart. Keep going, you\'re closer than you think!',
      },
    ],
  },
  'stats': {
    icon: 'pi pi-chart-bar',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Your Stats',
    sections: [
      {
        items: [
          { label: 'Day Streak', description: "Consecutive days you've completed at least one quiz. Keep it going!" },
          { label: 'Words This Week', description: 'Words that moved up a mastery level in the last 7 days.' },
          { label: 'vs Last Week', description: 'Compares your score, words learned, and quiz accuracy against the previous week. This section appears after your second week of use.' },
        ],
      },
    ],
  },
  'dictionary': {
    icon: 'pi pi-book',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Your Dictionary',
    sections: [
      {
        text: 'Each word shows its mastery level. As you practice in quizzes, words progress:',
        badges: [
          { label: 'New', class: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
          { label: 'Learning', class: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
          { label: 'Review', class: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
          { label: 'Mastered', class: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
        ],
      },
      {
        text: '<strong>Folders</strong>: Group words by topic, language, or any way you like. Tap the folder icon on a word to assign it. Use the Folders tab to browse by group.',
      },
      {
        text: '<strong>Bulk Import</strong>: Tap the upload icon to paste or import many words at once. Definitions can be looked up automatically.',
      },
    ],
  },
};
