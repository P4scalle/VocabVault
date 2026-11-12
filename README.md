# VocaVault

[![CI](https://github.com/P4scalle/VocabVault/actions/workflows/ci.yml/badge.svg)](https://github.com/P4scalle/VocabVault/actions/workflows/ci.yml)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031)](https://angular.dev)
[![Nx](https://img.shields.io/badge/Nx-monorepo-143055)](https://nx.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A mobile-first vocabulary trainer. Add a word you just discovered, look up its
definition, and practise it through four quiz modes until you've mastered it —
the loop from *"I found a new word"* to *"I know this word"* is meant to be fast
and satisfying.

> **Live demo:** _add your Vercel URL here_

---

## Features

- **Personal dictionary** — add words manually or auto-fill definitions from a
  dictionary API, organise them into colour-coded folders.
- **Four quiz modes** — Flashcard, Multiple Choice, Write, and Match, each with
  its own scoring and feedback.
- **Spaced repetition** — words resurface for review on an interval that adapts
  to how well you know them.
- **Progress tracking** — mastery scores, streaks, and a per-letter breakdown of
  your dictionary.
- **Bulk import** — paste a list or drop a CSV / Word document to add many words
  at once.
- **Offline-first** — everything persists to the browser, with cross-tab sync,
  so it works without an account or a backend.
- **Accessible & responsive** — keyboard-navigable, screen-reader friendly, dark
  mode, and tuned for phones first.

## Tech stack

| Area | Choice | Why |
|------|--------|-----|
| Framework | **Angular 21** | Signals, `@if`/`@for`/`@defer` control flow, standalone components |
| State | **Signals** (no RxJS stores) | Simple, synchronous, debuggable reactivity |
| Monorepo | **Nx** | Enforced library boundaries keep features decoupled |
| UI | **PrimeNG + Tailwind CSS** | Prebuilt primitives, utility-first styling |
| Persistence | **LocalStorage** behind a `StorageService` | Swappable for a real API without touching features |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Fast unit runs, real-browser user journeys |
| Hosting / monitoring | **Vercel + Sentry** | Zero-config deploys, production error tracking |

## Architecture

An Nx monorepo split into typed libraries with **enforced dependency rules**
(checked by ESLint on every commit), so a feature can never secretly reach into
another feature:

```
apps/vocavault            ← thin shell: bootstrap + routes (lazy-loaded)
│
libs/vocavault/
├── feature-shell         ← app layout, navigation
├── feature-home          ← dashboard
├── feature-dictionary    ← word & folder management
├── feature-quiz          ← the four quiz modes
├── feature-progress      ← stats & mastery
├── ui                    ← reusable presentational components
├── data-access           ← services, models, persistence (the StorageService seam)
└── util                  ← framework-agnostic helpers
```

**Allowed dependencies:** `app → feature → data-access · ui · util`, and
`ui · data-access → util`. Features depend on each other only through routing,
never by import.

A couple of patterns I'm happy with:

- **`persistedSignal`** — a small factory that wraps a signal with LocalStorage
  persistence, schema migrations, and cross-tab `StorageEvent` sync. Written
  once in `data-access`, reused everywhere state needs to survive a refresh.
- **`StorageService` abstraction** — features talk to an abstract service;
  `LocalStorageService` is wired in via DI. Swapping to a REST backend later is a
  one-line provider change, no feature code touched.

## Getting started

```sh
# Node 20+ (see .nvmrc)
npm ci --legacy-peer-deps

npm start           # dev server at http://localhost:4200
npm test            # unit tests (Vitest)
npm run e2e         # end-to-end tests (Playwright)
npm run lint        # lint all projects
npm run build       # production build
npm run verify      # lint + test + build (the full gate)
```

## Testing

- **~65 unit specs** across the libraries — not smoke tests; they assert the
  spaced-repetition maths, quota-exceeded handling, persistence, and component
  behaviour.
- **Playwright e2e** covering real journeys (add words → build a quiz set →
  play it → check results).
- **CI** (`.github/workflows/ci.yml`) runs lint + unit + a production build and
  the e2e suite against that build on every push.

## A note on AI assistance

This project was built with use of AI pair-programming tools. The architecture,
Angular patterns, trade-offs, and technical decisions are my own — the AI was a
faster way to type them out and a sounding board, not the author of the design.

## License

[MIT](./LICENSE) © Pascalle Schmitz
