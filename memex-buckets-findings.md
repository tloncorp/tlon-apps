# Memex Buckets — four findings from the first live run

All four came out of exercising the `%buckets` ↔ Memex path end-to-end against the **test cluster** (`memex.test.tlon.systems`, ship `~hatrel-disnut`) for the first time. None were visible from tests or code review alone.

**All line references are against `hm/buckets-pushed-read-tokens` (ylem#3260), not `main`** — findings 1 and 3 exist on both, findings 2 and 4 are introduced by the pushed-read-token work.

Ordered by what I'd do first. **Finding 1 is the only one that affects users at scale**; the rest are a correctness bug and two diagnosability bugs.

---

## 1. Signed URLs shell out to `gcloud` — 1.4 s per call, and a hard concurrency ceiling

**Where:** `pkg/api/memex/src/Memex/Buckets/Storage.hs:156-181`, reached from `signPut` (`:92`) and `signGet` (`:107`).

Every signed URL spawns a process:

```haskell
signUrl config objectKey method duration additional =
    runGcloud
        ( [ "storage", "sign-url", gcsPath config objectKey
          , "--impersonate-service-account", Text.unpack config.serviceAccount
          , "--region", Text.unpack config.region
          , "--http-verb", method
          , "--duration", show (...) <> "s" ] <> additional )

runGcloud arguments = do
    (exitCode, stdout, stderr) <-
        Process.readProcessWithExitCode "gcloud" arguments ""
```

**Measured:** the client-visible `POST /v2/buckets/objects/{id}/read-grant` takes **~1.4 s**, against ~100 ms to fetch the resulting GCS URL. Roughly:

| | cost |
|---|---|
| fork/exec + Python interpreter startup (gcloud is Python) | ~0.7–1.2 s |
| credential resolution + `generateAccessToken` for the impersonated SA | ~150–300 ms |
| IAM `signBlob` (no local key under Workload Identity) | ~30–80 ms |
| V4 canonicalization + signature itself | microseconds |

The cryptography is free. Essentially all of it is process startup.

### The capacity problem, which is the stronger argument

There is **no caching, no pooling, and no concurrency limit** around `runGcloud`, and it sits on *both* hot paths — `signPut` for every upload grant, `signGet` for every read. Each concurrent file operation is therefore its own Python process at roughly 100–200 MB RSS, in a pod capped at `memory: 2Gi` (per `deploy/charts/memex/values.yaml`).

That is on the order of **a dozen concurrent signings before memory pressure** — a cliff, not a gradual slowdown. One person opening a folder of images can approach it. This is a scaling limit hiding behind a latency complaint.

### Proposed fix

Replace the subprocess with native V4 signing. The canonical-request construction is pure computation; only the signature needs a remote call, because Workload Identity means there is no private key on disk:

1. Build the V4 canonical request and string-to-sign in Haskell.
2. Sign via IAM `signBlob` on `iamcredentials.googleapis.com`.
3. **Cache the impersonated access token** (`generateAccessToken` results last ~1 h) so steady state is one small POST per URL.

Expected: **~1.4 s → ~40–80 ms**, dominated by the single `signBlob` round trip, and the per-request memory cost drops to nothing.

**Do not** reach for GCS HMAC keys to get this to sub-millisecond. It would be faster (signing becomes local HMAC-SHA256) but introduces a long-lived secret to manage and store, which is a worse posture than Workload Identity. The 25× is worth having on its own.

### Verifying

Time `POST /v2/buckets/objects/{id}/read-grant` before and after. Separately, drive N concurrent read-grants and watch pod memory — the point is that it should stay flat rather than scaling with concurrency.

---

## 2. Downloads through a pushed-token read grant are all named `download`

**Where:** `pkg/api/memex/src/Memex/API/Buckets.hs:450`, flowing into `Storage.hs:208`.

The pushed-token read path hardcodes an empty display filename:

```haskell
-- One token covers the bucket, so it cannot name the file; the ship
-- supplied that when it was asked.
pure AuthorizedRead { host = held.host, bucketId = held.bucketId
                    , objectId, displayFilename = "" }
```

That reaches `sanitizeFilename` (`Storage.hs:201-208`), which ends:

```haskell
in if Text.null cleaned then "download" else cleaned
```

So `Content-Disposition` names **every** file `download`, with no extension.

**This is user-visible.** In tlon-apps, `onDownloadItem` calls `readUrl` and hands the signed URL to `Linking.openURL`, so the browser saves whatever `Content-Disposition` says. Not a security problem — the sanitizer is doing its job and there is no injection — just the wrong name on every download.

The comment is accurate about *why*: a bucket-wide token genuinely cannot name a file. But the old per-object flow got the name from the ship, and nothing replaced it.

### Why Memex can't fix this alone

`BucketObject` (`Types.hs:345`) has no filename column — `objectId`, `reservationId`, `ownerId`, `host`, `bucketId`, `objectKey`, `size`, `mimeType`, `checksum`, `creatorShip`, `scanState`, `deletedAt`, `physicalDeletedAt`, `createdAt`. The display name was only ever received transiently in the old verdict. It is not recoverable locally.

### Two options

**(a) Client supplies it — preferred.** Add an optional `displayFilename` to `ObjectAuthorizationRequest` (`Types.hs:189`) and use it in `readGrant` when present. The tlon-apps client already has the entry name from the manifest, so its side is a couple of lines. It is untrusted input, but `sanitizeFilename` already hardens it and the field only affects the caller's own `Content-Disposition`. No schema change.

**(b) Memex persists it at upload.** Carry the name through the upload verdict into `bucket_objects`. Authoritative and needs no client cooperation, but it is a migration plus changes on the upload path.

I would take (a). It needs a coordinated change on the tlon-apps side, which I can do once the field exists.

---

## 3. `liftPioneer` discards the Pioneer HTTP status

**Where:** `pkg/api/memex/src/Memex/API/Buckets.hs:850-866`, with `classifyStatus` at `Buckets/Pioneer.hs:157-164`.

```haskell
PioneerBadResponse{}      -> throwBucket PioneerUnavailable "Pioneer returned an invalid response" True
PioneerConnectionFailure{} -> throwBucket PioneerUnavailable "Pioneer is unavailable" True
```

`PioneerConnectionFailure` carries the real status — `Pioneer.hs:164` builds `"Pioneer returned HTTP " <> show status` — and the wildcard pattern throws it away. Nothing logs it: no `warn`, no `debug`, no `telemetry`.

Combined with `classifyStatus`, which maps **only** 401/403/408/410/429 to specific errors and folds everything else into `PioneerConnectionFailure`, this means:

- a **404** (route absent — permanent, needs a deploy) and
- a **500** (handler failed — possibly transient)

are indistinguishable, and both surface to the caller as `{"code":"pioneer_unavailable","retryable":true}`. A permanently missing route is reported as a retryable outage.

**Cost:** this is what made today's debugging long. Test-cluster ships were running a Pioneer image predating the `/v2/buckets/*` routes (added Aug 6 in `52934906f`), so every buckets call 404'd at the sidecar. The diagnosis had to be reconstructed by probing `/v1` and `/v2` routes against the same sidecar and comparing, because the one number that would have answered it immediately was dropped on the floor.

### Fix

Log the payload before mapping. One `warn` with the status is enough:

```haskell
PioneerConnectionFailure detail -> do
    warn "pioneer connection failure"
    telemetry [ metric "pioneer.detail" detail ]
    throwBucket PioneerUnavailable "Pioneer is unavailable" True
```

Worth considering separately: a 404 from Pioneer arguably should not be `retryable: true`, since retrying a missing route never helps.

---

## 4. An unreachable ship returns a bare 500, not the documented error shape

**Where:** `pkg/api/memex/src/Memex/TokenVerification.hs:94-102`, called from `verifyHost` (`API/Buckets.hs:334-338`).

`checkLandscapeToken` catches, logs, and then **rethrows**:

```haskell
( \(e :: SomeException) -> do
    warn "Exception encountered sending to ship"
    ...
    throw e )
```

`verifyHost` does not catch it, so it escapes as a plain `500 Internal Server Error` with an HTML/empty body — not the `{code, message, retryable}` contract every other failure honours.

**Reproduce:** `PUT /v2/buckets/tokens/~zod` against test with any token. `~zod` is not on the test fleet, so `zod-feds.internal.test.tlon.systems` does not resolve and the request 500s. A ship that *is* on the fleet returns a correct `403 capability_denied`.

**Why it matters beyond tidiness:** the Gall side reads `retryable` out of the body to decide whether to keep a reader sync owed or mark it permanently failed. A bodyless 500 has no `retryable` field. `%buckets` currently defaults to retryable when it cannot parse a body, so this happens to behave correctly — it retries, and the record's own expiry bounds it — but that is luck, not contract.

### Fix

Catch in `verifyHost` and map to a typed, retryable error:

```haskell
verifyHost ship landscapeToken =
    catch (do accepted <- checkLandscapeToken ship landscapeToken
              unless accepted $ throwBucket CapabilityDenied "..." False)
          (\(_ :: SomeException) ->
              throwBucket PioneerUnavailable "the ship could not be reached" True)
```

Keep it distinct from `capability_denied`: *"the ship said no"* and *"we could not ask the ship"* are different situations and only one is worth retrying.

---

## Suggested order

1. **Finding 3** — smallest change, and it makes everything else easier to diagnose. Do it first even though it is not the most valuable.
2. **Finding 1** — the only one with real user and capacity impact.
3. **Finding 4** — small, tightens a contract the Gall side already depends on.
4. **Finding 2** — cosmetic, and needs a matching tlon-apps change; fine to land after merge.

## Context

The Gall side (tloncorp/tlon-apps#6320) is complete and green, and reads the `retryable` flag and `currentRevision` exactly as the contract in ylem#3260 documents. The wire format was verified field-for-field against `SyncReadTokenRequest`, including sigil handling — `ship-text` in Hoon strips the leading `~` via `slag 1`, matching `toUrlPiece = Text.drop 1 . Ob.renderPatp`.

Nothing here blocks that PR. Findings 1 and 2 are worth having before Buckets is exposed to real users; 3 and 4 are worth having before anyone else has to debug this path.
