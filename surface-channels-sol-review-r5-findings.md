# Sol review r5 — findings, verbatim

**Round:** a review of the fix round that answered the r4 cold review.

**Model:** `gpt-5.6-sol`, xhigh reasoning, read-only sandbox.
**Reviewed at:** `46efb254c6`. **Target:** `2a81fab03b..46efb254c6`, 46 files,
+3,506/−354, decisions D187–D197.
**Cost:** ~23.5 minutes, 2.05 MB of log.
**Brief:** `surface-channels-sol-review-r5-brief.md`.
**Raw log:** `sol-review-r5.log` (2.05 MB, untracked, local only).

This file is the reviewer's own words, unedited, because the raw log is
untracked and a summary of a finding is not the finding. Dispositions are NOT
here — they go in a separate document once decided, following the precedent of
`surface-channels-review-dispositions-r4.md`.

No classifier refusal this time. The brief excluded browser containment by
path rather than in prose, and also excluded `surface-channels-claims-index.md`,
a third of whose content concerns that material.

**Independently verified before this file was written**, since a fix round's
review is worth nothing if its findings are taken on trust:

- **Finding 1 — confirmed by reading.** All three folds omit `advertisedHead`:
  `surface-records.ts` (`deps.reduce({ spec: previous, hostShip, posts })`),
  `surface-publish.ts:1063`, and `surface-publish.ts:1383` — the last of which
  computes `newestSequenceNum(hydrated.posts)` two lines above and does not
  pass it.
- **Finding 2 — premise confirmed.** `syncInitialPosts` fetches `postCount: 50`
  (heavy) or `30` (light), a count-limited backend fetch; `coveredToStart` is
  the purely numeric `oldest === 1`. A tied sibling never acquired cannot be
  recovered by a local tuple cursor.
- **Finding 3 — confirmed by reading.** `getNextPageParam` returns
  `{ channelId, count, mode: 'older', cursorSequenceNum }` with no
  `cursorPostId`, so the tuple predicate is unreachable from that caller.
- **Finding 4 — confirmed by reading.** The payload overwrites `section`,
  `readers` and `join`; `channelWriteIdentity` compares six fields, none of
  them those three.
- **Finding 5 — reproduced.** A spec shape the base publisher accepted
  (nonempty `actions` plus `memberInteraction`) now reads back as
  `status: 'invalid'` through `readSurfaceSpec`.
- **Finding 6 — confirmed by running it.** Moving the index aside makes
  `check-claims-index.mjs` print a note and exit 0.

---

## Verdict

No: this range is not yet safe for preserving live member state.

Two release-blocking gaps remain:

1. Snapshot migration/repair paths omit the advertised head and can accept, then republish, state from a snapshot that claims history beyond the real channel head.
2. A count-limited backend fetch can omit one of two posts sharing a sequence number, while surface hydration incorrectly declares the numeric sequence range complete.

I found four additional correctness/control issues.

## A. Findings

### 1. High — migration writers can launder a head-exceeding snapshot into accepted state

The reducer correctly rejects snapshots whose `upToSequenceNum` exceeds `advertisedHead`, but three production folds do not supply that head:

- [`surface-records.ts:994`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-records.ts:994), when carrying the previous revision during pending-migration repair.
- [`surface-publish.ts:1063`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-publish.ts:1063), when repairing an exact-republish with a missing migration snapshot.
- [`surface-publish.ts:1383`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-publish.ts:1383), when folding state for preserve-state publication.

Concrete trigger: revision 1 has a host snapshot at post sequence 2 claiming `upToSequenceNum: 1_000_000`, while the real head is 3. A preserve-state publish to revision 2 accepts the snapshot’s state because the fold has no head, then emits a revision-2 migration snapshot bounded to the real newest sequence. The corrupt state is now “laundered” into a snapshot normal clients accept.

