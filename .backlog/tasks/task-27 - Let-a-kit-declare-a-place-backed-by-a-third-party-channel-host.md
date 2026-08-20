---
id: TASK-27
title: Let a kit declare a place backed by a third-party channel host
status: To Do
assignee: []
created_date: '2026-08-20 15:42'
updated_date: '2026-08-20 15:45'
labels:
  - workspaces
  - kits
  - platform
  - hoon
milestone: m-1
dependencies:
  - TASK-2
  - TASK-7
references:
  - PLAN.md
  - desk/app/kits.hoon
  - packages/tlon-kits/src/manifest.ts
  - kits/SCHEMA.md
  - docs/backend/channel-hosts.md
priority: high
type: feature
ordinal: 2700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A workspace needs a durable artifact store, but a kit cannot currently declare one that is not deprecated.

A kit's place vocabulary is `chat | notebook | gallery`, and %kits instantiates every place with a single create poke to %channels. So the only durable-document option a kit can name is `notebook`, which becomes a %diary channel — and %diary is deprecated and replaced by %notes, with an owner migration path already shipped. Building the hero workspace on it would mean shipping an artifact store that needs migrating on day one.

Extend the vocabulary so a kit can name a place backed by a third-party channel host, and teach install to create it through that host rather than through %channels. %notes is the case that unblocks the meal-planning kit; %apps (structured app-channel state) is the same seam and should not require a second extension.

This is the backend half of the workspace's artifact store. The kit content that uses it is tracked separately and is blocked on this.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A kit manifest can declare a place backed by %notes, and the place vocabulary and its host mapping are documented in kits/SCHEMA.md
- [ ] #2 Installing a kit that declares a notes place creates that channel in the workspace group and records its nest in the group blob's places map under the kit's abstract place name
- [ ] #3 A group member other than the installer can read and write the created place, inheriting the group's permissions rather than a separate grant
- [ ] #4 A kit declaring a place kind this build does not support is rejected at install with a clear error, rather than partially installing or silently creating a different channel type
- [ ] #5 Existing kits declaring only chat, notebook, or gallery places install exactly as before, with no change to the nests they produce
- [ ] #6 Adding a further host-backed place kind requires no new branch in the install path beyond its host mapping
- [ ] #7 Agent (Hoon) tests cover install with a notes place, the unsupported-kind rejection, and the unchanged behaviour for existing place kinds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Two decisions — §2 (how a notes nest becomes predictable) and §3 (whether to fix an adjacent collision bug I found). §2 is the substantive one.

### 1. The real obstacle is nest predictability, not the enum

Adding `notes` to `placeKindSchema` is one line. The actual problem is upstream of that.

`+install` (`desk/app/kits.hoon:111-136`) works in one event, in this order:

1. Build the `nests` map **synchronously** from the place names: `[name.p [(place-kind kind.p) our.bowl name.p]]`.
2. Poke `%channels` once per place with `%create`.
3. Write the blob and the ledger from that map.

Step 3 depends on step 1, so **the nest has to be knowable before the host has done anything.** That holds for `%channels` because the caller supplies the channel name. It does not hold for `%notes`: `se-init` derives the flag as `[our.bowl (slugify title nid)]` where `nid` is `+(next-id)`, an internal counter (`notes.hoon:1749-1754`). `%kits` cannot predict it.

Worse, it cannot easily learn it either. `%create-group-notebook` returns the new notebook's summary through the **v1 request envelope** — `finalize-request` against a request id (`notes.hoon:1666-1681`) — which is the HTTP-facing path. A plain agent poke gets a poke-ack with no payload, so an acking `%kits` would know only that it worked, not what got made.

**One thing that is already right:** `%apps` (TASK-7) takes `name=term` on `%create` and its flag is `[our.bowl name]`. So an app place is already predictable and needs no backend change. `%notes` is the only outlier.

### 2. Decision — how the notes nest becomes knowable

- **(a) Let the caller name it.** Add an optional caller-supplied name to notes' group-notebook creation, used instead of the slugified title when present. `%kits` then predicts the nest exactly as it does today, and the install path stays *compute nest → poke host → write blob* with only **which host and which mark** varying by kind. That is precisely what AC #6 asks for, and it makes `%apps` work for free.
- **(b) Two-phase install.** Poke `%notes`, then learn the flag from a response and patch the blob afterwards. `%kits` already has `/install/place/...` wires and an `on-agent` arm for them, so there is a hook — but a poke-ack carries no flag, so it would need a scry-and-guess ("which notebook appeared since?") or a subscription. Both are races, and the blob would be briefly wrong, which matters because the blob is what every reader keys off.
- **(c) Keep `notes` out and use `%apps` for the artifact store instead.** Tempting — `%apps` is already predictable and I built it — but an app channel holds one opaque JSON document, not a set of documents. A weekly meal plan wants a document per week, which is what a notebook is for. Wrong tool.

