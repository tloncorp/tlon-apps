# `%buckets`

`%buckets` is a third-party `%groups` channel host for group-owned file spaces. It owns the logical folder tree, file metadata, authorization, and upload lifecycle. It does not store or transport file bytes.

The channel nest is `buckets/~host/name`. The Bucket host is authoritative, while member ships keep subscribed replicas and expose those replicas to their local clients.

## Authority and storage boundary

-   `%groups` remains the authority for membership and channel visibility.
-   The Bucket host re-checks the affiliated group's live `can-read` gate for subscriptions, for every read token it mints, and again before installing one the broker has accepted.
-   Mutations require either group-admin authority or a group role in the Bucket's writer set. An empty writer set means every readable group member may write. Writer roles are independent from the reader roles stored by `%groups`.
-   Title changes, writer-role changes, and Bucket deletion require a live group-admin check.
-   Every permission read is a `.^` scry into `%groups`, which answers no-such-path for a group it does not hold -- and an unresolvable scry crashes the event. So each one first asks `+group-exists`, and treats a missing group as no access rather than dying. A bucket is only ever hosted by its group's host, so missing means deleted, not unsynced.
-   The acting principal is always `src.bowl`; commands cannot claim a different ship.
-   Gall persists only the manifest, bounded upload-session metadata, and opaque short-lived broker tokens. Object bytes, storage credentials, and signed URLs must not travel over Ames or enter Gall state.
-   Object keys are host-generated and independent of display names, so rename and move operations only change manifest metadata.
-   Reader roles are `%groups`' alone. They are handed to it with the channel at creation and are not retained here; `+group-can-read` asks it. Writer roles live here because `%groups` does not model them.

Hosted clients use the private Ylem/Memex broker path described below. There is no uploader-owned storage fallback and no client-generated capability: every bearer token is minted by the host.

## State

The protocol and persisted molds are in `desk/sur/buckets.hoon`.

Each Bucket contains:

-   Bucket metadata and affiliated group flag
-   File/folder entries keyed by stable numeric ID
-   The Bucket's writer-role set
-   A monotonically increasing manifest revision

Files transition from `%pending` to `%ready` or `%failed`. Upload sessions independently transition from `%pending` to `%complete` or `%failed`. An uploading file's entry is not in the manifest at all until its object lands -- it lives in the session -- so an in-flight upload is invisible to everyone but its uploader, and a folder deletion has to match sessions by their entry's parent as well as by id.

Alongside the buckets, the agent keeps host-private maps that never appear in snapshots or Ames updates: upload sessions, minted object capabilities, this ship's own read tokens, revocations the broker has not yet confirmed, broker-reservation bindings, and the in-flight and recently-settled client requests.

State is a single `%0`. It has never shipped, so there are no migrations; a mold change means adding `%1` and a `+state-0-to-1` arm rather than editing `%0` in place.

## Actions

Local clients poke `%buckets-action-1`, which accepts JSON and noun input. Every action carries a `request-id` and gets exactly one terminal answer; bearer tokens are returned only to the requester and never appear in a broadcast.

The outer type carries identity, the inner one carries only the verb: `%create` stands alone, and everything else is `[%bucket flag a-bucket]`.

| Action               | Purpose                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `%create`            | Create a host-owned Bucket and register the channel with `%groups`, passing it the named reader roles |
| `%delete`            | Delete the Bucket and remove its `%groups` channel registration                                       |
| `%set-title`         | Update the Bucket's authoritative title; group metadata is updated separately through `%groups`       |
| `%set-writers`       | Replace the group-role writer set                                                                     |
| `%create-folder`     | Add a folder beneath an existing folder or the root                                                   |
| `%begin-upload`      | Validate the request, reserve an entry id and object key, and answer with a host-minted upload token  |
| `%fail-upload`       | Mark the requester's pending upload failed                                                            |
| `%issue-bucket-read` | Answer with a read token covering every ready object in the Bucket, for the requesting ship           |
| `%issue-delete`      | Answer with a short-lived delete token bound to one ready file                                        |
| `%entry`             | `%rename`, `%move` (cycle-checked), or `%delete` (recursive for a folder tree) one entry              |

