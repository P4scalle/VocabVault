# Security

## Production exposure

**`npm audit --omit=dev` reports 0 vulnerabilities.** None of the advisories
flagged by `npm audit` reach the bundle shipped to users — they live entirely in
dev/build/test tooling (`devDependencies` and their transitive deps). The
production runtime depends only on Angular, RxJS, `@lucide/angular`,
`@sentry/angular`, `mammoth`, `papaparse`, `primeicons` and `xlsx`, none of which
pull a flagged package into the client bundle.

## What is patched

Patched transitive dev-only leaves are pinned via `overrides` in `package.json`
(single-major, non-breaking), clearing the axios cluster and the
`brace-expansion` / `form-data` / `follow-redirects` / `tmp` / `happy-dom` highs:

- `axios`, `follow-redirects`, `form-data`, `qs`, `yaml`, `smol-toml`,
  `node-forge`, `tmp` → latest patched versions.
- `brace-expansion` → scoped under `nx` only (`5.0.5` → `5.0.13`). A global
  override would force the unaffected `1.x` / `2.x` lines used elsewhere up a
  major and break their parents.
- `happy-dom` (the vitest DOM environment) → `21.0.4` (past the fixed `>21.0.3`).

Every change is verified against the full `npm run verify` gate
(lint + unit tests + production build) plus the Playwright e2e suite.

## Accepted residual (dev/CI only)

The remaining advisories are rooted in **Nx itself** (`nx`, `@nx/angular`,
`@nx/js`, `@nx/workspace`, and the `@nx/*` / `@angular-eslint` / `@typescript-eslint`
/ `@sentry/*` build-tooling ecosystem). They are **not fixed**, on purpose:

- **Zero user exposure.** These run only during local development and CI builds,
  never in the shipped app (`npm audit --omit=dev` = 0).
- **The fix breaks the toolchain.** Nx's own CVEs are fixed in `nx >= 22.7.10`,
  but bumping Nx drags `vite`, `vitest` and `@analogjs/*` forward, which breaks
  Angular standalone-component compilation in the vitest runner (`NG0304:
  'lib-*' is not a known element`). The project is pinned to `nx@22.7.2` with a
  known-good `vite` / `vitest` / `@analogjs` test stack.
- **Realistic severity is low.** The Nx advisories require local-attacker or
  malicious-git-input conditions on a developer/CI machine, not a remotely
  reachable surface.

These will be revisited when Nx ships a patch line compatible with the Analog
vitest toolchain (or the project migrates its test runner).
