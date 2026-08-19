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
                "discussion": "chat/~host/book-club-discussion-1234",
                "picks": "chat/~host/picks-1234",
                "log": "diary/~host/reading-log-1234"
            },
            "schedules": [
                { "id": "monthly-pick", "cron": "0 17 1 * *" },
                { "id": "weekly-nudge", "cron": "0 17 * * 5" }
            ],
            "agents": ["~sampel-palnet"],
            "setup": "pending",
            "installedAt": 1786149333904
        }
    ]
}
```

Notes:

-   `kits` is an array: the shape composes even though v1 enforces one kit per group (instantiate-only).
-   `agents` lists ships whose bots are authorized to execute this kit here (v1: the installer's bot).
-   `setup`: `"pending"` → `"done"`; flipped by the executing agent after the setup conversation completes.
-   The blob does NOT carry instruction text. Executing agents hold the package (from %kits); the blob tells them which kit runs here and how its abstract places resolve. A member's bot that lacks the package can fetch it from `kit.publisher` via %kits.
-   Bot-private facts (install ledger, scaffold copies, policy patch applied) live in the installer's %kits state + bot workspace, not in the blob.

## Versioning rules

-   Installs pin `kit.version`; updates are out of scope for v1.
-   Blob readers must tolerate unknown keys and unknown `kits[]` entries (skip, don't crash).
-   Blob writers must read-modify-write the whole payload (last-write-wins on the cord is accepted for v1).