`.readers` on `%create` is passed straight to `%groups` and is not retained, so creating over an existing Bucket is not a way to change its ACL.

Answers are a `$response-body`: `%ok`, `%grant` for a per-object token, `%token` for a bucket read token, `%error` with a typed reason, or `%pending`. `%pending` is not terminal -- it means the host is still working, and the real answer arrives on the same request id.

Subscriber agents forward actions to the host with the noun-only `%buckets-command-1` mark, subscribing to the answer path _before_ poking so a host that answers in the same event cannot publish before the requester is listening. The host derives the actor from the Gall bowl and re-authorizes the command.

The group host always creates and hosts the Bucket, but any current group admin may initiate creation. A non-host admin's local `%buckets` agent first checks its group replica, then forwards the request to the group host. The host checks the actor against its authoritative `%groups` state before allocating the Bucket or registering its channel. Consequently the channel nest, object storage, quota, and eventual billing all remain attached to the group host rather than the initiating admin. Repeating an identical create request is idempotent and re-attempts channel registration; a conflicting request for an existing Bucket name is rejected.

The Gall delete action removes the manifest and `%groups` registration, but storage-wide object cleanup is not atomic yet. The client intentionally withholds Bucket deletion until Memex exposes a host-authorized bulk cleanup operation.

## HTTP surface

Eyre is bound at `/buckets`. A session cookie is the host's own capability, so anything submitted over HTTP acts as the host itself; an unauthenticated request gets 401, as in `%notes`.

| Route                                  | Purpose                                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| `POST /buckets/~/v1`                   | Submit one action, held open until its terminal answer                |
| `GET /buckets/~/v1/buckets`            | All locally available snapshots                                       |
| `GET /buckets/~/v1/buckets/<host>/<n>` | One local snapshot                                                    |
| `GET /buckets/~/v1/request/<id>`       | The state of a submitted request, for a client that lost its response |

Because the POST is held open across the terminal answer, a client needs no correlation machinery: `requestId` is optional and one is minted if absent. The poll route exists to recover an answer after a dropped connection, within the grace period a settled request is retained for. A `@uv` id carries dots, and the request-line parser mistakes its trailing dot-group for a file extension, so that segment is reassembled before parsing.

## Scries and subscriptions

| Path                                     | Mark                      | Description                                           |
| ---------------------------------------- | ------------------------- | ----------------------------------------------------- |
| `/x/v1/buckets`                          | `%buckets-snapshots-1`    | All locally available Bucket snapshots                |
| `/x/v1/buckets/<host>/<name>`            | `%buckets-response-1`     | One local Bucket snapshot                             |
| `/x/v1/buckets/<host>/<name>/read-token` | `%buckets-read-token-1`   | The read token this ship currently holds, if any      |
| `/u/joined/<host>/<name>`                | `%loob`                   | Whether the local agent has the Bucket                |
| `/v1`                                    | `%buckets-response-1`     | Initial snapshots and all local replica updates       |
| `/v1/requests`                           | `%buckets-req-response-1` | Answers to actions submitted by this ship's clients   |
| `/v1/buckets/<host>/<name>/updates`      | `%buckets-response-1`     | Host-authorized snapshot followed by manifest updates |

Every scry answers a mark that grows to `json`, because clients read them over Eyre; `%noun` does not, and a peek returning it answers 500.

Direct scries are self-only. Remote consumers subscribe to the host's update path, where the host can apply the live group authorization check. Subscriber agents report joined/left state to local `%groups` using `%group-channel-active`.

Bucket snapshots are replica observations, not command acknowledgements: an action's answer is its `$response-body`, not the appearance of anything in a snapshot. An in-flight upload never appears in a snapshot at all. Bucket channels must never be sent through `%activity` post/thread scries because they do not contain posts or threads.

