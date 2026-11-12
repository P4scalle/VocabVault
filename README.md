# VocaVault

[![CI](https://github.com/P4scalle/VocabVault/actions/workflows/ci.yml/badge.svg)](https://github.com/P4scalle/VocabVault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A little mobile-first vocabulary trainer I built for myself. Add a word you'd like to add to your English vocabulary, pull up or insert its definition, and drill it through a few quiz modes until
it sticks.

> **Live demo:** [Link to VocaVault](https://vocavault-gamma.vercel.app/)

## What it does

- Add English words by hand or auto-fill definitions from a dictionary API, sorted into
  colour-coded folders.
- Four quiz modes: Flashcard, Multiple Choice, Write, and Match.
- Spaced repetition, so words come back for review based on how well you know them.
- Progress and mastery tracking.
- Bulk import from a pasted list or a CSV / Word document.

## Run it

```sh
npm ci --legacy-peer-deps
npm start    # http://localhost:4200
npm test     # unit tests
```

## Built with

Angular 21 (signals) in an Nx monorepo, PrimeNG + Tailwind, Vitest + Playwright,
deployed on Vercel. Made with use of AI pair-programming tools.

## License

[MIT](./LICENSE)