**I recommend (a).** It is a small, additive change to one `%notes` action; it keeps a single install path rather than one path per host; and it makes AC #6 true by construction instead of by careful branching. (b) trades a backend change for a race and a temporarily-wrong blob, which is a bad trade for the thing everything else reads.

The caveat: caller-named creation can collide, where slugify-with-counter never does. `%apps` already handles that by asserting absence (`?< (~(has by docs) chan)`), and `%channels` does the same (`channels.hoon:1968`). So collision handling is a real requirement — which leads straight to §3.

### 3. Decision — an adjacent bug: installing the same kit twice collides

Found while reading the install path, and it is squarely in the code this task touches.

`%kits` names each created channel with the **bare abstract place name**: `[(place-kind kind) our.bowl name.i.ps]`, so book-club's `discussion` place becomes `chat/~host/discussion`. Confirmed by `desk/tests/app/kits.hoon:38` — `club-nest` is `[%chat our-ship %discussion]`.

But `kits/SCHEMA.md`'s own example shows `"discussion": "chat/~host/book-club-discussion-1234"` — suffixed and unique. **The spec and the code disagree**, and `%channels` asserts `?< (~(has by v-channels) nest)`. So installing the same kit into a second group on one ship nacks the place creation, and `+install` logs the nack rather than unwinding (v1 accepts optimistic install), leaving a group whose blob names channels that do not exist.

- **(a) Fix it here.** Name places as SCHEMA.md already specifies — kit id plus place name plus a disambiguator. It is a few lines in `+install`, it makes the code match its own spec, and caller-named notes creation needs collision-safety anyway so I would be solving it once instead of twice.
- **(b) Leave it, file it separately.** Keeps this task's diff to the vocabulary. But then I am adding a *second* caller-named host to a naming scheme I know is broken, which feels like the wrong moment to look away.

**I recommend (a)**, and I would put the naming in one helper so both the `%channels` and host-backed paths use it. If you would rather keep this task narrow, say so and I will open it as its own task and note the interaction.

### 4. Work

