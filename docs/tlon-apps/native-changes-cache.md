# iOS background changes cache

The notification extension fetches `/changes` and accumulates it in the shared
App Group's `changes_cache.json`. Channel and DM entries are **post deltas**, not
channel snapshots: merge their maps by post ID, replacing whole posts and
preserving null post/channel deletion markers. Never recursively merge an
individual post's replies or metadata with an older version.

Each saved cache generation has a `cacheId`. Retrieval is non-destructive. RN
acknowledges that ID after applying the batch, or after finding its entire window
already covered by the persisted changes cursor. Parsing/database failures and
cursor gaps leave the batch available to retry. Legacy files without a cache ID
have a stable ID derived from their stored timestamps.

File reads, conditional writes, and acknowledgements use NSFileCoordinator plus
an in-process lock. A fetch runs outside the lock and may write only if its
starting generation is still current. A stale fetch cannot overwrite a newer
batch or recreate a consumed one; an acknowledgement for an older generation
cannot delete a new batch. A lost acknowledgement is safe to retry.

This protocol requires a new native build. New JS remains compatible with older
native payloads that lack `cacheId`, but those binaries retain the old native
merge and destructive-read behavior until upgraded.

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

## Regression checks

On macOS, `pnpm --filter tlon-mobile test-native-cache` compiles the production
Swift cache/model/error-event code into a standalone test executable. Only the
App Group configuration and network dependencies are stubbed; file coordination
and serialization use real Foundation APIs. Sandboxed runners need access to
macOS file coordination. No simulator or ship is needed.

`pnpm --filter tlon-mobile test-ui --runInBand backgroundCacheHandoff` checks RN
persistence/acknowledgement ordering, retries, cursor gaps, overlapping app-open
callbacks, acknowledgement failures, and older-native payload compatibility.
