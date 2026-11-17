# Design

## Context

See `proposal.md` for motivation and `specs/buckets-capacity/spec.md` for required behaviour. The source is the author's design doc, `design/backend/6735-capacity-query-for-buckets.md`; this file records how it maps onto the two codebases and the choices that doc left to implementation.

Four facts shape the approach.

Memex enforces storage quota at one scope, the hosting account. A reservation is admitted against the account's summed usage across legacy attachments, live upload reservations and undeleted bucket objects, compared with the account's tier limits on bytes and file count. The per-host, per-bucket and per-actor scopes are rate limiters on grant requests, not capacity. So the number a member needs is the host account's remaining pool, and every input to it, the owner behind a host ship, that owner's tier, the usage sum, and the per-object size and MIME rules, is already resolved on the grant path.

Memex knows nothing about group membership. Every Buckets route authenticates the host by its landscape token, verified by asking the host ship's own hosting sidecar, and separately requires the host to have an active hosting owner on record. The member's permission can only be checked on the host's `%buckets` agent, which already does it for uploads with the bucket's writer rule.

The agent already has a correlated request loop. A local client pokes `%buckets-action-1` with a request id; a bucket hosted elsewhere is forwarded as `%buckets-command-1` after subscribing to the host's per-request path; the host takes the actor from the Gall bowl, re-authorises, and answers a `$response-body` that the requester's agent relays onto `/v1/requests`. Every broker call leaves through one authenticated POST helper, and a broker refusal is relayed to the requester with the broker's own code, retryability, wait and scope.

The legacy storage-info route answers for the calling ship's own account, keyed by ship, and discards the file count. It is the client's own-plan indicator and stays as it is.

## Goals / Non-Goals

**Goals:**

- One new verb on the existing request interface, one new Memex route, nothing new in agent state.
- The host's write check and Memex's host checks each stay in the place that already performs them for uploads.
- The query's response is derived from the same accounting and the same tier resolution a grant uses, so a client reading it is reading what a grant would see.

**Non-Goals:**

- Changing the legacy storage-info route, or routing any query through it.
- Rate-limit figures in the response.

## Decisions

### 1. The query is keyed by bucket, not by hosting account

The design doc's decision. A ship-keyed query would do today, since the figure is the account's pool, and the host could proxy the legacy route for a member. It was not chosen because the key is the public contract: a bucket key lets a finer-grained figure appear later behind the same query without the client changing, and the bucket is also where the write check lives. The cost is that the response is an account-wide number returned under a bucket's name, which the spec states and a client cannot distinguish from a dedicated one.

### 2. The query rides the request interface

A new `a-bucket` verb, forwarded and answered exactly like `%begin-upload`. Alternatives: a scry, which is self-only and cannot cross to the host; a fact on the bucket's `/updates` subscription, which is gated on read access rather than write, is an owner-wide number that changes on uploads the host never sees, and would have the host polling Memex for every subscriber. The request path already carries the actor, the `pending` answer for a forwarded command, the watch-before-poke ordering, the two-minute timeout, and the broker-error relay; the verb inherits all of it.

### 3. The gate is write access, checked by the host

The host authorises `src.bowl` with `+group-can-write`, the same arm `%begin-upload` goes through in `+action-authorized`. Read access was considered and rejected: a reader who cannot upload has no admission decision to make, and the information is about the account's spending. A non-writer is answered `not-authorized` before any broker call, so Memex sees only requests the host already vouched for.

### 4. One Memex route on the Buckets API, answering from the grant's own accounting

A single `POST /v2/buckets/capacity`, authenticated as the host like every other Buckets route and naming the bucket the host is asking about. Memex applies the same host checks it applies to a grant, resolves the same owner and tier, and reads the same usage aggregate, so the answer is what a grant made at that moment would have seen; the two remaining values are clamped at zero. A POST rather than a GET because the agent already has one authenticated POST helper for every broker call, and a second transport for one route buys nothing. The route is admitted under the existing read rate limiter so it cannot be used to run the usage aggregate at will. Alternative rejected: widening the legacy ship-keyed storage-info route, which has the wrong key and no bucket in it.

### 5. The answer is a new response-body variant under a new mark version

`%capacity` joins `$response-body` as a `v3` with a `req-response-3` mark, following the `-1` to `-2` precedent: a subscriber accepts all three, an un-upgraded subscriber on an upgraded host drops `-3` and times out as it does today for `-2`, and an upgraded subscriber on an older host has its command nacked, since the host cannot read the verb, and answers its client `unknown` with the existing "host rejected the command" error. Extending `v2` in place was rejected because an older subscriber's mark conversion would fail on the new tag for every answer, not only capacity ones. The two remaining values travel as exact integers, never rounded to a unit.

### 6. A Memex refusal is relayed, never substituted

Any refusal from Memex becomes `%error` with the broker fields, as for a grant, and there is nothing to cancel or release since no reservation exists. A missing `%genuine` secret answers the same unreachable error a grant gives. No branch answers from the legacy route or from the requester's own account.

## Risks / Trade-offs

- [The answer can be stale by the time the client's first grant arrives, since the pool is shared by every bucket, ship and legacy attachment on the account] → The spec states the answer is advisory and the grant remains the only admission. A client that wants the room held is TLON-6738's.
- [Remaining bytes and file count reveal, roughly, which tier the account is on] → Accepted. The figures are what a writer needs to decide whether to upload; the tier name, account identity and other buckets are not in the response.
- [A capacity route with no limiter is a cheap way to make Memex run the usage aggregate repeatedly] → Admitted under the existing read rate limiter, host and bucket scopes, with `rate_limited` relayed like any other refusal.
- [A host could name a bucket it does not host] → Memex requires the authorising ship to equal `bucketHost`, as it does for grants, so the answer is always for the caller's own account.
- [The mark bump makes an un-upgraded subscriber time out on every answer from an upgraded host] → Same trade-off already taken for `-2`, documented in the agent spec, and bounded by the ordinary desk rollout.
- [A broker call that neither completes nor cancels leaves the host's request record unsettled, since a query has no session or reader record to finalise it] → Accepted, as the agent spec already accepts two quota leaks of the same shape; the runtime normally turns a dead call into a cancel, and the requester's own timeout bounds the client either way.

## Migration Plan

1. Ship the Memex route first. A host on the new desk against an old Memex gets a 404 and relays it as a final broker error, which is the existing contract for every other call.
2. Ship the desk with the new verb, `v3` response-body and `req-response-3` mark. No state migration: nothing is persisted for a query beyond the existing request record.
