# Surface Channels v0 — Session 1 decisions log

Working artifact for the surface-channels session described in
`surface-channels-handoff-prompt.md` (scope) and `surface-channels-plan.md`
(semantics). Every judgment call, deviation, and seam left for later gets a
line here.

## Ground-truthing report (step 1)

All eight claims verified against this checkout (b4cbe79d02). None failed; no
STOP condition hit.

1. **Post kind head must equal nest kind — VERIFIED.**
   `desk/app/channels-server.hoon:1086` (`ca-c-post` `%add` arm):
   `?>  =(kind.nest -.kind.essay.c-post)`. So `/chat/surface/...` kinds are
   valid in a `%chat` channel; a bare `/surface/...` kind would fail the
   assert. Note: the `%edit` arm (line 1106) does _not_ re-check the kind
   head; only `%add` does.
2. **Channel creation requires group admin — VERIFIED.**
   `desk/app/channels-server.hoon:1009–1020` (`can-nest`): looks up the
   creating ship's seat and requires a non-empty intersection with the
   group's admin role set; membership alone fails.
3. **TS post writers hardcode the kind — VERIFIED.**
   `packages/api/src/client/apiUtils.ts:229–261` (`toPostEssay`): kind is
   derived solely from `channelType` (`/diary`, `/heap`, `/chat`). Callers:
   `sendPost` (`postsApi.ts:196`) and `editPost` (`postsApi.ts:283`). The DM
   branch of `sendPost` separately hardcodes `/chat` (`postsApi.ts:179`).
4. **Config/payload module location — VERIFIED.**
   `packages/api/src/client/channelContentConfig.ts` holds
   `ChannelContentConfiguration`, `StructuredChannelDescriptionPayload`, and
   the renderer/draft-input registries (`allCollectionRenderers`,
   `allDraftInputs`, `allContentRenderers`).
5. **`JSONValue` is scalar-only — VERIFIED.**
   `packages/api/src/types/JSONValue.ts:1` (`number | string | boolean`),
   duplicated at `packages/api/src/urbit/channel.ts:308`. Unsuitable for
   recursive state; new `Json`/`JsonObject` types required, existing type
   left untouched.
6. **Sync extracts two fields; edits reconstruct from known fields —
   VERIFIED (the data-loss bug is real).**
   Read side: `packages/api/src/client/groupsApi.ts:1985` and `:2029`
   destructure only `description` + `channelContentConfiguration` from the
   decoded payload. Write side:
   `packages/shared/src/store/channelActions.ts:407–410` re-encodes the
   description from `channel.description` + `channel.contentConfiguration`
   only — a title/permissions edit through `updateChannel` would erase any
   other payload key (e.g. `surfaceSpec`). Notably
   `StructuredChannelDescriptionPayload.decode` itself already returns the
   raw parsed object (unknown keys survive decode); the loss happens at the
   extraction/reconstruction call sites.
7. **Post-blobs playbook — VERIFIED.**
   `docs/tlon-apps/post-blobs.md` exists with the versioning rule (design
   rule 1), registry-as-source-of-truth (rule 2), and unknown-entry
   degradation to `{ type: 'unknown' }` (rule 6). Registry lives at
   `packages/api/src/client/content-helpers.ts`
   (`postBlobDataEntryDefinitions`); the a2ui entry shows the sanctioned
   pattern for registering a schema defined in its own module
   (`A2UI.blobEntrySchema`).
8. **Edit state and sequence numbers in the client post model — VERIFIED.**
   Wire: `ub.Post.revision?: string` (`packages/api/src/urbit/channel.ts:135`);
   the Hoon `%edit` arm bumps `rev` (`channels-server.hoon:1122`). Client:
   `isEdited: 'revision' in post && post.revision !== '0'`
   (`packages/api/src/client/postsApi.ts:1357`) — only the boolean is
   persisted, not the raw counter, which is sufficient for the reducer's
   "reject any edited surface post" rule. `sequenceNum` comes from
   `post.seal.seq` (`postsApi.ts:1339–1342`), persisted on the post row
   (`packages/shared/src/db/schema.ts:1304`); replies have none; tombstones
   keep `seq` (`ub.PostTombstone`, `channel.ts:128`).

## Decisions

- **D1: Working docs are committed on this branch.** The handoff explicitly
  makes `DECISIONS.md` a review artifact alongside the diff, so it is
  committed (unlike the usual repo-root scratch-doc exclusion). The handoff
  prompt and plan stay untracked.
- **D2: Commit cadence.** Local commits per handoff step, as instructed; no
  pushes, no PR — those remain Patrick's.
- **D3: Kind-tail allowlist is the exact three tails** (`surface/spec`,
  `surface/event`, `surface/snapshot`), not a `surface/*` pattern — the most
  constrained reading of "allowlist: surface tails only", and the plan
  defines exactly three post kinds (§4.2–4.4). Extending the const list is
  trivial if a fourth kind appears.
