---
id: TASK-6
title: Open the channel renderer registry with graceful fallback for unknown views
status: In Progress
assignee:
  - '@james@tlon.io'
created_date: '2026-08-19 13:47'
updated_date: '2026-08-20 00:29'
labels:
  - workspaces
  - platform
  - renderer
milestone: m-3
dependencies: []
references:
  - PLAN.md
  - packages/api/src/types/models.ts
  - packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx
  - packages/api/src/client/channelContentConfig.ts
  - docs/tlon-apps/interactive-surfaces.md
  - .backlog/docs/doc-1 - Workspace-capability-matrix-and-hero-wedge-decision.md
modified_files:
  - packages/api/src/client/channelContentConfig.ts
  - packages/api/src/types/analytics.ts
  - packages/api/src/__tests__/channelContentConfig.test.ts
  - packages/app/ui/contexts/componentsKits/channelViews.ts
  - packages/app/ui/contexts/componentsKits/channelViews.test.ts
  - packages/app/ui/contexts/componentsKits/componentsKits.tsx
  - packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx
  - packages/app/ui/contexts/componentsKits/index.ts
  - packages/app/ui/components/Channel/UnsupportedViewNotice.tsx
  - packages/app/ui/components/Channel/DraftInputView.tsx
  - packages/app/ui/components/Channel/DraftInputView.test.tsx
  - packages/app/ui/components/Channel/PostView.tsx
  - packages/app/ui/components/Channel/PostView.test.tsx
  - packages/app/ui/components/PostCollectionView.tsx
  - packages/app/ui/components/PostCollectionView.test.tsx
  - packages/app/fixtures/Channel.fixture.tsx
  - docs/tlon-apps/channel-views.md
  - CLAUDE.md
priority: low
type: enhancement
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md notes the renderer architecture is conceptually ready for extension but its channel types (packages/api/src/types/models.ts) and component registry (packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx) are closed and hard-coded. The platform milestone requires opening the registry so kits can contribute views, with graceful fallback when a client encounters a view it does not recognize.

This unblocks kit-defined surfaces without requiring an app release per new view type.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A kit or workspace descriptor can declare a view/renderer that is not hard-coded in the static registry
- [x] #2 Encountering an unknown view renders a graceful fallback (not a crash or blank screen) with a path to upgrade
- [x] #3 Existing hard-coded channel renderers continue to work unchanged
- [x] #4 Tests cover registered, unregistered, and malformed view declarations
- [x] #5 docs/ describes how a kit registers a view and what the fallback contract is
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Two decisions need you, both in §4 and §3. Everything else follows from what is already in the tree.

### 1. What is actually there

The "registry" is three maps in one context, resolved at three sites, and the unknown-id behaviour differs at each.

`ComponentsKitProvider.tsx:28-47` builds three module-level consts and hands them through `ComponentsKitContext`. `componentsKits.tsx:69-79` types them as `Partial<{[Id in CollectionRendererId]: …}>`, keyed by unions that `makeEnum` derives from three `as const` spec objects in `packages/api/src/client/channelContentConfig.ts:45-131`. So "closed and hard-coded" is precise in two distinct ways: the **key space** is a closed union in `packages/api`, and the **value space** is a const in `packages/app`. There is no registration function anywhere.

Current behaviour when a channel names an id nothing has registered:

| site | file | today | verdict |
|---|---|---|---|
| collection | `PostCollectionView.tsx:33-58` | falls through `fallbackRendererIdForChannelType` → `ListPostCollection` | graceful, silent |
| content | `Channel/PostView.tsx:16-57` | falls through to `switch (channel.type)` → the built-in for that type | graceful, silent |
| draft input | `Channel/DraftInputView.tsx:27-45` | `if (InputComponent)` with no `else` → the component returns `undefined` | **renders nothing** |

The draft-input case is the actual defect behind AC #2. React 19 permits a component returning `undefined`, so it is not a crash — the composer just vanishes, and `Channel/index.tsx:929-939` will not show `ReadOnlyNotice` in its place because `draftInputType` is non-null. You get a channel you can read and cannot post to, with no explanation.

