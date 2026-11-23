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
  'mode-flashcard': {
    icon: 'pi pi-clone',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Flashcard',
    sections: [
      {
        text: 'Flip each card to reveal its definition, check your recall, then move on. The lowest-pressure way to meet new words.',
      },
      {
        text: "Works with any set size, so it's a good place to start before the other modes unlock.",
      },
    ],
  },
  'mode-multiple-choice': {
    icon: 'pi pi-list-check',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Multiple Choice',
    sections: [
      {
        text: 'Pick the correct definition from several options. Fast, and it builds recognition before you try writing answers from memory.',
      },
      {
        text: 'Needs at least 4 words in the set so there are enough options to choose from. Add more words to unlock it.',
      },
    ],
  },
  'mode-type': {
    icon: 'pi pi-pen-to-square',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Type / Write',
    sections: [
      {
        text: 'Type the definition from memory. The toughest mode and the fastest way to make a word stick. Close answers are accepted, so small typos won\'t count against you.',
      },
    ],
  },
  'mode-match': {
    icon: 'pi pi-arrows-h',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Match',
    sections: [
      {
        text: 'Pair each word with its definition against the clock. A quick, playful way to review a whole set at once (larger sets are split into rounds).',
      },
      {
        text: 'Needs at least 4 words in the set to make a round. Add more words to unlock it.',
      },
    ],
  },
  // In-quiz "what to do" help, opened from the info button beside the quiz
  // title. Kept separate from the 'mode-*' topics (which describe modes on the
  // selection screen) because mid-quiz the voice is "here is how to play now".
  'howto-flashcard': {
    icon: 'pi pi-clone',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Flashcard',
    sections: [
      {
        text: 'Tap a card to flip it and see the answer. Then tell us honestly whether you got it or missed it, and we use that to plan your review. There is no pressure here. This is just about meeting the words.',
      },
    ],
  },
  'howto-multiple-choice': {
    icon: 'pi pi-list-check',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Multiple Choice',
    sections: [
      {
        text: 'Read the prompt, then pick the option that fits. Prefer the keyboard? Press 1 to 4 to choose. If you miss one, tap Why for a friendly explanation. Every answer helps us learn what to revisit with you.',
      },
    ],
  },
  'howto-type': {
    icon: 'pi pi-pen-to-square',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Type / Write',
    sections: [
      {
        text: 'Type the answer from memory and press Enter. Do not worry about being perfect. Close answers and small typos still count, so a stray letter will not hurt. Miss one? Tap Why and we walk you through it.',
      },
    ],
  },
  'howto-match': {
    icon: 'pi pi-arrows-h',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Match',
    sections: [
      {
        text: 'Tap a word, then tap its matching definition to pair them up. Changed your mind? Tap it again to undo. Bigger sets are split into short rounds, so you can work through them a little at a time.',
      },
    ],
  },
  'quiz-direction': {
    icon: 'pi pi-info-circle',
    iconBg: 'bg-vv-brandLight dark:bg-vv-brand/20',
    title: 'Quiz Direction',
    sections: [
      {
        text: 'Direction controls which side of a word you see and which side you answer:',
        items: [
          { label: 'Definition → Word', description: 'see the meaning, recall the word' },
          { label: 'Word → Definition', description: 'see the word, recall its meaning' },
          { label: 'Example → Definition', description: 'see an example sentence, recall what the word means' },
          { label: 'Mixed', description: 'a blend of the directions above' },
        ],
      },
      {
        text: 'Example → Definition is available only when every word in the set has a term, a definition, and an example sentence. You can add examples to any word anytime from the Dictionary.',
      },
    ],
  },
};
