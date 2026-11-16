---
phase: quick-261116-dve
plan: 01
subsystem: feature-quiz, ui
tags: [info-drawer, quiz-modes, ux, accessibility]
dependency_graph:
  requires: [InfoButton, InfoDrawer from @vocavault/ui, INFO_TOPICS in info-topics.ts]
  provides: [per-mode info buttons on quiz-detail mode cards]
  affects: [feature-quiz/quiz-detail, ui/info-topics]
tech_stack:
  added: []
  patterns: [activeInfoDrawer signal + lib-info-button sibling + lib-info-drawer at root (feature-home idiom)]
key_files:
  created: []
  modified:
    - libs/vocavault/ui/src/lib/info-content/info-topics.ts
    - libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.ts
    - libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.html
    - libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.spec.ts
decisions:
  - Positioned sibling div required around lib-info-button because host uses display:contents (cannot be positioned directly)
  - locked-modes-hint paragraph removed; unlock reason now lives in mode-multiple-choice and mode-match INFO_TOPICS entries
metrics:
  duration: ~15min
  completed: 2026-11-16
  tasks: 3
  files: 4
---

# Quick Task 261116-dve: Add per-mode info buttons to quiz-detail mode cards

**One-liner:** Per-mode (i) info buttons on all four quiz-detail mode cards using the activeInfoDrawer signal + lib-info-button sibling + lib-info-drawer pattern from feature-home; locked-modes-hint paragraph removed.

## What was built

Each of the four "Choose a mode" cards in quiz-detail now has a tappable (i) button in its top-right corner. Tapping it opens that mode's own help topic in a bottom sheet (mobile) or centered modal (desktop) without starting the quiz. The (i) on locked cards (Multiple Choice, Match) remains clickable even when the card button is disabled.

The always-visible `#locked-modes-hint` paragraph was removed; its content now lives in the per-mode info topics where users can find it on demand.

## Tasks completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add four per-mode INFO_TOPICS entries | d6aa3c6 | info-topics.ts |
| 2 | Wire quiz-detail.ts and add per-card (i) buttons + drawer | 8b55321 | quiz-detail.ts, quiz-detail.html |
| 3 | Verify AOT template compile + tests (+ spec fix) | 786b5be | quiz-detail.spec.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spec asserting on removed locked-modes-hint DOM element**
- **Found during:** Task 3 (verify step)
- **Issue:** `quiz-detail.spec.ts` had two tests referencing `[data-testid="locked-modes-hint"]` — one asserting `toBeTruthy()` (would fail), one asserting `toBeFalsy()` (would pass trivially).
- **Fix:** Removed the DOM assertion from the small-set gating test; updated test name to remove hint reference; removed the `toBeFalsy()` assertion from the unlock test since it no longer adds signal.
- **Files modified:** `libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.spec.ts`
- **Commit:** 786b5be

## Verification results

- `npm run verify` green: lint clean, 293 tests pass across all projects, AOT build succeeds
- All four mode cards verified to have per-card `activeInfoDrawer.set('mode-...')` bindings in template
- `[(topic)]="activeInfoDrawer"` binding on `lib-info-drawer` present
- `locked-modes-hint` absent from both template and spec
- `data-testid="mode-hint"` onboarding paragraph untouched
- `[attr.title]` tooltip kept on multiple-choice and match cards

## Known Stubs

None.

## Self-Check: PASSED

- `libs/vocavault/ui/src/lib/info-content/info-topics.ts` — FOUND (all four mode keys present)
- `libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.ts` — FOUND (InfoButton, InfoDrawer imports + activeInfoDrawer signal)
- `libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.html` — FOUND (four (i) siblings + single lib-info-drawer)
- Commits d6aa3c6, 8b55321, 786b5be — FOUND