The repair path has a second form: the initial revision-2 fold ignores a revision-1 snapshot because it belongs to the wrong revision; `repairPendingMigration` then folds revision 1 without the head and carries the invalid state forward.

The existing control at [`surface-records.test.ts:991`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-records.test.ts:991) proves only the ordinary `state` and `snapshot` paths. It would survive these omitted call sites.

Evidence: source-traced.

Required negative controls:

- Preserve-state publication over a current-revision inflated snapshot must return `snapshot-head-exceeded` and perform zero definition, mirror, or snapshot writes.
- Pending repair over an inflated previous-revision snapshot must also refuse with zero posts written.

### 2. High — numeric-head completeness can hide an omitted tied event

The SQL tuple pagination itself is improved, but the acquisition boundary can lose a tied row before that code sees it.

Initial sync asks for only 30 or 50 posts at [`sync.ts:2012`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/sync/sync.ts:2012). The backend fulfills this through a count-based `top` operation at [`channels.hoon:1605`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/desk/app/channels.hoon:1605), not a `(sequenceNum,id)` cursor. Duplicate sequence numbers are a documented historical condition in [`channel-utils.hoon:1584`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/desk/lib/channel-utils.hoon:1584).

Concrete trigger:

- The server has 51 posts: one each at sequences 50 through 2, and two distinct posts at sequence 1.
- Initial sync requests 50 and receives only one sequence-1 sibling.
- Local hydration sees newest sequence 50 and oldest sequence 1.
- [`hydration.ts:174`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/surface/hydration.ts:174) considers the numeric head reached, and [`hydration.ts:207`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/surface/hydration.ts:207) considers history covered to the start.
- No backfill is attempted for the missing sibling.

A previously complete client folds both events; a fresh client folds only one. If the omitted event writes a different member field or appends to state, that state is silently lost.

The current hydration test seeds both tied rows directly into each local database. It proves local tuple paging, not acquisition completeness.

Evidence: source-traced after reading the channels backend documentation and implementation.

Required negative control: seed the local database with one sequence-1 sibling, advertise the correct numeric head, and make the backfill source contain the other sibling. Hydration must fetch it or refuse to report `hydrated`. A numeric head alone cannot prove rung cardinality.

### 3. Medium — the ordinary chat scroller still drops ties across pages

`getSequencedChannelPosts` accepts `cursorPostId`, but its other caller does not propagate it:

- Older page parameters omit the ID at [`useChannelPosts.ts:140`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/useChannelPosts/useChannelPosts.ts:140).
- Newer page parameters omit it at [`useChannelPosts.ts:165`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/useChannelPosts/useChannelPosts.ts:165).
- Even if supplied, [`useChannelPosts.ts:280`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/useChannelPosts/useChannelPosts.ts:280) treats every post-ID cursor as an unread-marker cursor and clears it after resolving its sequence.

Concrete trigger: local rows `(7,B)`, `(7,A)`, `(6,C)`, page size 1. `newest` returns `(7,B)`. The next request carries only sequence 7, so the fallback predicate is `< 7`; it returns `(6,C)` and permanently skips `(7,A)`.

The query’s strict tuple predicates at [`queries.ts:3854`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/db/queries.ts:3854) and [`queries.ts:3933`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/db/queries.ts:3933) are therefore unreachable from this paging flow.

Evidence: source-traced.

Required negative control: an infinite-query test splitting a duplicate rung across pages, asserting both IDs occur exactly once in both older and newer directions and that normalization preserves a tuple cursor.

This is separate from the deliberately accepted `around` residual.

### 4. Medium — the channel re-read does not guard the whole cell it overwrites

[`channels.ts:523`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/channels.ts:523) says `channelWriteIdentity` represents everything `updateChannelMeta` will overwrite. It compares six presentation/definition fields, but the payload constructed at [`channels.ts:610`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/channels.ts:610) also overwrites `section`, `readers`, and `join`.