- **`packages/tlon-kits/src/manifest.ts`** — `placeKindSchema` gains `notes`. Worth noting it stays a closed enum here, unlike the open ids elsewhere: a kit naming a place kind the installer cannot create should be rejected at validation, not degraded, because a half-instantiated workspace is worse than a refused install (AC #4).
- **`desk/sur/notes.hoon` + `desk/app/notes.hoon`** — an optional caller-supplied name on group-notebook creation. Additive; absent keeps today's slugify behaviour, so nothing existing changes.
- **`desk/app/kits.hoon`** — the shape of the change matters more than its size:
  - a `+place-host` arm mapping a place kind to `[host mark]` rather than only to a `%channels` kind, so `+install` builds one card per place from a table instead of a branch. That is AC #6.
  - refuse the whole install on an unknown kind, before any card is emitted (AC #4). `+install` currently emits everything in one event, so refusing early is the natural way to be atomic here.
  - the naming helper from §3, if you take (a).
- **`kits/SCHEMA.md`** — the vocabulary, the host each kind resolves to, and the naming scheme. Its `places` example is currently wrong about naming; that gets corrected either way.

Nothing on the client beyond the enum: `places` in the blob is already `Record<string, string>` (abstract name → nest), and TASK-8's `workspacePlace` reads it without caring what kind it is.

### 5. Tests — AC #7

`desk/tests/app/kits.hoon` already covers install for a fixture kit, so this extends it:

- **Install with a notes place** — the create poke goes to `%notes` with the right mark and the caller-supplied name; the blob records `notes/<host>/<name>`.
- **Unknown place kind refuses the whole install** — no cards, no ledger entry, no blob write. The atomicity is the point: a partially-installed workspace is the bad outcome.
- **Existing kinds unchanged (AC #5)** — the chat/notebook/gallery assertions in the current test must pass untouched. That is the regression guard and it already exists.
- **Two installs of one kit do not collide**, if §3 lands as (a).
- **AC #3 (a member can read and write the place)** — the honest limit: `%notes` defers reads to the group's `can-read`, and `desk/tests/app/notes.hoon` already has `can-read-allow`/`can-read-deny` fixtures proving that gate. So I can assert the created notebook is group-bound with the right readers, which is the thing `%kits` controls. Whether a second ship can then actually read it is `%notes`' existing behaviour, already tested there — I will not re-prove it and will say so rather than implying a two-ship test.

Client-side: `kits.test.ts` gains a manifest with a notes place, asserting it validates and round-trips through `toWireKit`.

### 6. Verification

`pnpm -r tsc`, the tlon-kits suite, prettier. Then the Hoon really has to build and run: `-test /=appsdev=/tests/app/kits` on a fakezod. My notes carry the recipe and the pier is already up — the one that matters is `rsync -a` into a mount being a silent no-op without a `touch`, and needing a `-t` attached pier to read the failures at all.

### 7. What this does not do

- **No kit content.** The meal-planning kit is TASK-13, which depends on this.
- **No `apps` place kind.** `%apps` is already compatible, but nothing needs an app place yet; AC #6 is about the seam being there, and I would rather add the kind when something uses it than ship an untested vocabulary entry.
- **No schedule `enabled` flag.** That is TASK-13's, and unrelated to places.
- **No install unwind.** v1 is optimistic-install by design (`docs/kits.md`); refusing *before* emitting is in scope, rolling back after is not.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**The obstacle is nest predictability, not the enum.** `+install` (`desk/app/kits.hoon:111-136`) builds its `nests` map synchronously from place names, pokes `%channels` once per place, then writes the blob and ledger from that map — all in one event. The blob write depends on knowing the nest up front, which works only because the caller supplies the channel name.

**`%notes` assigns its own flag, so `%kits` cannot predict it.** `se-init` (`notes.hoon:1749-1754`) derives `[our.bowl (slugify title nid)]` where `nid` is `+(next-id)`, an internal counter. And `%kits` cannot easily *learn* it: `%create-group-notebook` returns the new notebook's summary through the v1 **request envelope** (`finalize-request` against a request id, `notes.hoon:1666-1681`), which is the HTTP-facing path. A plain agent poke gets a poke-ack with no payload.

**`%apps` is already compatible and needs no change.** TASK-7's `%create` takes `name=term` and its flag is `[our.bowl name]` — caller-named and therefore predictable, exactly like `%channels`. So `%notes` is the single outlier, which is what makes "let the caller name it" the uniform fix rather than a special case.

**Both existing hosts already assert against collision**, which is what caller-named creation requires: `%apps` does `?< (~(has by docs) chan)`, and `%channels` does `?< (~(has by v-channels) nest)` (`channels.hoon:1968`).

**An adjacent bug, found in the code this task touches: installing the same kit twice collides.** `%kits` names each place with the bare abstract place name — `[(place-kind kind) our.bowl name.i.ps]` — so book-club's `discussion` becomes `chat/~host/discussion`. Confirmed at `desk/tests/app/kits.hoon:38` (`club-nest` = `[%chat our-ship %discussion]`) and in the emitted card at `:102`. But `kits/SCHEMA.md`'s own `places` example shows `"chat/~host/book-club-discussion-1234"` — suffixed and unique. **The spec and the code disagree.** Since `%channels` asserts absence, a second install of the same kit on one ship nacks the place creation, and `+install` logs the nack rather than unwinding (v1 is optimistic-install), leaving a group whose blob names channels that do not exist.

**The client side needs almost nothing.** `places` in the blob is already `Record<string, string>` (abstract name → nest), and TASK-8's `workspacePlace` reads it without caring about kind. So the only client change is the enum.

**`placeKindSchema` should stay a closed enum**, unlike the open ids used for channel views and workspace capabilities. The reasoning differs: an unrecognized *view* degrades to a fallback renderer, which is harmless, but an unrecognized *place kind* would mean the installer cannot create the place — and a half-instantiated workspace is worse than a refused install. Hence AC #4 asking for rejection rather than degradation.

**Atomicity is available cheaply.** `+install` emits every card in one event, so refusing an unknown place kind *before* emitting anything gives the all-or-nothing behaviour AC #4 wants without needing an unwind path — which is good, because v1 accepts optimistic install by design (`docs/kits.md`) and has no unwind.

**AC #3 has an honest limit.** `%notes` defers read permission to the group's `can-read`, and `desk/tests/app/notes.hoon` already proves that gate with `can-read-allow`/`can-read-deny` fixtures (`:638`, `:651`). What `%kits` controls is that the notebook is created group-bound with the right reader roles, which is assertable. Whether a second ship can then read it is `%notes`' existing, already-tested behaviour; I will assert the former and say plainly I am not re-proving the latter.

**Hoon verify loop is ready.** `desk/tests/app/kits.hoon` (278 lines) already covers install for a fixture kit, and the fakezod pier from TASK-7 is still up. The two traps that cost time before: `rsync -a` into a mount is a silent no-op without a following `touch` (mtime-based change detection), and a `-d` pier gives no readable slog so `-test` reports only `ok=%.n` — the pier has to be attached with `-t` and stdout redirected.
<!-- SECTION:NOTES:END -->
