# data-access

The app's **domain and persistence layer**: models, services (words, folders,
quizzes, progress, spaced repetition), and the storage abstraction.

- **Type:** `data-access` · **Depends on:** `util` only.
- Features talk to an abstract `StorageService`; `LocalStorageService` is the
  current implementation, swappable for a real API via a single DI provider.
- `persistedSignal` lives here: a signal wrapper with LocalStorage persistence,
  migrations, and cross-tab sync.

`npm test` runs this library's unit tests.
