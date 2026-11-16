---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 16-03-PLAN.md
last_updated: "2026-05-20T13:42:20.059Z"
last_activity: 2026-05-20
progress:
  total_phases: 16
  completed_phases: 14
  total_plans: 45
  completed_plans: 43
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Fast loop from "I found a new word" to "I know this word"
**Current focus:** Phase 15 — structured-definition-display

## Current Position

Phase: 16
Plan: Not started
Status: Executing Phase 15
Last activity: 2026-11-09 - Completed quick task 261109-utp: extracted shared ScoreRing component; quiz accuracy circle now matches home eloquence ring (sizing + arrival animation), home observer plumbing removed, 290 tests + lint green

Progress: [=========~] 95%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P02 | 15 | 2 tasks | 13 files |
| Phase 01-foundation P01 | 6 | 2 tasks | 18 files |
| Phase 01-foundation P03 | 6 | 2 tasks | 9 files |
| Phase 02-dictionary-quiz P01 | 4 | 2 tasks | 6 files |
| Phase 02-dictionary-quiz P02 | 5 | 2 tasks | 11 files |
| Phase 02-dictionary-quiz P05 | 10 | 2 tasks | 8 files |
| Phase 02-dictionary-quiz P06 | 4 | 2 tasks | 8 files |
| Phase 02-dictionary-quiz P07 | 4 | 2 tasks | 5 files |
| Phase 03-progress-home P01 | 8 | 2 tasks | 3 files |
| Phase 03-progress-home P02 | 6 | 2 tasks | 3 files |
| Phase 04-dictionary-api P01 | 16 | 2 tasks | 7 files |
| Phase 05-spaced-repetition P01 | 15 | 2 tasks | 6 files |
| Phase 06-visual-polish P01 | 11 | 2 tasks | 10 files |
| Phase 05-spaced-repetition P02 | 14 | 2 tasks | 11 files |
| Phase 06-visual-polish P02 | 4 | 2 tasks | 9 files |
| Phase 07-bulk-word-insert P03 | 25 | 2 tasks | 16 files |
| Phase 08-bulk-word-import-v2 P01 | 6 | 2 tasks | 8 files |
| Phase 08-bulk-word-import-v2 P02 | 12 | 2 tasks | 9 files |
| Phase 08 P03 | 18 | 2 tasks | 6 files |
| Phase 08-bulk-word-import-v2 P04 | 7 | 2 tasks | 5 files |
| Phase 10 P06 | 3 | 2 tasks | 4 files |
| Phase 11 P01 | 5 | 6 tasks | 4 files |
| Phase 09 P01 | 5 | 4 tasks | 6 files |
| Phase 09 P02 | 3 | 2 tasks | 2 files |
| Phase 12-definition-quality-validation P02 | 102 | 1 tasks | 4 files |
| Phase 12-definition-quality-validation P01 | 4 | 2 tasks | 7 files |
| Phase 12-definition-quality-validation P03 | 7 | 1 tasks | 3 files |
| Phase 13-quiz-direction-system P01 | 10 | 2 tasks | 21 files |
| Phase 13-quiz-direction-system P03 | 2 | 1 tasks | 2 files |
| Phase 14 P01 | 198 | 4 tasks | 3 files |
| Phase 16 P03 | 16 | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Signals over Observables — no RxJS in components or services; data-access layer must be converted from broken Component to proper services
- LocalStorage first — StorageService abstraction required so API swap is a one-file change later
- PrimeNG unstyled mode — all styling via Tailwind; no PrimeNG default theme classes expected
- [Phase 01-foundation]: Tailwind-only responsive nav — three nav elements in DOM with md:hidden/md:flex/lg:flex controlling visibility, no JS breakpoint detection
- [Phase 01-foundation]: AdaptiveNav pattern: single component, three hidden/visible nav variants per breakpoint — content area uses md:pl-24 lg:pl-60 offsets
- [Phase 01-foundation]: StorageService uses abstract class (not interface) to support Angular DI token injection; ProgressService.eloquenceScore weights: New=0, Learning=33, Review=66, Mastered=100
- [Phase 01-foundation]: Local MockWord interface pattern — UI-first development decoupled from data-access, Phase 2 one-line swap to inject(WordService)
- [Phase 01-foundation]: WordForm uses PageHeader with showBack=true for cancel navigation — consistent UX across all feature forms
- [Phase 02-dictionary-quiz]: Use vi.spyOn on real Router (provideRouter) for shell tests — mock Router object causes NG0201 ActivatedRoute error from RouterLink
- [Phase 02-dictionary-quiz]: Re-export Word as MockWord type alias from word-card.ts to preserve backward-compat while migrating to real Word type from data-access
- [Phase 02-dictionary-quiz]: Quiz child routes :id/:id/play/:id/results use FeatureQuiz as stub — dedicated components in later plans
- [Phase 02-dictionary-quiz]: QuizSetForm uses ngOnInit with editQuizSet input and computed isEditMode — consistent with WordForm pattern
- [Phase 02-dictionary-quiz]: router exposed as protected on TypeQuiz to enable Object.defineProperty override in tests for navigation assertions
- [Phase 02-dictionary-quiz]: QuizPlayRouter created in Plan 05 (parallel execution) with stub components for Plans 03/04/06
- [Phase 02-dictionary-quiz]: MatchQuiz uses vi.useFakeTimers() instead of fakeAsync — zone-testing.js not available in Vitest analogjs setup
- [Phase 02-dictionary-quiz]: window.history.state used for quiz result data — no query param pollution, preserved by Angular SPA router
- [Phase 02-dictionary-quiz]: MASTERY_PROGRESSION/REGRESSION as exported const lookup tables — O(1) mastery transitions, testable
- [Phase 02-dictionary-quiz]: /quiz route uses children structure for /quiz (list) and /quiz/:id/results nested routes
- [Phase 03-progress-home]: FeatureProgress delegates to ProgressService computed signals, NgClass for Tailwind JIT mastery dots, writable signal mocks for test isolation
- [Phase 03-progress-home]: NgClass used for dynamic Tailwind color classes on quiz cards and mastery bars — JIT scans TS source, full class strings in quizTypes array sufficient
- [Phase 03-progress-home]: quizTypes is readonly array not computed signal — static data needs no reactivity
- [Phase 05-spaced-repetition]: SM-2 uses fixed initial intervals [1,3,7,14,30] then interval*easeFactor for mature words
- [Phase 05-spaced-repetition]: Migration uses nullish coalescing to detect missing SR fields and applies defaults in constructor
- [Phase 05-spaced-repetition]: Constructor persists migration immediately so it runs only once per user
- [Phase 04-dictionary-api]: firstValueFrom to convert HttpClient Observable to Promise -- KISS, no subscription management
- [Phase 04-dictionary-api]: Collect up to 3 examples across all meanings for auto-fill
- [Phase 04-dictionary-api]: CSS keyframe animation for highlight fade rather than JS-driven opacity
- [Phase 06-visual-polish]: CSS-first animations via Tailwind keyframes, kept existing fadeIn/slideUp keyframes for backward compat
- [Phase 05-spaced-repetition]: Temp quiz set uses in-memory _tempQuizSet field for smart review, not persisted to localStorage
- [Phase 05-spaced-repetition]: Review status uses getter (not computed signal) for simplicity with OnPush
- [Phase 06-visual-polish]: animationend event resets animation signals for re-triggerable micro-interactions
- [Phase 07-bulk-word-insert]: mammoth loaded via require() with try/catch fallback for browser vs Node build path
- [Phase 07-bulk-word-insert]: BulkImportService holds _xlsxRawData for applyColumnMap re-processing without re-reading file
- [Phase 07-bulk-word-insert]: addWords() batch method uses single _store.update() call for atomic localStorage write
- [Phase 07-bulk-word-insert]: BulkAddView uses two-step BulkStep ('input'|'preview') — preview IS the confirm step, no separate confirm needed
- [Phase 07-bulk-word-insert]: Dynamic import() for mammoth replaces CommonJS require() — ESM build compatibility in strict Angular build
- [Phase 07-bulk-word-insert]: @types/papaparse added to tsconfig.lib.json types array — papaparse types blocked by empty types: [] array
- [Phase 08-bulk-word-import-v2]: BulkImportService v2 drops xlsxHeaders/xlsxPreviewRows — XLSX uses first two columns directly (simpler, no column mapping UI)
- [Phase 08-bulk-word-import-v2]: wordsOnlyMode signal toggles missing-def rows to ok status — words without definitions are imported as incomplete
- [Phase 08-bulk-word-import-v2]: BulkAdd added to feature-dictionary imports[] despite RESEARCH Pitfall 2 — Angular compiler requires it; @defer still lazy-loads as separate 22.9kB chunk
- [Phase 08]: BulkPreview uses PrimeIcons (pi pi-search, pi-spin pi-spinner) instead of lucideIcon — CLAUDE.md icon system override; matches existing bulk-input pattern
- [Phase 08]: collapse-on-expand via expandedRowId signal — CDK virtual scroll constraint; only one expanded row at a time
- [Phase 08-bulk-word-import-v2]: PrimeIcons used throughout bulk-add success state and filter chip — lucideIcon directives replaced per CLAUDE.md mandate
- [Phase 08-bulk-word-import-v2]: Undo toast label is Undo new to clarify only newly added words are undoable — merged words cannot be reverted without storing old values
- [Phase 10]: vi.clearAllMocks over vi.restoreAllMocks for module-level vi.mock preservation
- [Phase 11]: CSS Grid 0fr->1fr for collapsible animation instead of @angular/animations (deprecated)
- [Phase 11]: expandedFolderIds Set<string> signal for multi-folder expand (not exclusive accordion)
- [Phase 11]: groupedWordsByFolder pre-computed Map replaces per-selection groupedFolderWords
- [Phase 09]: Cast FOLDER_COLORS as readonly string[] for includes() compat with as-const tuple
- [Phase 09]: Create-on-confirm flow: inline FolderForm replaces instant-create zombie folder pattern
- [Phase 09]: Add words stays visible as primary action; Edit/Delete behind overflow menu
- [Phase 09]: 0-word empty state guides to add words; has-words state shows count and create CTA
- [Phase 12-definition-quality-validation]: DefinitionMeaning interface defined inline in DefinitionPicker (Plan 01 parallel wave); deduplicate with import once Plan 01 exports it
- [Phase 12-definition-quality-validation]: isPlaceholderDefinition uses exact-match blocklist (not substring) to avoid false positives on valid definitions containing blocklist words as substrings
- [Phase 12-definition-quality-validation]: allMeanings assembled after mergeResults to avoid touching existing merge logic; sourceIndex tracked per DefinitionMeaning for pronunciation attribution
- [Phase 12-definition-quality-validation]: UI module boundary preserved for DefinitionMeaning: type defined independently in definition-picker.ts and dictionary-api.service.ts, structural typing handles compatibility
- [Phase 13-quiz-direction-system]: withComponentInputBinding enables input() for all route params globally
- [Phase 13-quiz-direction-system]: Direction input on child quiz components with DEFAULT_QUIZ_DIRECTION default for backward compat
- [Phase 13-quiz-direction-system]: Match quiz mixed mode resolves to ONE direction per round via resolveDirection (can't mix within a grid)
- [Phase 14]: SR_NEW_WORDS_PER_DAY=20 hardcoded constant (Anki default), no settings UI
- [Phase 14]: Option A UX: home tile shows only actionable due count, no queued/backlog number
- [Phase 14]: Budget tracked via existing fields (reviewCount===1 + lastReviewedAt today), no new persistence
- [Phase 16]: Flag badge uses amber color scheme matching Needs attention badge for visual consistency
- [Phase 16]: Playable count filters out incomplete words from quiz set card display

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 1]: data-access library is currently a Component, not a service — must be fixed before any feature work can start
- [Pre-Phase 1]: UI component stubs (BottomNav, PageHeader, ResponsiveDrawer) are empty directories — need implementation or removal in Phase 1
- [Pre-Phase 1]: Jest + Vitest coexistence — choose Vitest as canonical runner during Phase 1 setup

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260507-di4 | Redesign desktop navigation from left sidebar to top horizontal navbar | 2026-05-07 | b7a678e | [260507-di4-redesign-desktop-navigation-from-left-si](./quick/260507-di4-redesign-desktop-navigation-from-left-si/) |
| 260507-exp | Fix component reusability - use shared EmptyState, extract QuizProgressBar, CircularProgress, create util lib | 2026-05-07 | d657724 | [260507-exp-fix-component-reusability-use-shared-emp](./quick/260507-exp-fix-component-reusability-use-shared-emp/) |
| 260507-h2u | Build alphabet scroller for Dictionary page | 2026-05-07 | a933b84 | [260507-h2u-build-alphabet-scroller-for-dictionary-p](./quick/260507-h2u-build-alphabet-scroller-for-dictionary-p/) |
| 260511-rrd | Improve alphabet scroller UX best practices | 2026-05-11 | 39367ea | [260511-rrd-improve-alphabet-scroller-ux-best-practi](./quick/260511-rrd-improve-alphabet-scroller-ux-best-practi/) |
| 260515-o6j | Fix 12 killer bugs in bulk import (cache, parse errors, duplicates, timeout) | 2026-05-15 | eb9ac78, 04edf82 | [260515-o6j-fix-14-killer-bugs-in-bulk-import-for-bu](./quick/260515-o6j-fix-14-killer-bugs-in-bulk-import-for-bu/) |
| 260515-t2h | Improve empty folder UX in dictionary feature (contextual state + renamed button) | 2026-05-15 | 0a65756 | [260515-t2h-improve-empty-folder-ux-in-dictionary-fe](./quick/260515-t2h-improve-empty-folder-ux-in-dictionary-fe/) |
| 260515-tbc | Move folder selection toolbar to floating bottom bar (slide-up, folder-assign two-row, aria-live, toast) | 2026-05-15 | 276dd0f, bda1af4 | [260515-tbc-move-folder-selection-toolbar-to-floatin](./quick/260515-tbc-move-folder-selection-toolbar-to-floatin/) |
| 260515-tn6 | Replace folder word assignment with modal picker (FolderWordPicker, removes pendingFolderAssign flow) | 2026-05-15 | 7858f7f, 6c8ef48 | [260515-tn6-replace-folder-word-assignment-with-moda](./quick/260515-tn6-replace-folder-word-assignment-with-moda/) |
| 260516-m94 | Fix bulk input stepper UX (textarea restore bug + 7 UX improvements) | 2026-05-16 | 67a5067, 004fdb1 | [260516-m94-fix-bulk-input-stepper-ux-textarea-resto](./quick/260516-m94-fix-bulk-input-stepper-ux-textarea-resto/) |
| 260517-r0g | Rate-limit resilient bulk lookup with fallback API and auto-retry | 2026-05-17 | d14fea8, d594513, a3e07fb | [260517-r0g-rate-limit-resilient-bulk-lookup-fallbac](./quick/260517-r0g-rate-limit-resilient-bulk-lookup-fallbac/) |
| 260517-u6c | UX error feedback: storage warning, orphan quiz words, bulk lookup error | 2026-05-17 | d47f8ca, a897940, 69e8137 | [260517-u6c-ux-error-feedback-for-storage-orphan-qui](./quick/260517-u6c-ux-error-feedback-for-storage-orphan-qui/) |
| 260519-jja | Fix examples (and all fields) persisting between term additions in add mode | 2026-05-19 | 4a64e84, 39fbc7d, 9b0d2ab | [260519-jja-fix-examples-persisting-between-term-add](./quick/260519-jja-fix-examples-persisting-between-term-add/) |
| 260519-api | Refactor data-access: dual-API merge, multi-definition, cache, _writable fix, bulkMode | 2026-05-19 | pending | [260519-api-refactor-data-access-optimise](./quick/260519-api-refactor-data-access-optimise/) |
| 260519-qz0 | Fix bulk import @defer pattern (prefetch on idle) and add loading skeleton | 2026-05-19 | 4df9349 | [260519-qz0-fix-bulk-import-defer-pattern-and-add-lo](./quick/260519-qz0-fix-bulk-import-defer-pattern-and-add-lo/) |
| 260519-uh7 | DRY info drawer refactor: InfoContent component + info-topics.ts, replace 270 lines of duplicated drawer HTML | 2026-05-19 | 1ce907d, 76454d0 | [260519-uh7-dry-info-drawer-refactor](./quick/260519-uh7-dry-info-drawer-refactor/) |
| 260519-tj4 | Fix MASTERY_REGRESSION floor (Learning not New) and add strugglingWords computed signal | 2026-05-19 | 287a34f, ff9eadc | [260519-tj4-fix-mastery-regression-floor-and-add-str](./quick/260519-tj4-fix-mastery-regression-floor-and-add-str/) |
| 260519-tu3 | Wire up Practice Struggling Words CTA on home page and quiz list page | 2026-05-19 | 7171454, c528fd1 | [260519-tu3-wire-up-practice-struggling-words-option](./quick/260519-tu3-wire-up-practice-struggling-words-option/) |
| 260519-uq9 | Extract ColorPicker to @vocavault/ui, add color to QuizSet, search/sort/filter on quiz list | 2026-05-19 | 329ecba, 46f4c90, b33da9b | [260519-uq9-extract-colorpicker-to-ui-lib-add-color-](./quick/260519-uq9-extract-colorpicker-to-ui-lib-add-color-/) |
| 260519-weo | Create InfoDrawer wrapper component, refactor all 4 features to use it | 2026-05-19 | b8d0d53, 8a78838 | [260519-weo-create-infodrawer-wrapper-component-refa](./quick/260519-weo-create-infodrawer-wrapper-component-refa/) |
| 260520-j3v | Swipe-down-to-dismiss on BottomSheet with bidirectional SwipeableDirective | 2026-05-20 | 77aca08, c9e774d | [260520-j3v-swipe-down-to-dismiss-on-bottomsheet](./quick/260520-j3v-swipe-down-to-dismiss-on-bottomsheet/) |
| 261102-pcf | Humanize AI-written code across libs/ and apps/ (strip label banners, restate-the-code JSDoc, narration comments) | 2026-11-02 | 3de8f79, 710c0cd, c1f21d8, e6680ef | [261102-pcf-humanize-ai-written-code-across-vocavaul](./quick/261102-pcf-humanize-ai-written-code-across-vocavaul/) |
| 261103-g1j | A11y focus-trap hardening: CDK cdkTrapFocus on 6 modal dialogs + overflow menu downgraded to plain button popover (6 High audit findings) | 2026-11-03 | e1aa48b, 449b435, 04deea1 | [261103-g1j-a11y-focus-trap-hardening-fix-focus-mana](./quick/261103-g1j-a11y-focus-trap-hardening-fix-focus-mana/) |
| 261106-l28 | Pin xlsx to SheetJS CDN 0.20.3 (CVE-2023-30533 proto-pollution + CVE-2024-22363 ReDoS) + cover previously-untested .xlsx parse path | 2026-11-06 | e609066 | [261106-l28-task-a-pin-xlsx-to-sheetjs-cdn-0-20-3-co](./quick/261106-l28-task-a-pin-xlsx-to-sheetjs-cdn-0-20-3-co/) |
| 261106-ovx | Bump nx 22.7.2 → 22.7.12 — ATTEMPTED, REVERTED (6bceb34). Patch bump cleared 5 dev-chain highs but the lockfile cascade pulled test-toolchain deps that broke ALL 9 unit-test projects (Angular NO_ERRORS_SCHEMA template-compile errors) on CI. Lesson: nx is the build/test toolchain — upgrade it via `nx migrate --run-migrations` + full install + local verify, NOT `--package-lock-only`. Deferred; not worth it for dev-only, zero-prod-exposure highs. | 2026-11-06 | 1b8dda5→6bceb34 | [261106-ovx-task-b-bump-nx-22-7-2-to-22-7-12-to-clea](./quick/261106-ovx-task-b-bump-nx-22-7-2-to-22-7-12-to-clea/) |
| 261106-qy5 | Fix vocavault APP vitest false-green: app config lacked `root:__dirname` so @nx/vitest ran 0 of its 9 specs and silently passed. Mirrored the proven lib pattern (root:__dirname + nxViteTsPaths + name/watch/reporters) + added `passWithNoTests:false` to ALL 9 configs (loud-fail guardrail). App now runs 9 tests; full suite 1280 across 9 projects, 0 fail. | 2026-11-06 | 6f296ae | [261106-qy5](./quick/261106-qy5/) |
| 261109-twu | Add plus/minus toggle to definition-picker: already-added definitions/examples show a filled-brand pi-minus (remove), not-added show hover-revealed pi-plus (add). Whole row is one `role=button` toggle (fixes nested-button a11y bug), added indicator always visible on all breakpoints, sheet stays open. Added `stringifyMeanings`/`removeMeaning` to parse-definition (single home for ` · ` format), idempotent append, example-remove floors to `['']`, and a real `quizMeaningIndex` clamp on save (edit mode) to prevent quiz desync after removing an earlier meaning. 97 new/updated specs incl. edge cases + 8 named regression guards; `npm run verify` green. | 2026-11-09 | a85e24c, d6a674c, 99d022f | [261109-twu-add-plus-minus-toggle-to-definition-pick](./quick/261109-twu-add-plus-minus-toggle-to-definition-pick/) |
| 261109-utp | Extract shared `ScoreRing` (`lib-score-ring`) into @vocavault/ui wrapping `lib-circular-progress` with a count-up number + self-contained threshold-0.3 IntersectionObserver (no trigger input — below-fold animates on scroll, top-of-page fires on mount). Migrated home eloquence score and quiz-results accuracy to it; quiz circle now matches home's 140/18px/text-5xl sizing and arrival animation. Removed home's inline observer/scoreVisible/animatedScore plumbing. 290 tests + lint green on ui/feature-home/feature-quiz. | 2026-11-09 | 21bd301, 323bd41, babcc83 | [261109-utp-extract-shared-scorering-component-and-u](./quick/261109-utp-extract-shared-scorering-component-and-u/) |
| 261116-dve | Add per-mode (i) info buttons to all four quiz-detail mode cards using activeInfoDrawer signal + lib-info-button sibling + lib-info-drawer pattern (feature-home idiom). Four new INFO_TOPICS entries (mode-flashcard/multiple-choice/type/match). Removed always-visible locked-modes-hint paragraph. 293 tests + AOT build green. | 2026-11-16 | d6aa3c6, 8b55321, 786b5be | [261116-dve-add-per-mode-info-buttons-to-quiz-choose](./quick/261116-dve-add-per-mode-info-buttons-to-quiz-choose/) |

## Session Continuity

Last session: 2026-11-16T10:05:00Z
Stopped at: Completed quick task 261116-dve: per-mode info buttons on quiz-detail mode cards, locked-modes-hint removed, 293 tests + AOT build green
Resume file: None