## Uploads

1. The client sends `%begin-upload`. The host validates size, content type and parent, reserves an entry id and object key, opens a host-private session, and answers _that requester_ with a token minted from its own entropy. Nothing is broadcast and nothing enters the manifest.
2. The client presents that token and the Bucket host to Memex `POST /v2/buckets/uploads/grant`.
3. Memex asks the host's Pioneer sidecar to run `%pioneer-buckets-authorize-upload`. The host binds Memex's reservation id on first exchange and returns authoritative Bucket metadata. Pioneer stamps the host from its own ship identity.
4. Memex returns a short-lived PUT grant bound to the host, Bucket, object id, caller, size, content type, and expiry.
5. The client uploads bytes directly to object storage, with progress, cancel and retry.
6. The client calls Memex's completion endpoint. Memex HEAD-verifies the object and sends its receipt through `%pioneer-buckets-complete-upload`.
7. The host validates the reservation, object id, host, Bucket id, size and MIME type, then publishes the entry and emits a revisioned update.

Completion is idempotent, and so is re-exchanging the upload token: the host echoes the reservation it bound first and ignores the one Memex proposes, because Memex mints a fresh id per grant call and denying the second would make a retried upload unrecoverable. Every refusal on this path names its condition in the log -- the wire vocabulary is only `authorized` / `denied` / `expired`, so a dozen conditions share one value and the log is the only way to tell them apart.

Broker unavailability fails the upload cleanly and marks the session failed. Settled sessions are retained briefly, for idempotent re-completion and so the uploader can read the reason, then swept.

## Reads

Read access is uniform across a Bucket, so a reader gets one token for the whole Bucket rather than one per file, and the host pushes it to the broker instead of being asked per object.

1. A reader's own ship holds its token; `getBucketReadToken` is a local scry with no network hop. A cold start asks for one with `%issue-bucket-read`.
2. The host checks live group access, mints a per-reader token, and `PUT`s it to Memex `/v2/buckets/tokens/<ship>`, authenticated with the ship's `%genuine` secret. The mint lives only on the wire until the broker accepts it, so a restart mid-flight drops it cleanly rather than stranding it.
3. On acceptance the host rechecks access -- it may have been pulled while the broker was answering -- and only then stores and answers `%token`. Otherwise it revokes what the broker just took and refuses the requester.
4. The reader exchanges the token at Memex for a signed URL. Memex answers from its own table without asking the ship, so reads cost no round trip to the host and survive it being offline.
5. The host re-mints on a timer before the token lapses, so a client never waits on one.

### Desired state, not push and revoke

Access is synced as **versioned desired state**, one record per (Bucket, reader), rather than as a push effect and a revoke effect. Grant, rotation and revoke are the same operation: `PUT /v2/buckets/tokens/<host>` carrying the Bucket, the reader, a strictly increasing `revision`, and either a `granted` state with its token and expiry or a `revoked` state with nothing usable.

This is what makes delivery order stop mattering. The broker keeps only the highest revision it has seen, so a message says what should be true rather than what to do — and a delayed, duplicated or retried request loses to the truth instead of overwriting it. A revoke can be issued while a grant is still in flight; whichever arrives second, the revoke wins.

Consequences worth knowing:

