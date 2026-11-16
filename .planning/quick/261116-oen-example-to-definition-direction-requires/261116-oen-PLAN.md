---
quick_id: 261116-oen
title: Example → Definition requires all words complete (term + definition + example)
status: planned
---

# Quick Task 261116-oen — Plan

## Goal

Change the **Example → Definition** quiz direction so it is offered **only when every
word in the set is complete** — has a non-empty term, a non-empty definition, and at
least one example. Previously it appeared once at least 3 words had an example
(`EXAMPLE_DIRECTION_MIN_WORDS = 3`) and silently dropped words without examples.

New rule is all-or-nothing: if any word in the list lacks a term, definition, or
example, the direction is not offered at all.

## Scope / affected files

- `libs/vocavault/data-access/src/lib/quiz-capabilities.ts` — primary logic
- `libs/vocavault/ui/src/lib/info-content/info-topics.ts` — "quiz-direction" info "i" text
- `libs/vocavault/data-access/src/lib/quiz-capabilities.spec.ts` — tests
- `libs/vocavault/feature-quiz/src/lib/quiz-detail/quiz-detail.spec.ts` — tests

Out of scope (unchanged, already correct): per-quiz `examples.length > 0` filters in
flashcard/type/match/quiz-direction — they become harmless no-ops once the gate
guarantees completeness. `mixed` direction per-word behavior is untouched.

## Tasks

### Task 1 — Logic: gate example direction on full completeness
- **files:** `quiz-capabilities.ts`
- **action:**
  - Add `hasExamplePlayableContent(word)` = non-empty term AND non-empty definition
    AND `examples.length > 0`.
  - `playableWordCount(..., 'example-to-definition')` counts words passing that predicate.
  - `directionOfferable(..., 'example-to-definition')` returns
    `words.length > 0 && words.every(hasExamplePlayableContent)` (all-or-nothing).
  - Remove the now-unused `EXAMPLE_DIRECTION_MIN_WORDS` constant and update the
    explanatory comment block.
- **verify:** `npx nx test data-access`
- **done:** example direction offered iff all words complete; no references to the
  removed constant remain.

### Task 2 — Info "i" text
- **files:** `info-topics.ts`
- **action:** Replace the "quiz-direction" footnote with wording that says the
  direction is available only when **every** word has a term, definition, and example.
- **done:** text reflects the all-words rule.

### Task 3 — Update tests
- **files:** `quiz-capabilities.spec.ts`, `quiz-detail.spec.ts`
- **action:** Drop `EXAMPLE_DIRECTION_MIN_WORDS` usage; rewrite offering tests to the
  all-complete rule (mixed set → hidden; all-complete set → offered; MC/match still
  gated by their 4-word minimum on the complete set).
- **verify:** `npx nx test data-access` and `npx nx test feature-quiz` green.
- **done:** suites pass under the new rule.

## Verification

- `npx nx test data-access`
- `npx nx test feature-quiz`