Three more things worth knowing before touching this:

- **Ids arrive unvalidated.** `StructuredChannelDescriptionPayload.decode` carries a standing `// TODO: This should be validated - we'll be deserializing untrusted data`. It fills missing keys with chat defaults but never checks that an id is known, so arbitrary strings from any client or agent reach all three sites. That is the mechanism AC #1 needs — it is already open on the wire.
- **A latent crash.** `PostView`'s `switch (channel.type)` has no `default`, so an out-of-union `channel.type` yields `undefined` and React throws on `<undefined>`. Guarded today only by `getChannelType` (`urbit/utils.ts:147-169`) coercing unknown nest kinds to `'chat'`. Cheap to close while here.
- **A documented precedence tier that does not exist.** `channelContentConfig.ts:152` says the channel config "does not take precedence over any mapping specified in a post's metadata", but `PostMetadata` (`types/post.ts:86`) is `title | image | description | cover` — there is no per-post renderer override. The docs in AC #5 should not document that tier.

Also: `allCollectionRenderers` / `allDraftInputs` / `allContentRenderers` are exported from `packages/shared` and have **no consumers** outside `makeEnum`. Their `displayName` and `parametersSchema` metadata is dead today, which makes them a natural home for registry entries rather than something to work around.

### 2. What "opening the registry" must not mean

- **Not opening `ChannelType`.** `channel.type` has 165 references across 54 files. Adding a union member is a cross-cutting change and is TASK-7's job; PLAN.md lists them as separate platform items. The task description quotes `models.ts:46` because PLAN.md's sentence bundled both, but every acceptance criterion here is about views and the registry.
- **Not kits shipping React components.** PLAN.md's platform milestone explicitly orders replay, snapshots, upgrade and recovery *before* arbitrary mini-app code — TASK-20 and TASK-21. Note the mini-app prototype (`385fbe9f0b`) never touched this registry at all; it went through `BlockRenderer`.

So the honest deliverable: **declaration** is open (a channel can name a view no client knows), **resolution** is open (a view can be registered without editing a union in `packages/api`), and every unresolved view degrades visibly. Implementations still ship in an app release until TASK-20/21. The docs should say that plainly rather than implying the description's "without requiring an app release per new view type" covers both halves — it covers the declaration half.

### 3. Work

**a. Open the key space** (`packages/api/src/client/channelContentConfig.ts`). Change the three exported *types* from `ValuesOf<typeof X>` to `ValuesOf<typeof X> | (string & {})`. The enum-like objects stay, so `DraftInputId.chat` and literal autocomplete keep working while any string is accepted. Widen the three context map types in `componentsKits.tsx` from `Partial<{[Id in …]}>` to `Readonly<Record<string, …>>`; all three consumers already index by a plain string.

**b. Add a registration API** (`packages/app`). A `defineChannelView()` helper producing `{id, displayName, collection?, content?, input?}`, and an optional `views` prop on `ComponentsKitProvider` that merges registrations over the built-ins. Built-ins win on collision and log a warning — a registered view must not be able to shadow `chat`.

**c. Make the fallback uniform and visible.** A `resolveChannelView()` helper returning `{component, resolved: boolean}` so each site knows whether it fell back. Then:
- **draft input** — render a notice instead of nothing.
- **collection** — keep rendering `ListPostCollection`. Posts staying readable *is* the graceful degradation; blanking the channel to show a notice would be worse.
- **content** — keep the type-based built-in and add a `default:` to the switch so an out-of-union type cannot crash.
- one `UnknownChannelViewSeen` event in `packages/api/src/types/analytics.ts`, following `ProtocolMismatchNoticeSeen:119`.

`ReadOnlyNotice.tsx` is the precedent for the notice: an `Info` icon, `$tertiaryText`, a `testID`, and analytics on first sight. Its `channel-mismatch` copy ("Your node's version of the Tlon app doesn't match…") is already the version-skew tone AC #2 wants, and the "path to upgrade" in this codebase is that kind of sentence, not a store deep-link — `postContent.ts:567` degrades unknown blob entries to a plain "Upgrade your app to see this post" blockquote.

