# Tasks

Names chosen by `design.md` and renameable before work starts without touching the spec: the verb `%query-capacity`, the response variant `%capacity`, the Memex route `POST /v2/buckets/capacity`, and the JSON fields `bytes`, `files`, `maxObjectBytes`, `mimeTypes`.

## 1. Memex route (ylem repo)

- [x] 1.1 Add `CapacityRequest` (`host`, `bucketHost`, `bucketId`) and `CapacityResponse` (`bytes`, `files`, `maxObjectBytes`, `mimeTypes`) to `pkg/api/memex/src/Memex/Buckets/Types.hs` with JSON instances, and verify a round-trip test in `pkg/api/memex/test/Main.hs` passes for both.
- [x] 1.2 Add `capacity :: POST /capacity` to the `API` record in `pkg/api/memex/src/Memex/API/Buckets.hs`, authenticated by `X-Landscape-Token`, running `ensureGloballyEnabled`, `ensureHostEnabled`, the token check, the `bucketHost == host` requirement, `resolveOwner`, `resolveTier` and `getOwnerUsage`, and answering `max 0 (maxStorageBytes - usedBytes)`, `max 0 (maxFileCount - usedFiles)`, `config.maxObjectBytes`, `config.allowedMimeTypes`, with the subtraction inside the `max` as the legacy storage-info route has it and not as the Solaris account model mis-parenthesises it; verify with unit tests on the pure computation for room remaining and usage over tier clamping each value to zero; the default tier is `resolveTier`'s, shared with the grant.
- [x] 1.3 Admit the route through the read rate limiter under `HostScope` and `BucketScope` as `readGrant` does, and verify the existing admission test covers `admitRead` refusing under those scopes with the scope name.
- [x] 1.4 Verify refusals: invalid token, buckets disabled, host outside the canary set, host with no active owner (`CapabilityDenied`), and `bucketHost /= host`, each reached through the helper the grant route calls, so the typed `BucketError` is inherited; no HTTP harness exists in the suite, and the end-to-end check is task 5.2.

## 2. Agent types, marks and codecs

- [x] 2.1 Add `[%query-capacity ~]` to `$a-bucket` and a `v3` core in `desk/sur/buckets.hoon` whose `$response-body` adds `[%capacity =capacity]`, with `$capacity` a named type of `bytes`, `files`, `max-object-bytes` and `mime-types` like the other answer payloads, with `req-response`, `incoming-request` and `requests` aliases moved to `v3`; verify `desk/tests/app/buckets.hoon` still compiles and passes unchanged.
- [x] 2.2 Add `desk/mar/buckets/req-response-3.hoon` with noun and JSON grow, and lifts from `-1` and `-2` in the subscriber's accept path; verify a test delivers a `-2` fact to an upgraded subscriber, settles on a `-3` capacity fact, and drops an unknown `-4`.
- [x] 2.3 Extend `+action` in `desk/lib/buckets/json.hoon` to decode `query-capacity` and `+req-response` to encode `{"capacity": {...}}` with the two counts as numbers; verify a sibling of `+test-http-decodes-every-session-verb` reaches the broker call for the new verb, and `desk/tests/lib/buckets-json.hoon` pins the decoded verb and the four encoded fields.

## 3. Host-side authorisation and broker call

- [x] 3.1 Add `%query-capacity` to `+action-authorized` as `(group-can-write group.st flag writers.st who)`, and verify tests: admin answered, writer-role answered, empty writer set with read answered, reader without role answered `%not-authorized` with no broker card, non-member answered `%not-authorized`.
- [x] 3.2 Implement the host's broker call with `+broker-post` to `/capacity`, carrying `host`, `bucketHost`, `bucketId` for the bucket named in the request, on a wire carrying the request id; verify a test asserts the outgoing request's URL, headers and body, and that a missing `%genuine` secret answers the unreachable error without a card.
- [x] 3.3 Handle the Iris response: decode `CapacityResponse` into `%capacity` and answer the request; decode a `BucketError` body into `%error` with broker fields; treat an unreadable body as `unknown` and an Iris cancel as `outcome_unknown`, with no session or reservation to cancel in any case. Verify tests for each of the four outcomes, each answering exactly one terminal response under the original request id.
- [x] 3.4 Verify a forwarded query on the requester side in one test: `pending` on `/v1/requests`, the watch-before-poke forward, the host's `%capacity` relayed under the same request id, and the two-minute timeout path when the host never answers. The harness runs one agent, so the host's write check and broker card are the host-side tests of 3.1 to 3.3.

## 4. Agent spec

- [x] 4.1 Add `%query-capacity` to the Actions table and `%capacity` to the response-body list in `docs/backend/desk/app/buckets.md`, update the mark-versioning paragraph and the Scries and subscriptions table for `-3`, and add a short Capacity section stating the write gate, the host-account resolution, the four fields, the zero clamp, and that the answer is advisory; verify the Tests list in that doc names the new tests.

## 5. Integration

- [x] 5.1 Run `desk/tests/app/buckets.hoon` in full on an assembled desk and the Memex test suite, and verify both pass.
- [x] 5.2 On the dev pod, with a member ship on one hosting account and a host on another, issue the query from the member and verify the answer reflects the host's account and that a non-writer member is refused before any Memex log line appears.

## Workflow follow-up

- Update `design/backend/6735-capacity-query-for-buckets.md` once merged, so it records what shipped.
- Archive the change after review.