- **D4: Kind tails are chat-only and top-level-only.** `toPostEssay` throws
  on a tail outside `channelType === 'chat'` (surface channels are `%chat`
  channels, §3); reply writers reject tails (replies carry no kind on the
  wire). DM `sendPost` rejects tails before poking.
- **D5: `editPost` also takes `kindTail`.** The Hoon `%edit` arm replaces
  the essay wholesale and does _not_ re-assert the kind head (only `%add`
  does — see ground-truthing #1), so an edit without the original tail would
  silently rewrite a surface post's kind to `/chat`. Callers editing a
  surface post pass the tail back in, mirroring the existing `botProfile`
  convention. (Reducer-side, edited surface posts are retracted regardless.)
- **D6: Live-ship round-trip deferred.** The repo's rube/playwright harness
  exists but boots a 3-ship environment (pier downloads, 5–10 min desk
  updates) — attempted only if time remains at the end of the session;
  otherwise the documented gap is: post a `/chat/surface/event`-kind post to
  a live `%chat` channel via HTTP API, confirm the server accepts it
  (`ca-c-post` kind-head assert), old clients render it as an inert chat
  message, and sync delivers `seal.seq` + `revision` as ground-truthed.
- **D7: Forbidden keys are rejected in surface JSON values too, not just
  pointer segments.** §7 forbids `__proto__`/`constructor`/`prototype` only
  as path segments; `Json` validation also rejects them as object keys
  anywhere. No reducer-reachable state can contain them anyway (ops can't
  name them), so this only rejects hostile hand-crafted snapshots/specs —
  and keeps prototype-polluting keys out of any code that indexes state.
- **D8: Depth-cap semantics.** "JSON depth 16" = container nesting: a value
  inside more than 16 nested arrays/objects is invalid; tested at 16 vs 17.
  `applyOp` additionally refuses any write whose path depth + value depth
  would nest state beyond 16, so reduced state always remains valid — and
  therefore snapshottable — under the same cap.
- **D9: The `Op` wire shape** (the plan uses `Op[]` without defining it) is
  `{ op: 'set'|'del'|'append', path, value? }` with `value` required for
  set/append. Recorded as an interface consumers must follow.
- **D10: `$actor` substitution semantics.** Segment position: only a segment
  that is _exactly_ `$actor` substitutes (with the plain ship string; RFC
  escaping applies only when formatting back to path text); a segment merely
  containing `$actor` invalidates the op — treating it literally could
  silently collapse per-user state into shared state. Value position: any
  string _exactly_ `$actor` anywhere in the value tree substitutes (needed
  for `append`-keyed records per §4.3's replay guidance); substrings stay
  literal. Host ops (no actor): any `$actor` occurrence in path or value
  invalidates the op, per §7.
- **D11: Pointer write semantics details.** Writes never index into arrays
  (any array hit during traversal invalidates the op; `append`'s final
  target must be an existing array). `del` through a scalar is a no-op
  ("missing path"), `del`/`set` through an array is an invalid op. Numeric
  segments are ordinary object keys when the container is an object.
  Property reads are own-property only (`toString` et al. read as absent).
  The 200-char path cap applies to the declared path text, pre-substitution.
- **D12: `fast-check` added as a packages/api devDependency** — the handoff
  requires property tests and the workspace had no property-testing library.
- **D13: `applyOp` validates op values itself** (`isJson`) even though
  schemas validate them upstream, so the pointer layer is total against
  hostile values on its own. Internal write results are wrapped
  (`{next}`/`{error}`) so state containing a literal `error` key can't be
  misread as failure (caught by tsc during implementation; regression
  test added).
- **D14: Caps interpretation.** KB = 1024 bytes; sizes measure the UTF-8
  JSON serialization of the _validated_ (unknown-keys-stripped) value — the
  raw blob string is independently bounded by `%channels-server`'s per-post
  `size-limit`. "Spec metadata total 32 KB" is enforced as the whole
  serialized spec (slightly stricter than the itemized list; simpler).
- **D15: Enforcement split for entry validity.** Caps and shape violations
  fail schema validation → the whole blob entry degrades to
  `{type:'unknown'}` (per the §7 caps table: "violations skip the entry").
  Pointer path grammar violations and `$actor` misuse are checked per-op at
  reduce time → only that op is skipped, remaining ops apply (per §7's
  Paths paragraph). Schemas therefore validate `path` only as a string.
- **D16: Invoke entries cannot smuggle ops** — zod parsing strips unknown
  fields, so a crafted invoke carrying an `ops` array validates but loses
  the ops; the reducer resolves ops exclusively from the current spec.
- **D17: Payload decode split.** `decode` is now lossless (no defaults
  injection, unknown keys preserved) so `encode(decode(x))` is
  byte-equivalent; the legacy hydrating behavior moved verbatim to
  `decodeWithDefaults`, used by the three in-package rendering call sites.
  Two deliberate behavior changes in `decode` for non-object JSON: a
  description that parses to a scalar ("5", "true") or an array is now kept
  as a plain-text description (legacy dropped scalars to `{}` and returned
  arrays as the payload). The legacy quirk where showAuthors/showReplies
  defaults stick only to object-form collection renderers is preserved in
  `decodeWithDefaults` and pinned by test.
- **D18: Validated-spec views strip unknown spec keys.** `SurfaceSpecSchema`
  accepts unknown keys but its parsed output drops them (zod default).
  Consumers that persist or re-encode the spec must carry the RAW value
  from the decoded payload, not the validated view — flagged for the
  packages/shared persistence work.
- **D19: Reducer input contract.** Only posts with a numeric `sequenceNum`
  fold (unsynced optimistic posts and replies never do, so every client
  folds the same server-sequenced set). A post may carry multiple surface
  entries; they process in blob order within the post's sequence slot.
  `hostShip` is a caller-supplied parameter derived from the channel id,
  never from post/blob content. The reducer consumes the shared
  `parsePostBlob` union parser (playbook rule 2), filtering to entries
  whose `surfaceId` matches the spec.
- **D20: State cap enforcement is op-granular and uniform.** §7 says
  "further `append`s refused" at 128 KB; sets can grow state the same way,
  so ANY op whose result exceeds the cap is refused (op skipped, state
  unchanged, `stateFull` flag set for the "dashboard full" UI), and later
  shrinking ops still apply. Uniform across clients ⇒ still convergent.
  Size is re-measured per applied op (O(state) per op) — fine at these
  caps; optimize only if profiling ever says so.
- **D21: packages/shared suite is not runnable in this environment** —
  `better-sqlite3`'s native binding was built for a different Node ABI
  (`ERR_DLOPEN_FAILED`, NODE_MODULE_VERSION 132 vs 127) and `pnpm rebuild`
  didn't repair it. The failure predates and is untouched by this session's
  changes (it occurs at module load). Consumer-side verification of the
  decode change (`sync.test.ts`) needs CI or a fixed local env.

## Notes for M1's remaining consumers

Everything below consumes `packages/api/src/client/surface/` (exported from
`@tloncorp/api`'s client barrel) and
`StructuredChannelDescriptionPayload` in `channelContentConfig.ts`.

### packages/shared (persistence + sync)

- **Persist the RAW spec, validate at read.** `decode(description)` returns
  the payload with `surfaceSpec` untouched; `SurfaceSpecSchema.parse`
  strips unknown keys (D18), so the persisted channel field should carry
  the raw value (e.g. as JSON text) and readers validate through
  `StructuredChannelDescriptionPayload.surfaceSpec(decoded)`.
- **Edit paths become decode→modify→encode.** `updateChannel`
  (`packages/shared/src/store/channelActions.ts:407`) must decode the
  _current on-ship description_ with the now-lossless `decode`, overwrite
  only the fields being edited, and re-encode — never rebuild from known
  fields. The required integration test: title/privacy/content-config edits
  each leave `surfaceSpec` byte-identical.
- **Reducer wiring.** `reduceSurface({ spec, hostShip, posts })`; `posts`
  needs only `{ authorId, sequenceNum, isEdited, isDeleted, blob }` —
  `db.Post` satisfies this structurally. `hostShip` comes from
  `parseGroupChannelId(channelId).host`, never from post content.
- **Bundle cache** keys off `spec.bundle.sha256`
  (`SurfaceBundleRefSchema`); verify-on-read, LRU.

### packages/surface-shell + renderer (packages/app)

- Renderer states map from reducer output: `status: 'migration-pending'` →
  the migration-pending screen; `stateFull: true` → "dashboard full";
  bundle fetch/verify and `shellVersion` gating happen host-side around
  `spec.bundle` before any sandbox involvement.
- Invokes post via
  `sendPost({ channelId, kindTail: 'surface/event', blob:
JSON.stringify([entry]), ... })` where `entry` is a `surface-event`
  invoke arm tagged with the **rendered** `specRevision`. Writers are
  responsible for including fallback Story content so pre-surface clients
  degrade to inert chat messages (plan §4) — the entry schemas don't
  enforce that.
- `reduceSurface` is a batch fold; re-running on each post-set change is
  cheap at the §7 caps. An incremental fold API is a deliberate seam for
  later, not built now.

### Interfaces I'm least sure about (flag for review)

- The `Op` wire shape (D9) — the plan never pins it; `tlon-skill` and
  templates must adopt this shape or change it _here_ first.
- `reduceSurface`'s result carries `baseSnapshotSeq` and fold counters; the
  §6 hydration loop may want more (e.g. newest folded seq for the
  watermark). Extend the result type rather than recomputing outside.
- Author identity is compared verbatim (`authorId === hostShip`); callers
  must pass canonical `~ship` strings. No desig/case normalization happens
  in the reducer.
- Multiple surface entries per post are folded in blob order (D19). If one
  entry per post should be the rule, enforce it at the writers, not the
  reducer.
