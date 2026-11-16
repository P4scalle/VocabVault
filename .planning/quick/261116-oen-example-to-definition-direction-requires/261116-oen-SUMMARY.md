---
quick_id: 261116-oen
title: Example → Definition requires all words complete (term + definition + example)
status: complete
commit: 81cbaee
---

# Quick Task 261116-oen — Summary

## What changed

The **Example → Definition** quiz direction is now **all-or-nothing**: it is offered
only when *every* word in the set has a non-empty term, a non-empty definition, and at
least one example. Previously it appeared once 3+ words had an example
(`EXAMPLE_DIRECTION_MIN_WORDS = 3`) and silently dropped words without one.

## Implementation

- **`libs/vocavault/data-access/src/lib/quiz-capabilities.ts`**
  - Removed `EXAMPLE_DIRECTION_MIN_WORDS`.
  - Added `hasExamplePlayableContent(word)` — term AND definition AND `examples.length > 0`.
  - `playableWordCount(..., 'example-to-definition')` counts words passing that predicate.
  - `directionOfferable(..., 'example-to-definition')` →
    `words.length > 0 && words.every(hasExamplePlayableContent)`.
- **`libs/vocavault/ui/src/lib/info-content/info-topics.ts`**
  - quiz-direction info text now reads: *"Example → Definition is available only when
    every word in the set has a term, a definition, and an example sentence…"*
- **Tests** — `quiz-capabilities.spec.ts` and `quiz-detail.spec.ts` reworked to the
  all-complete rule (dropped the removed constant; mixed set → hidden; all-complete set
  → offered; match/MC still gated by their 4-word minimum).

## Not touched (intentionally)

Per-quiz `examples.length > 0` filters in flashcard/type/match/quiz-direction are now
harmless no-ops once the offering gate guarantees completeness; left as defensive
filters. The `mixed` direction's per-word behavior is unchanged.

## Verification

- `npx nx test data-access` — 542 passed (incl. 15 quiz-capabilities).
- `npx nx test feature-quiz` — 293 passed (incl. 13 quiz-detail).

## Commit

- `81cbaee` — feat(quiz): require every word complete for Example → Definition

## Follow-ups / notes

- No spec or e2e asserts the info-topic string, so the text change is isolated.
- Executed **inline (no worktree)** to avoid the documented Windows node_modules-junction
  worktree hazard for this repo.