**Decision one:** a new sibling component (`UnsupportedViewNotice`) or a new `type` on `ReadOnlyNotice`? **I lean to a sibling.** `ReadOnlyNotice`'s vocabulary is all permission and protocol states; "this channel wants a view you do not have" is neither, and its `type` union is already seven members.

**d. Validate at the parse boundary — but preserve the id.** Close the `decode` TODO by checking the shape of `channelContentConfiguration`, and note the one trap: decode must **not** normalize an unknown id to `chat`. If it does, the render layer can never tell a custom view was requested and the notice in (c) becomes impossible. This is the same shape as the post-blob parser, which preserves the fact of non-recognition as an explicit `unknown` entry rather than dropping it.

### 4. The declaration half — decision two

AC #1 says "a kit **or workspace descriptor** can declare a view". Three candidate mechanisms; only one works end to end today.

- **(a) The channel's `contentConfiguration`.** Already the mechanism, already replicates (JSON inside the channel description), already read at all three sites, already accepts arbitrary strings. Nothing to build on the wire. What is missing is only that nothing *writes* a custom one: `createChannel` accepts `contentConfiguration` but no caller passes a non-built-in, and `%kits` creates its channels with a plain-text description (`desk/app/kits.hoon:122`, with `place-kind:256` mapping `%chat/%notebook/%gallery` only).
- **(b) The kit manifest's places.** `placeKindSchema` (`packages/tlon-kits/src/manifest.ts:36`) and Hoon `$place.kind` (`desk/sur/kits.hoon:24`) are both closed three-way unions, re-asserted at `desk/lib/kits-json.hoon:174`. An optional `view` per place touches: the zod schemas (on-disk + wire), `toWireManifest`, `kits/SCHEMA.md`, `desk/sur/kits.hoon`, `desk/lib/kits-json.hoon`, and the installer — which would mean re-implementing `StructuredChannelDescriptionPayload.encode` in Hoon so the created channel carries the config.
- **(c) A workspace descriptor.** Does not exist. That is TASK-8.

**I recommend (a) for this task**: ship the registry, the fallback contract and the docs, and verify AC #1/#2 against a channel whose `contentConfiguration` names an unregistered view. Open the kit-manifest `view` field as its own change inside **TASK-15**, which already owns the kit format. That keeps TASK-6 client-only and shippable, and avoids duplicating a client-side JSON format into Hoon for a field no kit yet uses.

If you want AC #1 to read literally as "a *kit* declares it", say so and I will include (b) — roughly +150 lines across five files plus a desk test, and it needs its own decision about whether the installer or the client writes the channel config.

### 5. Tests (AC #4)

- **`packages/api`** — new `channelContentConfig.test.ts`: `decode` **preserves** an unknown id rather than normalizing it (the load-bearing case), fills missing keys, tolerates malformed and non-JSON descriptions; plus a `resolveChannelView` table over registered / unregistered / malformed declarations. There is no test file for this module today; the only existing coverage is the round-trip at `sync.test.ts:648-674`.
- **`packages/app`** — vitest + `react-test-renderer` following `Wayfinding/PurposePane.test.tsx`: `DraftInputView` renders the notice for an unknown input id and the input for a known one; `PostCollectionView` yields `ListPostCollection` for an unknown collection id; `PostView` does not throw for an out-of-union `channel.type`.
- **cosmos** — extend `Channel.fixture.tsx`, which already renders a whole `Channel` from a `db.Channel`, with one whose `contentConfiguration` names an unknown view. That exercises all three sites in a real render.

### 6. Docs (AC #5)

New `docs/tlon-apps/channel-views.md`: the three-id model, how to register a view, resolution precedence (channel config → channel type → built-in default — and *not* the post-metadata tier, which does not exist), the per-site fallback contract, and an explicit statement that declaring a view needs no app release while implementing one does until TASK-20/21. Add a pointer in CLAUDE.md beside the existing post-blobs one.

