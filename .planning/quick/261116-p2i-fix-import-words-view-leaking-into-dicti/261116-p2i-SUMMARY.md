---
phase: quick-261116-p2i
plan: 01
subsystem: feature-dictionary
tags: [bug-fix, defer, angular, regression-tests]
dependency_graph:
  requires: []
  provides: [deterministic-import-view-unmount, import-view-regression-tests]
  affects: [feature-dictionary-template, feature-dictionary-spec]
tech_stack:
  added: []
  patterns: [angular-if-defer-nesting, defer-testing-happy-dom-workaround]
key_files:
  created: []
  modified:
    - libs/vocavault/feature-dictionary/src/lib/feature-dictionary/feature-dictionary.html
    - libs/vocavault/feature-dictionary/src/lib/feature-dictionary/feature-dictionary.spec.ts
decisions:
  - "@if outer gate owns mount/unmount; @defer (on immediate) handles code-split only — same as add/edit view pattern"
  - "In happy-dom + zoneless Vitest, @loading (minimum 150ms) timer never fires, so lib-bulk-add cannot be queried on first open; loading-skeleton selector used as import-section presence indicator with lib-bulk-add fallback for cached re-open"
  - "getImportSection() helper covers both @loading (first open) and @defer complete (cached re-open) states rather than asserting a single DOM element"
  - "BulkImportService mock extended to 8 members (rows/importableCount/restoreDraft/lastInputText/detectedDelimiter/wordsOnlyMode/mixedSeparators/detectedWordsOnly) as BulkAdd + BulkInput child component instantiate on re-open"
metrics:
  duration_minutes: 35
  completed_date: "2026-11-16"
  tasks: 2
  files_modified: 2
---

# Phase quick-261116-p2i Plan 01: Fix Import Words View Leaking Into Dictionary — Summary

**One-liner:** `@if (view() === 'import')` wrapper added to bulk-add `@defer` block, switching trigger from `when` to `on immediate` so Angular's structural teardown deterministically unmounts lib-bulk-add on all three exit paths; 5 regression tests added with happy-dom defer workaround.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wrap import @defer in @if and switch trigger to on immediate | f203e68 | feature-dictionary.html |
| 2 | Add regression tests for import view mount/unmount + fresh re-mount | a26bbd1 | feature-dictionary.spec.ts |

## What Was Done

### Task 1: Template Fix (f203e68)

The root cause was that `@defer (when view() === 'import')` is a one-way latch: once the condition becomes true, the defer renders permanently. Setting `view` back to `'list'` did not destroy the content.

Fixed by wrapping the entire `@defer` block in `@if (view() === 'import')`. The `@if` owns the mount/unmount lifecycle (same pattern as `@if (view() === 'add')` / `@if (view() === 'edit')` above it). The defer trigger changed from `when view() === 'import'` to `on immediate` (code-splitting only; `prefetch on idle` unchanged to keep the chunk warm). Inner `@loading` and `@error` markup preserved verbatim, re-indented one level.

The folder-word-picker `@defer` (~line 705) was not touched — it already has an inner `@if` handling teardown.

### Task 2: Regression Tests (a26bbd1)

Added 5 behavioral tests inside `describe('import view', ...)`:
- **Mount + back chevron**: import section appears on view='import', removed via onBulkCancel()
- **Import completion**: import section removed via onBulkImported()
- **onViewIncomplete**: import section removed via onViewIncomplete()
- **Mutual exclusivity**: list chrome (search input + empty-state) absent while import active
- **Fresh re-open**: different DOM node on second open confirms @if destroy+recreate

Extended `FeatureDictionaryInternals` with `onBulkCancel()` and `onBulkImported()` handler signatures. Added `BulkImportService` and `ToastService` mock providers.

Preserved existing `'should not show import view when view is list'` test unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] BulkImportService mock required 8 members, not 2**

- **Found during:** Task 2 — re-open test uniquely triggers BulkAdd + BulkInput instantiation (cached defer renders immediately on second open, bypassing @loading)
- **Issue:** Plan anticipated 2 mock members (rows, importableCount); BulkAdd constructor calls restoreDraft(), BulkInput uses lastInputText/detectedDelimiter/wordsOnlyMode/mixedSeparators/detectedWordsOnly
- **Fix:** Added restoreDraft/lastInputText/detectedDelimiter/wordsOnlyMode/mixedSeparators/detectedWordsOnly to mockBulkImportService (all as signal().asReadonly() or vi.fn())
- **Files modified:** feature-dictionary.spec.ts
- **Commit:** a26bbd1

**2. [Rule 2 - Missing Functionality] lib-bulk-add not queryable on first open due to @loading minimum 150ms**

- **Found during:** Task 2
- **Issue:** Plan assumed Playthrough would auto-resolve @defer; happy-dom + zoneless Vitest environment does not fire the @loading (minimum 150ms) timer, so lib-bulk-add cannot be queried via DOM. DeferBlockState.render(Complete) also cannot override the minimum time constraint.
- **Fix:** Changed test assertions from `lib-bulk-add` to `[aria-label="Loading import view"]` (loading skeleton, always present on first open). getImportSection() helper covers both states: loading skeleton (first open) OR lib-bulk-add (cached re-open). This correctly pins @if mount/unmount behavior which is the core regression guard.
- **Files modified:** feature-dictionary.spec.ts
- **Commit:** a26bbd1

## Verification Results

- `npx nx build vocavault` — SUCCESS, no template errors
- `npx nx test feature-dictionary` — 220/220 tests pass (9 test files)
- `git log --oneline -2` shows two atomic commits: f203e68 (template fix) + a26bbd1 (tests)
- WIP files (feature-shell/**, onboarding.service.ts) confirmed unstaged/untouched after both commits

## Known Stubs

None — all functionality fully wired.

## Self-Check: PASSED

- f203e68 exists in git log: FOUND
- a26bbd1 exists in git log: FOUND
- libs/vocavault/feature-dictionary/src/lib/feature-dictionary/feature-dictionary.html: contains `@if (view() === 'import')`
- libs/vocavault/feature-dictionary/src/lib/feature-dictionary/feature-dictionary.spec.ts: contains 220-test suite
