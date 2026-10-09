# AGENTS.md — packages/shared (@tloncorp/shared)

Owns the client's model of the ship: Drizzle schema and queries (`src/db/`),
React Query wiring (`db/reactQuery.ts`, `store/dbHooks.ts`), sync and ingest
(`store/sync/`), user actions (`store/*Actions.ts`), pure logic (`src/logic/`),
and domain types and analytics events (`src/domain/`). Depends on
`@tloncorp/api` only. Inside, `utils` → `logic` → `db` → `store`.

**Read `docs/tlon-apps/db-react-query.md` before reasoning about whether a
component sees fresh data.** React Query runs with `staleTime: Infinity`;
nothing refetches with time, only through table-dependency invalidation.
Don't infer its behavior from React Query defaults. `invalidateQueries`
refetches only queries with active observers and doesn't clear cached data,
so a remounted query serves its previous value while it refetches.

## The data flow

Network data reaches the UI one way: ship → api → sync handler → SQLite →
table invalidation → hook refetch → render. Fetched data is written to the db
through sync and read back from the db. Data that belongs in the db is never
fetched on the fly in hooks or components. (Transient, display-only values
that no other screen reads, such as a storage quota or an OAuth status, may be
fetched directly with `useQuery`.) Keep logic in store and sync, not in leaf components or
`apps/*` wrappers. Writes go through a store action.

## Database

- Edit `db/schema.ts`, then run `pnpm generate:migration`, which regenerates
  `db/migrations/` from scratch. Never hand-write or hand-edit migration files.
  Tests build their db from that folder, so a stale migration breaks them.
- SQLite runs on SQLocal (web), op-sqlite (mobile) and better-sqlite3
  (desktop, tests); platform adapters live in `packages/app/lib/*Db.ts`.
- The db is a disposable cache of ship state: a failed migration purges it and
  resyncs. Anything that must survive a purge belongs on the ship, or in a
  `createStorageItem` (`db/keyValue.ts`).
- Wrap every query: `createReadQuery(label, fn, deps)` or
  `createWriteQuery(label, fn, effects)`. `fn` must declare its `ctx`
  parameter and must not use default parameters, because the argument count
  selects the calling convention (`db/query.ts`).
- Thread `ctx` through every nested db call, and `txCtx` inside
  `withTransactionCtx`. Transactions are serialized, so a nested write that
  opens its own context queues behind the one it's inside, and its effects
  miss the batch. Declare effects as a function when a write can be a no-op,
  so it doesn't invalidate.
- Fix bad data where it comes from: the backend's ingress, or the read query
  (make bad rows inert). Don't add client-side startup sweeps or band-aids.

## Hooks (`store/dbHooks.ts`)

- `queryKey: ['name', useKeyFromQueryDeps(db.q), ...args]`. The deps `Set`
  must sit at index 1; the invalidation predicate only looks there, and a key
  that puts it elsewhere never refreshes.
- Per-item hooks use flat `['post', id]` keys fed by `changeListener`, not
  table deps.

## Sync (`store/sync/`)

- Subscription handlers are wrapped with `createHandler`/`createBatchHandler`
  (`store/bufferedSubscription.ts`): events are debounced and applied in one
  batch. Handlers must be idempotent, tolerate duplicates and reordering, and
  write through the `ctx` they receive. There is no ordering guarantee across
  different subscriptions or between a request's response and a fact.
- Fetches go through `syncQueue.add(label, ctx, fn)` with a `SyncPriority`.
- The client subscribes to firehoses and filters locally; don't add
  per-entity subscriptions. New startup data rides in the init payload.
- A sync whose scry was issued before a local poke can overwrite the
  optimistic row. Actions that care re-assert after success
  (`reorderPinnedItems`).

## Actions (`store/*Actions.ts`)

- Snapshot the row, write optimistically, call the api, and on failure
  restore the snapshot and report the error. Every optimistic write needs a
  rollback path. Skip the poke when the value is unchanged: a tracked poke
  waits for an update that never arrives, times out, and rolls back a correct
  write.
- Post sends go through `postActions` and `SessionActionQueue` with
  `deliveryStatus` transitions; don't write posts directly.
- Report failures with `logger.trackError`, once, after retries are
  exhausted. New user-facing flows ship with lifecycle telemetry (start,
  success, failure with error info, duration).

Tests: vitest with real better-sqlite3 (`setupDatabaseTestSuite`,
`setScryOutput`). Keep mocks and fixtures out of production modules.

## Code Review Rules

Flag:

- A query key whose deps `Set` is not at index 1.
- A db write that doesn't pass the `ctx` it was given, or a wrapped query
  function with a default parameter or no `ctx` parameter.
- An optimistic write without a rollback, or a tracked poke sent when nothing
  changed.
- A hand-written or hand-edited migration file.
- Data other screens read (posts, channels, groups, contacts, settings)
  fetched outside sync and never persisted.
- A subscription handler that assumes ordering relative to another
  subscription or a request.

Do not flag:

- "Stale data" without naming the missing invalidation: the read declares
  table deps and writes declare effects; check both before claiming a reader
  won't refresh.
- React Query defaults (`staleTime`, refetch on focus, cache time); they don't
  apply here.
- A large regenerated `0000_*` migration diff that matches a schema change.
- A squashed migration set paired with a `NATIVE_CACHE_GENERATION` bump
  (`packages/app/lib/nativeCacheGeneration.ts`): the db is rebuilt from the
  ship. Flag a squash only when that bump is missing.