### Verification

`pnpm -r tsc`, `packages/api` and `packages/app` vitest, prettier on the diff, and cosmos for the fixture. Under recommendation (a) this is client-only — no desk, mark, or ship work. Worth knowing: `packages/editor/dist` must be built for `packages/app` to typecheck in a fresh worktree (`pnpm --filter '@tloncorp/editor' build`).

### What this does not do

- Does not open `ChannelType` (TASK-7) or let kits ship UI code (TASK-20/21).
- Does not add a UI for authoring a custom content configuration; there is none today, and verification goes through the fixture.
- Under recommendation (a), does not make a *kit manifest* able to name a view — carried to TASK-15.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**The registry is closed in two places, not one.** The key space is a closed union in `packages/api` (`channelContentConfig.ts:45-131`, three `as const` spec objects fed through `makeEnum`); the value space is three module-level consts in `packages/app` (`ComponentsKitProvider.tsx:28-47`). `componentsKits.tsx:69-79` types the context maps as `Partial<{[Id in CollectionRendererId]: …}>`, so even app-local code cannot add a view without editing the api-side union. There is no registration function anywhere in the tree.

**Unknown ids already reach the render layer unvalidated.** `StructuredChannelDescriptionPayload.decode` carries a standing `// TODO: This should be validated - we'll be deserializing untrusted data`; it merges chat defaults for missing keys but never checks that an id is known. The decode sites are `chatApi.ts:365` and `groupsApi.ts:2094`/`2127`. So the declaration half of AC #1 is *already* open on the wire — what is missing is a writer and a resolution story.

**Only one of the three resolution sites actually misbehaves.** Collection (`PostCollectionView.tsx:33-58`) falls back to `ListPostCollection`; content (`PostView.tsx:16-57`) falls through to `switch (channel.type)`. Both are silent but safe. Draft input (`DraftInputView.tsx:27-45`) is `if (InputComponent)` with no else, so the component returns `undefined` and React 19 renders nothing — the composer vanishes with no notice, and `Channel/index.tsx:929-939` will not substitute `ReadOnlyNotice` because `draftInputType` is non-null. That is the AC #2 defect.

**A latent crash worth closing while here.** `PostView`'s switch has no `default`, so an out-of-union `channel.type` produces `undefined` and React throws. Guarded today only by `getChannelType` (`urbit/utils.ts:147-169`) coercing unknown nest kinds to `'chat'`.

**`channel.type` must stay closed here.** 165 references across 54 files. TASK-7 owns adding a member.

**Kits cannot ship code, and the prototype never used this registry.** PLAN.md's platform milestone orders replay/snapshots/upgrade/recovery before arbitrary mini-app code (TASK-20/21). The mini-app demo `385fbe9f0b` added `MiniAppPost`/`MiniAppScene`/`miniAppRuntime` and touched `BlockRenderer.tsx` by 3 lines — it never went near `ComponentsKitProvider`. So there is no prior art for registry extension to lean on.

**The kit manifest cannot name a view today.** `placeKindSchema` (`manifest.ts:36`) and Hoon `$place.kind` (`desk/sur/kits.hoon:24`) are both `chat|notebook|gallery`, re-asserted in `kits-json.hoon:174`, and `desk/app/kits.hoon:122` creates each place's channel with a plain-text description — so nothing writes a `StructuredChannelDescriptionPayload`. Opening that path is a five-file cross-stack change including Hoon JSON encoding; see plan §4 for the recommendation to carry it to TASK-15.

**Two stale/dead things found in passing.** `channelContentConfig.ts:152` documents a post-metadata renderer override that does not exist (`PostMetadata` is `title|image|description|cover`), so the AC #5 docs must not describe that precedence tier. And `allCollectionRenderers`/`allDraftInputs`/`allContentRenderers` are exported from `packages/shared` with no consumers outside `makeEnum` — their `displayName`/`parametersSchema` metadata is currently dead.