The API sends a complete `GroupChannelV7` replacement at [`groupsApi.ts:795`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/client/groupsApi.ts:795), and `%groups` replaces the channel at [`groups.hoon:2999`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/desk/app/groups.hoon:2999).

Concrete trigger: between the first and second reads, another administrator changes only the channel’s reader roles or section. All six identity fields remain equal, so the guard passes and writes the stale readers/section from the first read, undoing the concurrent change.

This is wider than the known remaining one-round-trip CAS race: the second read actually observes enough state to detect the change, but the comparison discards it.

Evidence: source-traced.

Required negative control: vary only `readerRoles`, section/navigation membership, or `join` on the second read and require either refusal with zero writes or payload reconstruction from the fresh value.

### 5. Medium — the schema change can freeze already-published version-1 surfaces

[`schemas.ts:303`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/client/surface/schemas.ts:303) now rejects a nonempty action map combined with `memberInteraction`. But the protocol version remains 1, and [`readSurfaceSpec`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/client/surface/schemas.ts:355) applies the new schema to persisted definitions.

At base commit `2a81fab03b`, the official fork fixture combined nonempty actions and this marker and treated the result as publishable. Therefore this is a previously accepted version-1 wire shape, not merely malformed hypothetical input.

I directly fed that formerly accepted shape to the current reader; it returned `{"status":"invalid"}`. Any live channel with that shape becomes unreadable to upgraded clients, freezing access to its folded state even though its event log remains intact.

The new differential test at [`surfaceSchemas.test.ts:167`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/__tests__/surfaceSchemas.test.ts:167) correctly proves the new refusal and both legitimate current arms. It does not test persisted-version compatibility.

Evidence: reproduced with the current reader and source-traced against the base revision.

Required negative control: a serialized definition accepted by the base publisher must remain readable after upgrade, or the protocol must be versioned and migrated while publication of new contradictory specs is rejected.

### 6. Low — the claims-index validator can certify absent or disabled controls

The validator has three false-green cases:

- Deleting the entire index exits successfully at [`check-claims-index.mjs:55`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/scripts/check-claims-index.mjs:55).
- The citation grammar accepts `file.ts:0`, and the line check at [`check-claims-index.mjs:198`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/scripts/check-claims-index.mjs:198) checks only whether the highest line is past EOF.
- A named test is validated only through `source.includes(title)` at [`check-claims-index.mjs:245`](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/scripts/check-claims-index.mjs:245). The title can remain in `test.skip`, `test.todo`, or a comment while the control no longer runs.

The CI wiring itself is correct and unfiltered. The defect is what the validator accepts as a live citation/control.

Evidence: source-traced. I did not run the validator because doing so would read the explicitly excluded claims index.

Required negative-control harness: delete the index, cite line zero, and move a cited title into a skipped test or comment; each mutation must exit nonzero.

## B. Fixes and controls verified

The following repairs hold at their inspected boundaries:

- `comparePostIds` is a total order across dotted numeric IDs, undotted numeric IDs, and fallback strings. I ran an adversarial 14-ID pair/triple check with no antisymmetry or transitivity failures. The committed test also covers 900 ordered pairs and 27,000 triples.
- Making `SurfacePostView.id` required is consistent with the production paths I traced: persisted rows have non-null primary IDs, the adapter passes them through, CLI records require them, and synthetic preview/transition/lint posts construct deterministic IDs. I found no production reducer caller creating an ID-less post.
- Local `newest`, `older`, and `newer` database paging now sorts and pages consistently on `(sequenceNum,id)` when the caller supplies the tuple. Surface hydration supplies the older-page ID. The acquisition and chat-caller gaps are Findings 2 and 3.
- The reducer correctly records `headExceededSnapshots` in both reduced and migration-pending results. Ordinary `surface state` and `surface snapshot` pass the head and refuse appropriately. The missing writer propagation is Finding 1.
- Publish and fork write-time re-reads compare the raw definition rather than schema-normalized output, fail closed when the read fails or disappears, and build the final write from the fresh channel. Their upload-race tests are discriminating.
- The `specPathIsUnder` fold/idempotency logic uses structural dot/bracket boundaries, and its renamed/malformed-control differential would fail under the former prefix behavior. I did not inspect the excluded lint rule bodies.
- `--surface-id` is removed from parsing and help across stage, land, and regenerate. The tests assert an unknown-option refusal and zero writes. The hand-edited staged-ID residual remains exactly as recorded.
- Preview host operations are validated and folded; per-actor restore actions replay constructively in order. The focused fold tests are discriminating.
- All nine template notes now correctly say publication owns `assetRef`, `sha256`, and `size`, while preserving author-selected `shellVersion`; implementation and the dynamic all-template test agree.
- The revision-keyed UI halt state and its seven tests correctly separate “same revision stays halted” from “new revision becomes live.” I drew no containment conclusions from this code.
- The fixed-date authoring doctrine is consistent: countdown state persists a fixed `targetMs`, and display-time rendering uses host-provided context rather than ambient creation-time recomputation.

Because the review was read-only, I did not physically apply source mutations. “Verified” here means the assertion and fixture were traced and would fail under the named defect, plus current tests were run where the environment allowed.

## C. Coverage ledger

Reviewed:

- The complete 46-file diff and surrounding implementation for reducer ordering, schema reads, database paging, surface hydration, publish/fork/state/snapshot writers, metadata writes, lint, preview, templates, and the claims validator.
- All 12 changed test files, plus the existing channel metadata and chat-query tests needed to judge caller coverage.
- Backend documentation followed by the relevant `%channels` paging and `%groups` whole-channel replacement code.
- D187–D197, the fix-diff, dispositions, original findings, and the changed plan sections other than excluded §5.
- The touched and cross-referenced portions of the four surface authoring documents and all nine changed template `NOTES.md` files.

Execution:

- Six focused Bun suite groups: 376 passed, 9 environment-gated browser checks skipped, 0 failed.
- Focused preview fold tests: 15 passed.
- Surface sandbox container: all 7 assertions passed; Vitest then exited nonzero only because it attempted to write its cache in the read-only workspace.
- API/shared Vitest suites could not start because Vite attempted similar cache/config writes.
- Full preview-render cases requiring `mkdtemp` could not run under the read-only filesystem.
- Comparator adversarial check passed; legacy-schema read-back reproduced Finding 5.
- No ship was run.

Exclusions:

- I did not read the claims index, the named review logs, the excluded containment files, the excluded lint rule bodies, or plan §5.
- `SurfaceSandboxHost.tsx` was consulted only to trace the revision-error callback lifecycle needed by D194; containment was not evaluated.
- Native remains untested, as already recorded.
- No tracked workspace changes were made. Existing untracked review artifacts remain untouched.

## D. Risk ranking

Findings by risk:

1. Missing advertised heads in migration writers — corrupt state can be permanently republished.
2. Count-boundary tied-row omission — a legitimate member event can be absent from a fresh client’s fold.
3. Version-1 schema incompatibility — existing surfaces can become unreadable.
4. Incomplete whole-cell metadata identity — concurrent permission or section changes can be reverted.
5. Chat scroller tuple omission — tied posts can be skipped during pagination.
6. Claims-validator false greens — evidence can disappear while CI remains successful.

The three areas most likely to contain another issue beyond those found are:

1. Cross-boundary pagination: backend count pages, initial sync, local watermarks, snapshot cutoffs, and both mobile database implementations.
2. Every migration/snapshot-producing call path: the optional `advertisedHead` parameter makes future omissions easy, and this range already missed three.
3. Whole-cell channel writes and compatibility boundaries: `%groups` replacement semantics, derived section state, permissions, and version-1 persisted-spec upgrades.
