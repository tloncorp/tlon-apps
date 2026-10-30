# Proposal

## Why

A bucket upload is charged to the hosting account of the bucket's host, and a member uploading into someone else's bucket has no way to learn how much room that account has left, or what per-object limits apply, before starting. The only capacity endpoint Memex has answers for the calling ship's own account and reports bytes alone, so a client finds out it is over quota one grant at a time, mid-batch. This change gives a member a permissioned, bucket-keyed capacity query, as laid out in `design/backend/6735-capacity-query-for-buckets.md` (TLON-6735).

## What Changes

- Add a capacity query verb to the `%buckets` agent's existing request interface: a local client pokes it for one bucket and receives one terminal answer on the request subscription, exactly as for every other bucket action.
- Have the bucket host gate the query the way it gates an upload: the requesting ship is taken from the request origin and must have write access to the bucket. A ship without it is answered `not-authorized` and Memex is never asked.
- Add a Memex Buckets API endpoint, authenticated as the host with its landscape token, that answers for the host's hosting account keyed by the bucket named in the request. Memex checks the host's token, that buckets are enabled for the host, and that the host has an active hosting owner; a host failing any of these is refused, and nothing falls back to the uploader's own account or the legacy storage endpoint.
- Return, as the query's answer: remaining bytes, remaining file count, the per-object byte limit, and the allowed MIME types. Remaining values are exact integers clamped at zero.
- Relay a Memex refusal to the requester as a typed error carrying the broker's own account of it, on the path the agent already uses for grant refusals.
- Exclude from this change: anything the client does with the answer (TLON-6737), reservation of capacity by the query, and any change to how quota or rate limits are enforced.

## Capabilities

### New Capabilities

- `buckets-capacity`: a bucket member's permissioned read of the upload capacity available to a bucket, resolved by the bucket's host against its hosting account at Memex and answered on the agent's request interface.

### Modified Capabilities

None. The upload, read-token and request/response requirements of `%buckets` are untouched; the query is a new verb riding the existing request machinery.

## Impact

- `%buckets` agent (this repo): a new `a-bucket` verb and a new `response-body` variant in `desk/sur/buckets.hoon`, their JSON codecs in `desk/lib/buckets/json.hoon`, the host-side authorisation and broker call in `desk/app/buckets.hoon`, the agent spec section in `docs/backend/desk/app/buckets.md`, and tests in `desk/tests/app/buckets.hoon`.
- Memex (ylem, separate repo): a new route in `pkg/api/memex/src/Memex/API/Buckets.hs` reusing the grant handler's owner and tier resolution and the existing `getOwnerUsage` accounting, plus its request and response types and tests.
- Compatibility: the `response-body` mark gains a variant, so the versioning rule in the agent spec applies, and an un-upgraded host nacks the new verb, which the requester reports as the existing "host rejected the command" error. Memex ships before the agent, as for every other broker call. The client request helper and its desk-compatibility guard are 6737's.
