# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. Each module is independently versioned and owns its own protocol types and mark family, so modules can evolve without dragging each other along:

| Module    | sur file                  | marks                                                  |
|-----------|---------------------------|--------------------------------------------------------|
| (core)    | `sur/steward.hoon`        | `%steward-action-1`                                    |
| `lens`    | `sur/steward/lens.hoon`   | `%steward-lens-action-1`, `%steward-lens-update-1`     |
| `gateway` | `sur/steward/gateway.hoon`| `%steward-gateway-action-1`, `%steward-gateway-update-1` |
| `roster`  | `sur/steward/roster.hoon` | `%steward-roster-action-1`, `%steward-roster-update-1` |

Each sur file is versioned on its own (`++v1`), referenced by callers as `action:v1:lens`, `update:v1:gateway`, etc. The core `sur/steward.hoon` carries only cross-cutting config (currently just `%configure`); each module's protocol lives in its own file.

Modules:

| Module    | Purpose                                                                |
|-----------|------------------------------------------------------------------------|
| `lens`    | Per-run bot introspection (folded in from the former `%context-lens`). |
| `gateway` | Harness liveness tracking + offline DM auto-replies.                   |
| `roster`  | Mints bot moons and tracks their runner config.                       |

The app helper core keeps each module's logic in its own sub-core: `le-core` for lens, `ga-core` for gateway. Adding a new module means a new `sur/steward/<module>.hoon`, its own mark family, and a dispatch arm in the app — existing modules and marks are untouched.

## state model

State is versioned (`state-0` → `state-1`), defined in the app file. `state-1` added the `roster` module slice; loading an old `state-0` lifts it in with a bunted roster (a real migration, not a reset-to-bunt — steward now runs on live hosted ships with meaningful gateway lease state to preserve). Cross-cutting config is top level; each module owns its own slice, typed from its own sur file:

```
state-1
  owner    (unit ship)                  shared config: bot sends runs to it / its DMs are watched; ~ = inert
  bots     (set ship)                   owner-side trusted bots: who may send lens %entry pokes cross-ship
  lens     state:v1:lens                 stored lens run records (owner role)
  gateway  state:v1:gateway              harness liveness + auto-reply bookkeeping
  roster   state:v1:roster               minted bot moons and their runner config
```

`owner` is shared: the lens module sends runs to it, and the gateway module treats its DMs as owner activity worth auto-replying to. `bots` is the owner-side allowlist of ships permitted to fan lens runs in (see the `%entry` gate below); managed via the core `%trust-bot`/`%untrust-bot` pokes.

`run` (in `sur/steward/lens.hoon`):

```
complete  ?       whether a finalized (final=&) record has been received for this id
received  @da     when the latest poke for this id arrived
payload   json    the run record, stored as typed JSON
```

The lens payload is stored as a typed `$json` value (`enjs:format`/`dejs:format` on the wire). The gateway enforces size caps and truncation before poking; the ship relays and stores the parsed JSON without interpreting its contents, and re-serializes it on read. (Storing typed `$json` is fine — an earlier worry that embedding `$json` in a mark sample made ford's tube checks diverge turned out to be a mark-arm/type **shadowing** bug, not a property of `$json`. The mark captures the real type in an outer core, `=> |% +$ jsn json --`, and uses `same` as the json fist so the `++json` grow/grab arms don't shadow the `$json` type.)

## module: lens

Makes a bot's run records — trigger, tool calls, timings, output — durable on the owner's ship and reachable from any client (including mobile), without the client ever talking to the gateway.

One agent, two roles; the same code runs on every ship, and the role is determined by **who poked it** (the `%steward-lens-action-1` ownership gate has already vetted the source — see below):

- **bot ship role** (`src == our`): the local gateway pokes `%steward-lens-action-1` with a run record. `le-poke-action` sends it to the configured `owner` as a `%steward-lens-action-1` poke. Ames retries until ack, so owner-ship downtime or gateway restarts don't drop finalized runs once poked.
- **owner ship role** (`src` is a trusted bot — in our `bots` set): a bot sent us its run. `le-poke-action` stores it keyed `[bot=src id]`, gives a fact on `/v1/lens`, and answers scries for clients.

A self-owned bot (`owner` equal to `our`) is stored directly during send with no network hop.

The lens action is a tagged union of three shapes:

- **`%entry`** `[%entry id=@t payload=json final=?]` — a run record from the gateway. `final=&` marks the run complete; `final=|` is an in-progress milestone that upserts a partial record. A finalized run is never demoted back to partial by a late `final=|` (the late partial is dropped). Oversized payloads (jammed size over 512KB) are dropped to bound loom usage.
- **`%retry`** `[%retry bot=ship id=@t]` — an owner-initiated request to re-dispatch a failed/aborted run. The symmetric case to `%entry` (bot → owner): retry flows owner → bot. If `bot == our`, the agent emits a `%retry-requested` fact on `/v1/lens` for the local gateway to act on; if `bot != our`, the owner's steward relays a cross-ship `%retry` poke to that bot's steward, which then emits the fact for its own gateway. Retry never mutates stored state — the gateway creates a fresh run and pokes it back via `%entry`.
- **`%configure`** `[%configure max-runs-per-bot=@ud]` — set the per-ship retention cap (local only); applied to every bot immediately.

### retention

Count-bounded only — lens runs are durable memory, not transient logs, so there is **no time-based expiry**. Each bot keeps at most `max-runs-per-bot` records (default 3,000, seeded at install; changed via `%configure`). When a bot exceeds the cap, the oldest by `received` are dropped. Enforced on every insert (bounds that bot's tail) and on `%configure` (re-applies a new cap to every bot). No prune timer.

## module: gateway

Tracks the liveness of an external harness process and sends offline DM auto-replies on the bot's behalf while it's down — the part the harness can't do for itself, since no harness code runs during downtime. Ported from the former standalone `%gateway-status` agent, which has since been removed — harnesses poke this module directly.

The harness reports its lifecycle via the gateway action: `%gateway-start` (with a `boot-id` and a lease expiry), periodic `%gateway-heartbeat`s that extend the lease, and a graceful `%gateway-stop`. A behn timer on `/gateway/lease-check` fires at the lease expiry; if no heartbeat renewed it, the gateway is marked `%down`. `boot-id` matching distinguishes graceful-stop recovery from crash recovery exactly as in the original agent (stop clears `boot-id` so late heartbeats can't revive it; crash/expiry retains it so a delayed heartbeat can).

While the gateway is not live, a DM from the configured `owner` triggers a canned offline auto-reply to that ship (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" / "back online" notice is sent to the owner if they messaged within `active-window`. Inbound owner DMs are observed via a subscription to `%activity /v5`.

`owner` is the shared top-level `(unit ship)`, set via the core `%configure`, so a harness sends two pokes at startup: the core `%configure` for the owner, then the gateway `%configure` for timings. The gateway action's own `%configure` carries only timing (`active-window`, `reply-cooldown`); the owner is set once at the core level.

## module: roster

Mints bot moons: a bot is a moon that never boots, hosted (and spoken for) by its sponsor. The roster module is also the **arbiter of bot data in `%contacts`**: every bot profile write and every write of the host's own `bots` claim field flows through it, so those values always have exactly one writer (by API shape — contacts can't distinguish local pokers, since every local poke arrives as `src=our`). Identity fields (nickname/avatar) are **not stored** in the roster — the bot's contact profile is the single copy, joined into roster facts and peeks at read time.

Minting is entirely local — an owner mints its own bots — and does five things in sequence:

1. **Spawn+reserve a moon.** Pick a random 32-bit suffix under `our` (the same shape `|moon` uses), retried up to 16 times against a collision on jael's own `%ryft` scry (non-`~` means keys are already set, from either a real point or a prior `%moon` registration) or our own roster. Register only the *public* half of a freshly derived keypair with jael (`life` 1, crub suite) via a `%moon` task. The private seed is discarded the instant the public key is derived — never slogged, stored, or emitted. This is deliberate: the bot moon is unbootable by design, so nobody (not even the minting ship) can ever assume its identity. If the owner ever wants a real, bootable moon instead, `|moon-cycle-keys` replaces these keys with ones it actually keeps.
2. **Classify it `%bot` in `%vouch`** (`%vouch-learn [mon %bot]`), so the rest of the system knows to route to it through its host rather than expecting it to ever appear as `src`.
3. **Publish its `%contacts` profile** (`%contact-bot-0 [mon con]`), seeded from `.nickname`/`.avatar`, so the bot has an identity in the frontend from the moment it's minted. `%contact-bot-0` applies `+do-edit` merge semantics (same as `%self`): `~` deletes a field, absent fields are untouched — a partial write can never wipe the rest of the profile. The seed profile is validated (`+sane-contact`) before anything commits, so the poke can't nack after the roster entry exists.
4. **Claim it** in the host's own profile's `bots` field. The field is a pure **projection** of steward's grow-only `.claimed` set — written whole from state steward owns, never read-modify-written from contacts — so there is no read to fail or race, and any corruption of the field heals on the next roster change.
5. **Record its rig** (`.model`/`.harness`/`.persona`, opaque to steward) in the roster and give a `%minted` fact on `/v1/roster` for the runner (openclaw) to pick up.

If jael's `%moon` registration itself fails (the async `%done` ack carries an error), everything the mint published is unwound: the roster entry and `.claimed` membership are removed, the claim projection is rewritten, the seeded profile fields are nulled out, and a `%retired` fact is given. The `%vouch` `%bot` record deliberately stays (there is no `%vouch-forget`; a permanently burned `@p` costs nothing — there are 2³² per host).

`%configure` updates an existing bot's stored rig only — every field is a unit, `~` means keep — and never touches contacts; identity edits are `%profile`'s job. `%profile` edits an existing bot's contact profile: steward validates the field names (`nickname`/`bio`/`status` are `%text`, `avatar`/`cover` are `%look`; anything else crashes), forwards the typed edits to `%contacts` as a merge, and puts the post-edit identity on a `%configured` fact (composed with the same deterministic `+do-edit` contacts will apply). `%retire` drops a bot from the roster but deliberately does **not** touch `%vouch` or `.claimed` — the moon stays classified `%bot` and claimed forever, so history involving it stays routable/attributable and peers keep routing its DMs through the host rather than peer-to-peer into a never-booted void. Only a ship able to sponsor a moon (galaxy, star, or planet) can mint one; a moon or comet has no room under it.

## poke surface

Three inbound marks, each ownership-gated to admit exactly the right source.

### `%steward-action-1` (core config) — `src == our`

```json
{ "configure": { "owner": "~sampel-palnet" } }
```

```
[%configure owner=ship]               top-level: set the shared owner
[%trust-bot ship=ship]                add a ship to the trusted-bots set
[%untrust-bot ship=ship]              remove a ship from the trusted-bots set
```

`%trust-bot`/`%untrust-bot` manage the owner-side `bots` allowlist that gates lens `%entry` fan-in. Trust is explicit and ship-class-agnostic — a bot may be a planet, moon, comet, star, or galaxy, and moon sponsorship is **not** an auto-trust.

### `%steward-lens-action-1` (lens)

Auth is **per-variant**, since each shape expects a different `src`:

- `%entry` — accepted iff `src` is `our`, or `src` is in the owner-side trusted-bots set (`bots`, granted via the core `%trust-bot` poke). Ship-class-agnostic: a trusted bot may be a planet, moon, comet, etc. Moon sponsorship is **not** an auto-trust — even a moon the owner sponsors must be explicitly `%trust-bot`'d. This is the one shape a trusted remote ship may submit (its own runs, stored keyed by `src`).
- `%retry` — accepted iff `src` is `our` (a local client, or an owner-side relay forwarding to its own bot when `bot == our`) or the configured `owner` (relaying a retry to its bot moon).
- `%configure` — `src == our` only.

```json
{ "entry": { "id": "<lensId>", "payload": { ... run record ... }, "final": true } }
{ "retry": { "bot": "~sampel-palnet", "id": "<lensId>" } }
{ "configure": { "max-runs-per-bot": 10000 } }
```

```
[%entry id=@t payload=json final=?]   a lens run milestone (final=& finalizes)
[%retry bot=ship id=@t]               owner-initiated re-dispatch request
[%configure max-runs-per-bot=@ud]     set the per-bot retention cap
```

### `%steward-gateway-action-1` (gateway) — `src == our`

Only the local gateway drives liveness, so this requires `src == our`.

```
[%configure active-window=@dr reply-cooldown=@dr]   set notice/cooldown timing (owner set separately)
[%gateway-start boot-id=@t lease-until=@da]          a gateway instance started
[%gateway-heartbeat boot-id=@t lease-until=@da]      extend the lease (boot-id must match)
[%gateway-stop boot-id=@t reason=@t]                 graceful stop (boot-id must match)
```

### `%steward-roster-action-1` (roster) — `src == our`

Minting is driven by the owner from the host frontend (HTTP), so unlike most other steward marks this mark's grab supports both `%noun` and `%json`.

```json
{ "mint": { "nickname": "Bot", "avatar": null, "model": "gpt", "harness": "openclaw", "persona": "default" } }
{ "configure": { "ship": "~sampel-palnet-...", "model": "gpt2", "harness": null, "persona": null } }
{ "profile": { "ship": "~sampel-palnet-...", "edits": { "bio": "helpful", "avatar": null } } }
{ "retire": { "ship": "~sampel-palnet-..." } }
```

```
[%mint nickname=@t avatar=(unit @t) model=@t harness=@t persona=@t]
[%configure =ship model=(unit @t) harness=(unit @t) persona=(unit @t)]     :: ~ = keep
[%profile =ship edits=(map @tas (unit @t))]                                :: ~ = delete field
[%retire =ship]
```

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-lens-update-1` facts (`update:v1:lens`, a tagged union) — `%entry` (a stored run, one per insert; the owner-side client reads these) and `%retry-requested` (emitted on the bot ship for its local gateway to re-dispatch). No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-gateway-update-1` facts (`update:v1:gateway`) — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.
- `/v1/roster` (local only): `%steward-roster-update-1` facts (`update:v1:roster`) — `%init` (the full roster, given on every new subscription), `%minted`, `%configured`, `%retired`.

## scry surface

All lens scries return the `%steward-lens-update-1` mark so the HTTP client reads them as JSON.

- `/x/v1/lens/recent` → `[%recent entries]` — newest 50 runs across all bots, for backfill. Grows to `{ "recent": [ entry, … ] }` (a JSON array of entry objects).
- `/x/v1/lens/recent/[count]` → `[%recent entries]` — newest `count` runs.
- `/x/v1/lens/since/[da]` → `[%recent entries]` — every run with `received >= da`, newest first; paginate history by passing the oldest `received` from the last page.
- `/x/v1/lens/run/[ship]/[id]` → `[%entry entry]`, or empty (`[~ ~]`) when absent.
- `/x/v1/gateway/status` → `%noun` `[status:v1:gateway (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.
- `/x/v1/roster` → the `%steward-roster-update-1` mark (an `%init` update), so the full roster is HTTP-scryable as JSON. Each entry is the runner-facing `$bot` view: the stored rig joined at read time with the identity fields from the moon's contact profile.
- `/x/v1/roster/[ship]` → `%noun` `bot:v2:roster` (the same joined view), or empty (`[~ ~]`) when that ship isn't in the roster. Tolerates a trailing mark segment (e.g. `/noun`) like other scries on this branch.

`entry` is `[bot=ship id=@t run]`. The `%entry` update grows to JSON for Eyre, embedding the stored payload directly:

```json
{ "entry": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": { ... run record ... } } }
```

## lifecycle and invariants

- `on-init` subscribes to `%activity /v5` for the gateway module and seeds the default lens retention cap. There is no prune timer (retention is count-only, enforced on insert/configure).
- `on-load` migrates `state-0` → `state-2` (adding a bunted `roster`) and `state-1` → `state-2` (dropping nickname/avatar from stored bot records — the contact profile is now the single copy — and seeding `.claimed` from the roster keys). An unreadable state still crashes — that path is only reachable pre-release.
- Wires: lens send on `/lens/send/[owner-p]/[id-t]`, lens retry relay on `/lens/retry/[bot-p]/[id-t]`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`. Roster mint's jael registration is on `/roster/mint/[moon-p]` (an `%arvo` pass, not an agent poke); its `%vouch`/`%contacts` fan-out are on `/roster/vouch/[moon-p]`, `/roster/profile/[moon-p]`, and the claim projection on `/roster/claim`. The `%activity` subscription is re-watched on `%kick`. Poke/DM nacks are logged and ignored (Ames retries).
- `on-watch` and `on-peek` assert `=(src our)` — no cross-ship subscriptions or foreign scries. Only the lens poke is ownership-gated (to admit a bot's runs).

## integration notes

- The gateway (openclaw-tlon / hermes) pokes core `%configure` on monitor activation and `%steward-lens-action-1` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The `%steward-lens-*` marks replace the former `%context-lens-*` marks. There is no separate cross-ship `signal` mark — sending reuses `%steward-lens-action-1`, gated by ownership.
