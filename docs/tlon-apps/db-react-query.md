# Local DB + React Query

How local SQLite reads reach the UI, and how they get refreshed. Read this before reasoning about whether a component sees fresh data — the caching semantics here are deliberately unusual, and guessing at them produces confident, wrong conclusions.

## The two layers

**Wrapped DB queries** (`packages/shared/src/db/query.ts`). Queries in `packages/shared/src/db/queries.ts` are wrapped in `createReadQuery` or `createWriteQuery`. The wrapper's third argument declares table metadata:

-   `createReadQuery(label, fn, tableDependencies)` — tables whose contents, when changed, make this read stale.
-   `createWriteQuery(label, fn, tableEffects)` — tables this write dirties. May be a function of the query's options, so a write that turns out to be a no-op can declare no effects — see `insertThreadUnreads`, whose effects are `(unreads) => (unreads.length ? ['threadUnreads', 'channelUnreads'] : [])`.

**React Query** (`packages/shared/src/db/reactQuery.ts`) is the cache and subscription layer. Hooks in `packages/shared/src/store/dbHooks.ts` wrap the DB queries in `useQuery`.

## The single most important config

```ts
new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
```

`staleTime: Infinity` is global. **Nothing in this app ever goes stale by the passage of time.** A cached query is fresh forever until something explicitly invalidates it. `gcTime` is left at React Query's 5-minute default, except for per-post queries (`PER_POST_GC_TIME_MS`, 30s).

So there are exactly two ways cached data gets refreshed, and both are explicit.

## Invalidation channel 1: table-level

In `withCtxOrDefault` (`db/query.ts`), a write's `tableEffects` accumulate into `pendingEffects`, and on the next tick:

```ts
queryClient.invalidateQueries({
    predicate: (query) => {
        const tableKey = query.queryKey[1];
        return tableKey instanceof Set && setsOverlap(tableKey, pendingEffects);
    },
});
```

**The `Set` of table dependencies must sit at `queryKey` index 1.** That is what `useKeyFromQueryDeps(db.someQuery)` returns, and the predicate only ever looks at position 1. A hook that puts its deps key anywhere else is silently excluded from table-level invalidation forever — it compiles, it reads correctly on first mount, and it never refreshes again.

```ts
// correct
const depsKey = useKeyFromQueryDeps(db.getThreadUnreadsByChannel);
useQuery({ queryKey: ['liveThreadUnreadsByChannel', depsKey, channelId], ... });
```

Known deviation: `usePostBySentAt` (`store/dbHooks.ts`) places `deps` last, so it is not reached by this channel. Don't copy it, and don't assume it's intentional.

## Invalidation channel 2: per-row post events

`packages/shared/src/db/changeListener.ts` handles row-level change events and invalidates the exact key `['post', id]`. Events reach it via `handleChange`, fed by `BaseDb.processChanges` draining the `change_log` table (`packages/app/lib/baseDb.ts`) or by the desktop update hook (`electronDb.ts`). `posts` rows are batched into a pending set and flushed by `flush()`, which `withCtxOrDefault` calls alongside the table-level pass; `post_reactions`, `thread_unreads`, and thread-scoped `volume_settings` invalidate their parent `['post', id]` immediately.

Because React Query's key matching is positional-prefix, `['post', id]` also matches `['post', id, 'reference']`. Per-post hooks therefore use a flat `['post', id]` key and opt out of channel 1 — this keeps large numbers of transient post queries out of the table-level predicate scan, and is why `usePostReference` deliberately shares the `['post', id]` prefix.

## What invalidation does and does not do

This is where reviews usually go wrong. `invalidateQueries` is narrower than it sounds:

| It does                                        | It does **not**                    |
| ---------------------------------------------- | ---------------------------------- |
| Set `isInvalidated` on matching queries        | Clear or reset `state.data`        |
| Refetch queries that have **active observers** | Refetch unmounted/inactive queries |

Three consequences worth internalizing:

1. **`refetchType` defaults to `'active'`.** Neither invalidation channel passes `refetchType`, so a query whose component is unmounted is only _flagged_ stale. Nothing refetches while it's off-screen.
2. **Cached data survives invalidation.** On remount, a stale query synchronously returns its previous cached value and refetches in the background. The first render after remount can legitimately show pre-invalidation data.
3. **Cached data also survives a failed refetch.** React Query's error reducer spreads `...state`, so `data` is preserved and `status` becomes `'error'`. A query that has succeeded once and then fails keeps serving the old value.

Point 2 is load-bearing, not a bug: with `staleTime: Infinity`, invalidation is the _only_ thing that makes a remounted query refetch at all. Without it, a cached value would be served forever.

## Reviewing this code

Common false positive: "this reads cached data that a background write made stale, so the UI is wrong." Usually it isn't — the write invalidated the query, and the remount refetches. The wrong value appears for one render against a local SQLite read. Say "brief" and rank it low; don't describe it as persistent.

Patterns that _are_ worth flagging:

-   **`initialData` with no `initialDataUpdatedAt`.** Under `staleTime: Infinity` the seeded value is treated as fresh forever, so once `gcTime` evicts the entry the next mount re-seeds from the placeholder and never refetches. If the seed is a partial row (a list row lacking joined relations), the missing fields are permanently absent. `initialDataUpdatedAt: 0` marks the seed as immediately stale and fixes it.
-   **Treating an empty result as authoritative.** A query with `excludeRead`-style filters returns nothing both for "genuinely none" and "not loaded yet." If a consumer overrides fallback data whenever the result is non-null, an empty cached result suppresses real state. Prefer returning explicit zero rows over filtering them out.
-   **A deps `Set` not at `queryKey[1]`** — see above. This one really is permanent.
-   **Table-level keys on high-cardinality queries.** Every write to a listed table re-runs the predicate over the whole cache and re-renders every subscriber. Per-post queries deliberately avoid this; new per-item hooks should too.

## Verifying claims about cache behavior

Read the source rather than recalling React Query semantics from memory — this repo pins `@tanstack/react-query` 5.32.1 and the defaults matter:

-   `node_modules/@tanstack/query-core/build/modern/queryClient.js` — `invalidateQueries` / `refetchType` resolution
-   `node_modules/@tanstack/query-core/build/modern/query.js` — the state reducer, including what `invalidate` and `error` actually change

At runtime, `window.__tlonInspectQueries({ group: 'tables' })` (exposed from `db/reactQuery.ts`) dumps cache entries grouped by dependency set, with observer/stale/fetching counts.
