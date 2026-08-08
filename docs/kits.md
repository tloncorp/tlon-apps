# %kits

Shareable behavior packages for agents. A kit bundles markdown instructions, starting state (scaffolds), schedule declarations, place templates, and a policy patch into one installable object. %kits is the registry and installer: it stores packages, orchestrates installs, and records ledgers. It does not run inference — the executing harness (OpenClaw/Hermes, via steward's gateway) reads what %kits and the group blob declare, and does the behavior.

The package/wire formats and the group-blob config payload are specified in `kits/SCHEMA.md` at the repo root. JSON conversions live in `lib/kits-json.hoon`.

## Purpose and shape

- **Packages** (`$kit`: manifest + files) travel as content. No executable code — instructions are markdown the harness loads into model context; a kit's power is bounded by the policy the owner grants, not by its text.
- **Install** binds a package to a place. For `%group`-scoped kits, install instantiates: it creates the group, creates each abstract place as a channel, writes the per-group config JSON into the group's `blob` field (via `%group-action-5`), and records an `$install` ledger entry. v1 is instantiate-only — every place a kit touches is a place it created.
- **The group blob is the coordination point.** It replicates with the group, survives harness swaps, and tells any authorized executing agent which kit runs there, how abstract place names resolve to concrete nests, and whether setup has run. Bot-private facts (the ledger, scaffold copies) stay in %kits state and the bot workspace.

## Poke surface (`%kits-action-1`, local only)

- `%add [kit]` — put a package in the local library (author or sideload). Echoes a `%kit` fact on `/v1/updates`.
- `%del [id]` — remove a package.
- `%fetch [ship id]` — one-shot subscription to the publisher's %kits `/v1/full/<id>`; the arriving package is stored and echoed on `/v1/updates`.
- `%install [id name meta]` — instantiate (see above). Asserts the kit exists, is `%group`-scoped, and no install exists for `[our name]`. Emits, in order: group create (`%group-command`), one `%channel-action-2` create per place, the blob write, and an `%installed` fact.
- `%uninstall [flag]` — clears the group blob and drops the ledger entry; emits `%uninstalled`. Group archival is left to the owner.
- `%setup-done [flag]` — the harness reports the setup conversation finished; flips the ledger to `%done` and rewrites the blob.

## Watch surface

- `/v1/updates` — local only (the harness and clients). `%kit`, `%installed`, `%uninstalled` facts.
- `/v1/preview/<id>` — public, one-shot: one `%preview` fact (the manifest) then kick. Missing kit nacks the watch.
- `/v1/full/<id>` — public, one-shot: one `%kit` fact (the full package) then kick. This is the ship-to-ship distribution path.

## Scry surface (local only, all `%kits-update-1`)

- `/x/v1/kits` — `%kits`, all manifests.
- `/x/v1/kits/<id>` — `%kit`, one full package (`[~ ~]` if absent).
- `/x/v1/installs` — `%installs`, the ledger map.

## State

```hoon
+$  state-0
  $:  %0
      kits=(map id kit)             ::  package library
      installs=(map flag install)   ::  install ledgers by group
  ==
```

## Lifecycle and invariants

- Install emits all orchestration cards in one event; gall's depth-first move order makes the group exist before channels are created and channels before the blob write. Nacks on any `/install/*` wire are logged, not unwound — v1 accepts optimistic install; re-running install for the same flag is refused by the ledger check.
- One kit per group in v1 (the blob `kits` array is shaped for composition later).
- Packages are publisher-pinned at install (`id`, `version`, `publisher` recorded in ledger and blob). No update flow in v1.
- Public fetch paths serve anyone; kits are content meant to travel. Local surfaces (updates, scries, pokes) are `our`-gated.
