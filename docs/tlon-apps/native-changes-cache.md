# iOS background changes cache

The notification extension fetches `/changes` and accumulates it in the shared
App Group's `changes_cache.json`. Channel and DM entries are **post deltas**, not
channel snapshots: merge their maps by post ID, replacing whole posts and
preserving null post/channel deletion markers. Never recursively merge an
individual post's replies or metadata with an older version.

Each saved cache generation has a `cacheId`. Retrieval is non-destructive. RN
acknowledges that ID after applying the batch, or after finding its entire window
already covered by the persisted changes cursor. Database failures and cursor
gaps leave the batch available to retry. Deterministic parsing failures and
invalid windows discard only the matching generation without advancing the DB
cursor, so ordinary sync can fetch the data again. Native decoding failures
remove the corrupt file under the coordination lock; I/O errors retain it.
Legacy files without a cache ID have a stable ID derived from their timestamps.

File reads, conditional writes, and acknowledgements use NSFileCoordinator plus
an in-process lock. A fetch runs outside the lock and may write only if its
starting generation is still current. A stale fetch cannot overwrite a newer
batch or recreate a consumed one; an acknowledgement for an older generation
cannot delete a new batch. A lost acknowledgement is safe to retry.
An acknowledgement/write conflict cancels the stale fetch with an informational
log; it does not report a notification sync error or retry the old payload
against a newer cache ID.

This protocol requires a new native build. New JS remains compatible with older
native payloads that lack `cacheId`, but those binaries retain the old native
merge and destructive-read behavior until upgraded.

## Recovery for existing installations

`NATIVE_CACHE_GENERATION` in `packages/app/lib/nativeCacheGeneration.ts` versions
the local iOS and Android databases independently of the database schema. Bump
this number to rebuild both platforms' caches once on their next foreground
initialization. Background heartbeats skip sync while recovery is pending or
the generation marker cannot be read.
Generation 1 starts both platforms fresh and repairs iOS caches that may have
missed changes before the native merge fix. Web is unaffected.

On iOS, recovery requires the fixed native binary; an OTA on an older binary
does not consume the recovery marker. Android has no dependency on the iOS
background-cache bridge and can apply a generation bump through an OTA update.

Before exposing the database, initialization runs the existing SQLite
purge/rebuild path. On iOS it first awaits clearing the native changes batch and
extension cursor. A positively empty SQLite schema skips the delete/reopen and
is reported as a fresh database, while still clearing any leftover sync state.
The recovery path resets persisted sync cursors and initial-sync flags, so normal ship
sync repopulates the cache. Authentication remains intact. The one-time purge
also discards local-only pending posts and upload drafts and requires a fresh
download of cached data.

The persistent generation marker is written only after migrations and database
health checks succeed. Purge, cursor-reset, and migration failures remain
blocking and retryable. Marker read/write failures are logged but do not block
a healthy database: initialization skips further generation work in that process
and retries on the next launch. A failed marker write can therefore cause an
extra rebuild on that next launch. Concurrent initialization shares one operation.
The marker survives logout and represents a rebuilt database, not a completed
ship sync.

## Telemetry

- `Notification Service Error` with `message = Background changes sync failed`
  records extension sync/cache failures with the notification UID and underlying
  error. It uses the existing notification logger and offline fallback.
- `Synced cached changes` retains window/count/timing fields and adds `cacheId`
  and `acknowledged`: true means that exact generation was removed, false means
  it was no longer current, and null means no acknowledgement was attempted or
  it failed. An acknowledgement error also emits an app error.
- A successful notification-delivery event does not imply successful background
  sync. Counts describe the final batch; there is no per-parent payload history.
- `NativeDbDebug` includes `cache generation: rebuilding local database` and
  `cache generation: database ready`, with the cache generation number. Fresh
  databases use `cache generation: initializing fresh database`; marker failures
  use `cache generation: marker storage failed` with the operation and error.
- `Discarded invalid cached changes` reports the batch ID and whether that
  generation was removed. It does not indicate that changes were persisted.

## Regression checks

On macOS, `pnpm --filter tlon-mobile test-native-cache` compiles the production
Swift cache/model/error-event code into a standalone test executable. Only the
App Group configuration and network dependencies are stubbed; file coordination
and serialization use real Foundation APIs. Sandboxed runners need access to
macOS file coordination. No simulator or ship is needed.

`pnpm --filter tlon-mobile test-ui --runInBand backgroundCacheHandoff backgroundSync` checks RN
persistence/acknowledgement ordering, retries, cursor gaps, overlapping app-open
callbacks, acknowledgement failures, invalid batches, background recovery
deferral, and older-native payload compatibility.

`pnpm --filter @tloncorp/app exec vitest run lib/nativeDb.test.ts lib/nativeCacheGeneration.test.ts`
checks one-time recovery, reset ordering, marker storage failures, fresh database
initialization, background deferral, retries and abandonment, and platform/native-version gating.
