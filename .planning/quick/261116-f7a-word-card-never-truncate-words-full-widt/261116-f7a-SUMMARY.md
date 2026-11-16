---
quick_id: 261116-f7a
title: "Word-card: never truncate words, full-width definition, kebab actions"
branch: feat/word-card-kebab-actions
status: complete
---

# Quick Task 261116-f7a — Summary

## What changed

Redesigned the Dictionary `word-card` so vocabulary words are never truncated and
the definition/meanings use the full tile width, by collapsing the three inline
action icons (folder / flag / delete) into a single `⋮` kebab overflow menu.

### Files
- `libs/vocavault/feature-dictionary/src/lib/word-card/word-card.ts`
  - Added `menuOpen` signal + `toggleMenu()` / `closeMenu()`.
  - `@HostListener('document:click')` and `('document:keydown.escape')` close the
    menu — mirrors the existing folder-row popover pattern.
- `libs/vocavault/feature-dictionary/src/lib/word-card/word-card.html`
  - Word now on its own full-width line with `break-words` (removed
    `truncate max-w-[min(10rem,60%)]`) → never clips.
  - Mastery / "Needs attention" / "Flagged" badges moved to their own line below
    the word. Inline "Flagged" badge kept so flag state stays visible.
  - Three action buttons replaced with a kebab (`pi-ellipsis-v`) button
    (`aria-haspopup`, `aria-expanded`, 44px target) + popover containing
    "Add to folder", "Flag this word / Remove flag", and hold-to-delete
    (reusing `lib-hold-button` with the `.vv-hold-menu-item` pattern).
  - Content column keeps `flex-1 min-w-0`; kebab is a `flex-shrink-0` sibling, so
    the whole content area reclaims full width.
  - Fixes the oversized flag icon (it previously lacked a `text-xs` size class
    unlike folder/trash); actions are now uniform menu rows.

### Tests updated
- `word-card.spec.ts` — delete test opens the kebab menu before asserting the
  hold-to-delete button.
- `apps/vocavault-e2e/src/dictionary.spec.ts` — "deleting a word from the card"
  opens the kebab ("Options for ephemeral") before pressing delete.

## Verification
- `nx build vocavault` (AOT template compile): **pass**.
- `nx test feature-dictionary`: **215/215 pass** (word-card 10/10).
- E2E not run here (requires browser); updated the one affected card-delete spec.

## Notes / separation
- Branch `feat/word-card-kebab-actions`, kept separate from master.
- The other terminal's flashcard-quiz WIP (`flashcard-quiz.html/.scss`) was left
  untouched — only word-card files were staged/committed.

## Follow-ups (optional)
- Visual a11y check in light + dark mode (per project rule) before any deploy.
- Consider the same kebab treatment for quiz-mode option/tile long-word handling.