-   **Retries are blind and safe, but not endless.** Anything whose revision is above what the broker has confirmed is still owed, and one timer re-sends all of it. That timer lands on a fixed grid and is cancelled before it is set, so arming it repeatedly cannot leave a fleet of timers each re-sending the whole set. A stale write is the protocol working, not a failure — it answers 200 with `applied: false` and the revision the broker kept. The broker classifies its own failures: `retryable: true` stays owed, while `retryable: false` is a validation refusal that would answer the same way next time, so it stops being owed until the next access change supersedes it. Nothing is owed past its own expiry either, since by then a grant is worthless and a revoke is moot.
-   **Only a success confirms, and a success carries `currentRevision`.** If that number is ahead of ours — state loss here, or an earlier incarnation of this agent — we adopt it and re-send, rather than being discarded as stale from then on. Falling behind always surfaces on the success path, because a stale write is a 200 rather than an error; a rejection is a rejection whatever its body says, and reading a revision out of one would install a grant the broker just refused. `GET /v2/buckets/tokens/<host>/revision` exists for explicit recovery, but the common path needs no separate lookup.
-   **Nothing is served until the broker confirms it.** A grant is handed to a client only once its revision is synced, so a client never holds a token that 403s.
-   **A superseded grant answers its waiter.** A client blocked on a grant that a revoke overtook is told so, rather than left to time out. A record names at most one waiting request, and every transition that resolves or abandons one goes through a single arm, so the clearing and the answering cannot drift apart.
-   **A settled record past its expiry is dropped, whichever state it is in.** By then the token it names has lapsed, so a grant is worthless and a revoke is moot — the same reason neither is owed any more. Re-granting later opens at revision 1, loses to the broker as a stale write, and adopts the number it is told. Anything still owed, or still holding a waiter, stays.
-   Revocation is still driven by the stored records rather than the subscription list, so a reader that took a token and then unsubscribed is covered, and losing one Bucket does not revoke tokens for others. Expiry remains a backstop for a host that dies, not the mechanism.

The credential goes in `X-Landscape-Token`. Neither it nor a bearer read token ever appears in a path or query string, where it would land in access logs.

**Pointing a ship at a different broker.** The broker is one service seen from two directions — the host pushes grants to it, clients upload and read through it — so both halves have to move together or the pair is broken. The host side is a poke, because a ship has no environment to read:

```
:buckets &noun [%set-broker-base `'https://memex.test.tlon.systems/v2/buckets']
:buckets &noun [%set-broker-base `(unit @t)`~]     :: back to the default
```

Only `https://` bases are accepted: the credential rides in a header, so a base naming an unexpected or plaintext host does not fail closed, it discloses the secret. `/x/v1/broker/base` reads back what a live host is using. The client half is the `TLON_MEMEX_URL` environment variable, set either way round:

```sh
# shell, unprefixed — one run
cd apps/tlon-web
SHIP_URL=https://hatrel-disnut.test.tlon.systems \
TLON_MEMEX_URL=https://memex.test.tlon.systems \
pnpm dev

# or apps/tlon-web/.env, VITE_-prefixed — persists
VITE_TLON_MEMEX_URL=https://memex.test.tlon.systems
```

Both spellings exist for the same reason `SHIP_URL` takes both: only `VITE_*` names survive `loadEnv` out of an `.env` file, while the shell can set the bare name. It is read when the dev server or build starts, not per request, so a change means a restart.

It reaches the bundle only because `apps/tlon-web/vite.config.mts` substitutes it in its `define` block — `envPrefix` exposes `VITE_*` through `import.meta.env`, and nothing else arrives via `process.env`. The hosted web build has no override compiled in, so testing the upload half means running the client locally against the hosted ship. Mobile would need the same wiring through Expo before the override works there.

**Memex ships before this agent does.** A mint the broker refuses is never stored, whatever the refusal — including a 404 from a broker without the endpoint — because a token the broker does not hold would 403 on first use. There is deliberately no compatibility path for the reverse order.

**Reads are scoped to what the caller needs.** `/v1/buckets` lists buckets without their entries, `/v1/buckets/full` includes them, and `/v1/buckets/<host>/<name>` reads one — the split `%channels` uses for posts, for the same reason. Entries are the only unbounded field, and everything that lists rather than opens wants the metadata alone. `/v1/ready` answers whether the agent is here at all; asking `/v1/buckets` that question made a yes/no scale with everything stored.

