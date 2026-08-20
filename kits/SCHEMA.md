# Kit formats (v1)

Three JSON shapes:

1. **The authoring format** (`kit.json` + files, §1) — what kit authors write on disk.
2. **The wire format** — what the %kits agent actually stores and speaks (`kits-action-1` / `kits-update-1` marks; see `desk/sur/kits.hoon` + `desk/lib/kits-json.hoon`, mirrored by the zod schemas in `packages/tlon-kits`). The tlon-kits loader converts authoring → wire: `places` map becomes a list of `{name, kind, title, description}`, `kitVersion` becomes `version` (semver string), the `policy` object is JSON-stringified (or null), and optional fields are sent as explicit `null`s (the Hoon decoder requires every key present).
3. **The group install config** (§2) — written into the group's `blob` field at install time; what a harness needs to _run_ the kit in that group.

`version` fields at the top of §1 and §2 are format-version integers and mandatory. Unknown keys must be ignored by readers (forward compat).

## 1. Kit package

Directory layout:

```txt
<kit-id>/
  kit.json
  card/summary.md          # long-form card copy (markdown)
  instructions/*.md        # instruction files referenced by bindings
  scaffolds/*.md           # starting state files, copied to bot workspace at install
```

`kit.json`:

| field         | type                                    | notes                                                      |
| ------------- | --------------------------------------- | ---------------------------------------------------------- |
| `version`     | int                                     | package format version, `1`                                |
| `id`          | string                                  | kebab-case, unique per publisher                           |
| `name`        | string                                  | display name                                               |
| `kitVersion`  | string                                  | semver of the kit content                                  |
| `publisher`   | string                                  | `@p` of the publishing ship                                |
| `description` | string                                  | one-paragraph card copy                                    |
| `image`       | string?                                 | card image URL                                             |
| `scope`       | `"group"` \| `"dm"` \| `"agent"`        | what install targets; v1 hero path is `group`              |
| `places`      | map name → `{type, title, description}` | abstract places; `type`: `chat` \| `notebook` \| `gallery` |
| `bindings`    | array                                   | see below                                                  |
| `schedules`   | array of `{id, cron, description}`      | realized at install                                        |
| `scaffolds`   | array of `{file, workspace}`            | copy `file` → bot workspace path                           |
| `policy`      | `{required[], recommended[]}`           | labeled policy patches, harness-interpreted                |

Binding entry:

| field     | type                                        | notes                                                                                                             |
| --------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `file`    | string                                      | path within the package                                                                                           |
| `scope`   | `"group"` \| `"dm"` \| `"agent"`            | where the binding applies                                                                                         |
| `trigger` | string?                                     | event name (`install.setup`, `schedule.<id>`, `mention`, …); absent for ambient/pulled                            |
| `load`    | `"ambient"` \| `"on-trigger"` \| `"pulled"` | ambient: always in context within scope; on-trigger: only when `trigger` fires; pulled: model-loaded on relevance |

Instructions refer to places by their abstract names (e.g. "the Discussion channel"); concrete channel ids only ever exist in the install config.

## 2. Group install config (the blob payload)

Written by the installer into the group's `blob` (opaque `@t`, JSON). The group is the owner of this config: it replicates to members with the group, survives bot swaps, and any authorized agent can execute it.

```json
{
    "version": 1,
    "kits": [
        {
            "installId": "book-club-0",
            "kit": {
                "id": "book-club",
                "version": "0.1.0",
                "publisher": "~sampel-palnet"
            },
            "places": {
                "discussion": "chat/~host/discussion-book-club",
                "picks": "chat/~host/picks-book-club",
                "log": "notes/~host/log-book-club"
            },
            "schedules": [
                { "id": "monthly-pick", "cron": "0 17 1 * *", "enabled": false },
                { "id": "weekly-nudge", "cron": "0 17 * * 5", "enabled": false }
            ],
            "agents": ["~sampel-palnet"],
            "setup": "pending",
            "permissions": ["postToPlaces", "runSchedules"],
            "installedAt": 1786149333904
        }
    ]
}
```

Notes:

-   **Place kinds and their hosts.** A place's `type` names which agent creates and serves it:

    | `type`     | nest kind | host        |
    | ---------- | --------- | ----------- |
    | `chat`     | `chat`    | `%channels` |
    | `notebook` | `diary`   | `%channels` |
    | `gallery`  | `heap`    | `%channels` |
    | `notes`    | `notes`   | `%notes`    |

    The vocabulary is **closed**: a kit naming a kind the installer cannot create is refused at the mark boundary rather than degraded, because a half-instantiated workspace is worse than a refused install. `notebook` is retained for existing kits but `%diary` is deprecated — prefer `notes` for a durable artifact place. Adding a host-backed kind means an arm in `+place-card` and a line in `+place-kind`; `+install` does not change.

-   **Place channel names are scoped by the group**: `<place>-<group-name>`. Every host asserts its channel does not already exist, so a bare place name meant installing the same kit into a second group nacked that place's creation — and install logs nacks rather than unwinding, leaving a group whose blob named channels that were never made. One install per group flag, so the group name alone disambiguates.
-   **Hosts take the channel name from the installer.** Install writes each nest into the blob in the same event it pokes the host, so the nest has to be knowable up front. `%notes` accepts an optional name for exactly this reason; without one it slugifies the title off an internal counter, which no caller can predict.
-   `kits` is an array: the shape composes even though v1 enforces one kit per group (instantiate-only).
-   `agents` lists ships whose bots are authorized to execute this kit here (v1: the installer's bot).
-   `setup`: `"pending"` → `"done"`; flipped by the executing agent after the setup conversation completes.
-   `schedules[].enabled` — **declaring a schedule is not starting it.** Install records every declared schedule inactive; a household is offered the recurring behaviour after its first result and it is switched on then, never during onboarding. An executing agent fires only enabled schedules. Absent reads as `false`, because a descriptor written before this field existed described a schedule nothing was firing.
-   `permissions` lists what the executing **agent** may do here — never who may act. Group membership and the channel `can-read`/`can-write` gates own that, and a second copy in the blob would drift (see `docs/backend/channel-hosts.md`). Known ids are in `WORKSPACE_CAPABILITIES`; the field is loose strings on purpose, so a capability a newer client granted reads as "not granted" on an older one rather than making the descriptor malformed. Absent means none granted.
-   **This entry is the workspace descriptor.** A group is a workspace exactly when its blob carries a kit install; there is no separate marker. See `packages/shared/src/logic/workspaceDescriptor.ts` for the read/update helpers, and note the consequence: installing a kit into a group makes that group a workspace.
-   The blob does NOT carry instruction text. Executing agents hold the package (from %kits); the blob tells them which kit runs here and how its abstract places resolve. A member's bot that lacks the package can fetch it from `kit.publisher` via %kits.
-   Bot-private facts (install ledger, scaffold copies, policy patch applied) live in the installer's %kits state + bot workspace, not in the blob.

## Versioning rules

-   Installs pin `kit.version`; updates are out of scope for v1.
-   Blob readers must tolerate unknown keys and unknown `kits[]` entries (skip, don't crash).
-   Blob writers must read-modify-write the whole payload (last-write-wins on the cord is accepted for v1).