**Precedents to follow rather than invent.** `ReadOnlyNotice.tsx` for the notice (Info icon, `$tertiaryText`, testID, analytics on first sight) and its `channel-mismatch` copy for the version-skew tone; `postContent.ts:567` for the "Upgrade your app to see this post" degradation; `AnalyticsEvent.ProtocolMismatchNoticeSeen` (`analytics.ts:119`) for the event shape; `Wayfinding/PurposePane.test.tsx` for the component-test harness; `Channel.fixture.tsx` for a full-channel cosmos fixture.

**Decision one settled: a sibling component.** The fallback notice will be a new `UnsupportedViewNotice` rather than an eighth `type` on `ReadOnlyNotice`, whose vocabulary is permission and protocol states.

Additional research bearing on decision two (who writes the channel's content configuration):

**The ship-side installer cannot create the hero kit's artifact place at all.** `desk/app/kits.hoon:256` maps place kinds onto `%channels` kinds (`%chat/%diary/%heap`) and the file has zero references to notes. TASK-13 AC #2 wants a durable artifact place backed by %notes, and notes channels are not %channels channels — `createNotesChannel` goes through `api.notes.createGroupNotebook` + `addChannelListingToGroup`, client-side. So client code is already going to create kit places regardless of this task. `placeKindSchema` (`manifest.ts:36`) has no `notes` member either, so the place vocabulary needs extending for TASK-13 independently of TASK-6.

**Blast radius of the manifest route (option b).** `manifest.ts` (on-disk + wire zod), `toWireManifest`, `kits/SCHEMA.md`, `desk/sur/kits.hoon` `$place.kind`, the `?=(?(%chat %notebook %gallery) t)` assertion at `kits-json.hoon:174` plus a structured-description encoder, `desk/app/kits.hoon`, and `desk/tests/app/kits.hoon:102`, which asserts the exact `create-channel` poke and would have to change. Plus a mark question: `kits-action-1` carries the manifest, so a new place field means `kits-action-2` or a tolerant decoder.

**Format-ownership cost of option b.** It makes the backend emit `StructuredChannelDescriptionPayload`, a client-invented JSON squat in the channel description introduced 2024-09-28 (`1f9ff6d7d6`) with no spec doc and a standing validation TODO. Encoding it from Hoon promotes a client convention into a backend contract.

**Where option b is genuinely better.** The view lands atomically with channel creation, ship-side, needing no client present and no admin permission. Option (a)'s writer is a client, so a crash between channel creation and config write leaves a plain chat channel, and `updateChannel` requires group admin — true for the onboarding hero path (the provisioning client is the owner) but not for installing a kit into a group you do not administer. TASK-16 AC #3/#5 already owns that resume-or-recover problem.

**Upgrade obligation.** Under (b), a kit version that changes a place's view leaves existing installs on the old view unless the installer rewrites channel descriptions; there is no kit upgrade path today (TASK-21). Under (a) the same gap lands on client code that will already have a reconcile step.

Neither option forecloses the other: `contentConfiguration` stays the single runtime source of truth either way, so the registry and fallback work is identical and the writer question is separable.

**Decision two settled: option (a).** The channel's `contentConfiguration` is the declaration mechanism. This task stays client-only: no Hoon, no mark change, no desk-test churn. The kit-manifest `view` field is carried to TASK-15, which already needs to extend the place vocabulary for TASK-13's notes-backed artifact place.

Consequence for AC #1, stated up front so the criterion is not read as more than it is: what gets verified here is that **a channel** can declare a view no client has registered, and that the view resolves if registered and degrades visibly if not. "A *kit manifest* declares it" is TASK-15's.

## Implementation

Client-only, per decision (a). No Hoon, no mark change, no desk-test churn.

### The registry

The key space was closed in `packages/api`: the three id types were `ValuesOf<typeof X>`, so app-local code could not register a view without editing an enum in another package. They are now `OpenId<Known> = Known | (string & {})` — built-in literals keep autocomplete, any string is accepted. The three context maps went from `Partial<{[Id in CollectionRendererId]: …}>` to `Readonly<Record<string, …>>`.

`channelViews.ts` holds the new pieces: a `ChannelView` type (`{id, displayName, collection?, content?, input?}`), `resolveChannelView`, and `mergeChannelViews`. `ComponentsKitProvider` takes an optional `views` prop and folds registrations over the built-ins, which win on collision with a logged warning — a registered view must not be able to replace `chat` and take the composer out from under every conversation.

A view may fill any subset of the three slots, so a channel naming one id in several `contentConfiguration` fields resolves each from that one entry. The wire format stays three independent ids.

### The distinction the whole contract rests on

`resolveChannelView` returns `{component, resolved, declaredId}`. `resolved` is false **only** when a view was declared and nothing registered it. An absent declaration resolves *true* — falling back to the channel-type default is the intended path for essentially every channel that exists, and treating it as a degradation would put the upgrade notice on all of them.

Same reason `decode` must not normalize an unrecognized id to `chat`: that would erase the difference between "a view we don't have" and "no view declared," and the notice could never fire. There is a test asserting exactly this, and a comment at both sites, because it is the non-obvious constraint someone tidying this code would break first.

### Per-slot behavior

- **Draft input** — the real defect: `if (InputComponent)` with no else, so an unregistered id made the component return `undefined` and React 19 rendered nothing. A channel you could read, could not post to, with no explanation. Now renders `UnsupportedViewNotice` and fires `AnalyticsEvent.UnknownChannelViewSeen`.
- **Collection** — unchanged behavior, now deliberate: `ListPostCollection`, or the channel-type fallback for notes. Posts staying readable *is* the degradation here; a notice would mean blanking the channel. Dev log only.
- **Post content** — the channel-type built-in. Dev log only.

### Two latent bugs closed while here

`PostView`'s `switch (channel.type)` had no `default`, so an out-of-union type returned `undefined` and React threw on `<undefined>`. Guarded only by `getChannelType` coercing unknown nest kinds to `'chat'`. Now defaults to `ChatMessage`, with a test.

`decode`'s standing `// TODO: This should be validated` is closed. A malformed renderer-id field defaults to its built-in individually. A `channelContentConfiguration` that isn't an object is now *dropped* while the `description` survives — the old code threw, which sent the whole payload down the catch path and surfaced raw JSON to the user as the channel description. Normalizing every field to object form also fixed a dead branch where the collection `showAuthors`/`showReplies` defaults were written to a throwaway object for bare-string configs (behaviorally nil, since the read site ANDs them with the caller's prop).

### Verification

`tsc --noEmit` clean across api, shared, app, ui, tlon-kits, openclaw, tlon-skill. Tests: api 812, app 501, shared 442 — all passing, 40 of them new (25 decode, 11 resolver/merge, 4+2+4 across the three slots). eslint clean on every touched file; prettier applied.

Cosmos on web (`Channel.fixture.tsx` → `unknownView`) — the check that catches browser-only module-eval failures both `tsc` and vitest miss: the channel renders, posts render normally, and the notice sits where the composer would be. Confirmed by screenshot and by the a11y tree. The console errors present (accessibilityRole/State prop warnings, a 404, an unhandled promise, and cosmos's "Renderer error" toast) are identical on the untouched `chat` fixture, so they are pre-existing and unrelated.

### Scope, stated plainly

AC #1 is verified as **a channel** declaring a view no client has registered. A *kit manifest* declaring one is TASK-15's, along with the place-vocabulary extension TASK-13 needs for its notes-backed artifact place.

And the registry is open for *declaration*, not for *implementation* — views are React components compiled into the app until TASK-20/21 allow signed kit code. `docs/tlon-apps/channel-views.md` says both out loud rather than leaving the task description's "without requiring an app release per new view type" to be read as covering both halves.

One thing not done: no UI exists for authoring a custom content configuration, so there is no way to produce one of these channels from inside the app. Verification went through the cosmos fixture. Whoever builds the writer (TASK-13/16 provisioning) will be the first real producer.
<!-- SECTION:NOTES:END -->