Deletes stay per-object, because they are destructive: `%issue-delete` binds a short-lived token to one ready file, exchanged through `%pioneer-buckets-authorize-delete` before the manifest entry is removed. Recursive client deletion commits each file's manifest removal immediately after Memex confirms its object deletion, and treats already-deleted as idempotent success. A host-authorized server-side bulk delete remains the durable atomic implementation.

## Pioneer thread contract

All four threads live under `desk/ted/pioneer/` and are invoked by Pioneer with the flattened `%pioneer-buckets-*` file names. They accept `(unit json)` and return JSON.

| Thread                              | Input                               | Successful result                                                                                                                                        |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `%pioneer-buckets-authorize-upload` | `{capability, brokerReservationId}` | `{result: "authorized", upload: {bucketName, bucketId, sessionId, objectId, actorShip, size, mimeType, checksum, expiresAtMillis, brokerReservationId}}` |
| `%pioneer-buckets-complete-upload`  | `{brokerReservationId, receipt}`    | `{result: "completed"}`                                                                                                                                  |
| `%pioneer-buckets-authorize-read`   | `{capability, objectId}`            | `{result: "authorized", read: {bucketId, objectId, displayFilename}}`                                                                                    |
| `%pioneer-buckets-authorize-delete` | `{capability, objectId}`            | `{result: "authorized", delete: {bucketId, objectId}}`                                                                                                   |

Authorization failures return `{result: "denied"}` and expired tokens return `{result: "expired"}`. Pioneer parses nothing else and fails on an unrecognized result, so adding a category is a broker protocol change rather than an agent one. `expiresAtMillis` is Unix time in milliseconds.

`%pioneer-buckets-authorize-read` is retained because the broker keeps a Pioneer fallback for hosts that do not push yet — ships update on their own schedule, so there is no moment when every host has started pushing. It fires whenever the broker has no row for a capability. It cannot resurrect a revoked token: revocation deletes the local capability as well, so this answers a refusal too.

## Tests

`desk/tests/app/buckets.hoon` covers:

**Uploads and the manifest**

-   A complete upload lifecycle, from `%begin-upload` through a verified broker receipt
-   An in-flight upload staying invisible until its object lands
-   Reservation binding, verified completion, and idempotent retries
-   Rejection of bad input -- nonexistent parent, zero or oversized file, malformed content type
-   Deleting a folder taking the in-flight uploads under it

**Read tokens**

-   One token covering every ready object in its Bucket, and nothing outside it
-   The two-phase mint: `%pending`, the outbound `PUT`, then the token and its refresh timer
-   The held token's peek answering a mark that grows to `json`
-   A remote token filed under the Bucket that asked for it, not a sibling on the same host
-   Access rechecked before installing a token the broker has accepted
-   A refused push storing nothing, whether the broker answers 404 or 503

**Revocation**

-   A reader losing group access being kicked and its token revoked
-   A reader that never subscribed, or unsubscribed, still being revoked
-   A revocation the broker refused being retried until it confirms
-   A deleted group revoking rather than crashing on its permissions
-   Lazy cleanup of expired capabilities and their reservation bindings

**Requests and permissions**

-   A forwarded request surviving the host's `%pending` and settling on the real answer
-   The HTTP surface: authentication, malformed bodies, and an action answered inline
-   Rejection of a remote write when the live `%groups` gate denies access, and acceptance with a writer role
-   Group-hosted creation by an authorized remote admin; rejection for a non-admin; idempotent retries
-   A Moon being refused Bucket storage even when it hosts the group
-   State round-tripping through `+on-load`, and a kick resubscribing rather than dropping the replica

`desk/tests/app/groups.hoon` additionally covers the `can-write` peek resolving to `~` for a ship holding no seat, which both this agent and `lib/channel-utils` read with `.^`.

Run the targeted fakezod test with the repository's normal `%test` thread against `/tests/app/buckets/hoon`. Marks must remain top-level files such as `desk/mar/buckets-action-1.hoon`; nesting them under `desk/mar/buckets/` changes the mark name and prevents Gall from resolving the protocol.
