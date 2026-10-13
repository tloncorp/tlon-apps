# %kits

Installable workspace templates. A kit is a package of places, instructions, schedules, and starting notes. Installing one creates a group with the kit's places and expands everything else into ordinary workspace primitives:

- the group's workspace config document in its `blob` ([workspace-config.md](../../../tlon-apps/workspace-config.md)): the bot, the kit's instructions, and a `kits[]` provenance entry
- steward routines for the kit's bot, one per schedule plus a one-off setup routine
- notes in the kit's notebooks

After install nothing depends on the kit. Its instructions are ordinary workspace instructions, its routines ordinary steward tasks, and its notes ordinary notes, all editable like anything else. %kits keeps a ledger of what it created so uninstall can remove the routines.

%kits runs on the group host, which is also the bot's owner: the kit's bot must be one the host's %steward trusts.

## Package

A kit is `{manifest, files}`: a manifest plus its files by path. Files are markdown; nothing in a kit executes.

| manifest field | meaning |
| --- | --- |
| `id`, `name`, `version`, `publisher`, `description`, `image` | identity and card copy; `version` is a semver string |
| `places` | `[{name, kind, title, description}]`, `kind` one of `chat`, `notebook`, `gallery`; created at install |
| `instructions` | files appended, in order, to the workspace instructions |
| `schedules` | `[{id, cron, description, file, place}]`: a routine running `file` as its prompt on `cron` in the chat place `place` |
| `setup` | `{file, place}` or null: a routine run once, right after install |
| `scaffolds` | `[{file, title, place}]`: a note titled `title` written into the notebook place `place` |

`%add` and `%fetch` refuse a kit whose manifest names a missing file or place, repeats a place name, runs a routine anywhere but a chat place, or puts a scaffold anywhere but a notebook place.

## Install

`%install [id name meta bot tz]` creates `~our/name` and, in order:

1. creates the group, with `bot` as a member
2. writes the workspace config: `bot` (unless one is named), the kit's instructions appended, and `kits[]` gaining `{ref, places}` where `ref` is `~publisher/id@version` and `places` maps each chat and gallery place to its nest
3. creates the chat and gallery places through %channels, each named `<group name>-<place name>` since channel names are unique per host, not per group
4. asks %notes for each notebook place (`%create-group-notebook`), watching `/v1/request/<id>` for the flag it assigns
5. asks steward for each routine (`%edit [%create task]` for `bot`), watching `/v1/automation/request/<id>` for the task id the bot's harness assigns
6. records the install in the ledger

The blob is written before the notebooks are requested because each notebook's place is filled into it once %notes reports the flag. When it does, %kits records the place in the ledger and the blob, then writes the kit's scaffolds for that notebook into its root folder. When steward reports a routine's id, %kits records it in the ledger.

`bot` must be in the trusted set %steward serves at `/v1/bots`. `tz` is the installer's time zone; the schedules run in it.

A routine runs in its place's channel session (`session:agent:main:tlon:group:<nest>`), so replies to it keep the run's context, and announces its reply to the place. Only that reply is posted, so %kits puts a line ahead of the kit's prompt saying the reply is the message itself; without it a model tends to post a report on having done the job. The setup routine runs before anyone has talked in the channel, so OpenClaw has no channel session yet to record it in; later runs keep context as intended. Its name is `<kit name>: <schedule description>`. The setup routine runs a minute after install, which gives the bot time to accept its invite to the new group.

## Uninstall

`%uninstall [flag]` deletes the ledger's routines through steward, removes the kit's `kits[]` entry from the blob, and drops the ledger entry. The group, its channels, its notes, and the instructions the kit added stay with the owner. A routine steward reports after uninstall is deleted when its id arrives.

## Blob edits

Edits go through `lib/workspace-config.hoon`, which follows the same rules as the client's `updateWorkspaceConfig`: unknown keys survive, empty known fields are dropped, a document left holding only its version is written as null, and a blob that is not a version-2 workspace config is left untouched.

## Poke surface (`%kits-action-1`, local only)

- `%add [kit]`: put a kit in the library. Echoes a `%kit` fact on `/v1/updates`.
- `%del [id]`: remove a kit from the library.
- `%fetch [ship id]`: watch the publisher's `/v1/full/<id>`; the arriving kit is added as with `%add`.
- `%install [id name meta bot tz]`: see above. Gives an `%installed` fact, and another each time a notebook place or routine id lands.
- `%uninstall [flag]`: see above. Gives an `%uninstalled` fact.

## Watch surface

- `/v1/updates`: local only. `%kit`, `%installed`, `%uninstalled` facts.
- `/v1/preview/<id>`: public, one-shot: one `%preview` fact (the manifest), then a kick. A missing kit nacks the watch.
- `/v1/full/<id>`: public, one-shot: one `%kit` fact (the full package), then a kick. This is how kits travel between ships.

## Scry surface (local, all `%kits-update-1`)

- `/x/v1/kits`: `%kits`, every manifest in the library.
- `/x/v1/kits/<id>`: `%kit`, one full package (`[~ ~]` if absent).
- `/x/v1/installs`: `%installs`, the ledger.

## State

```hoon
+$  state-0
  $:  %0
      kits=(map id kit)             ::  the library
      installs=(map flag install)   ::  ledger, by group
  ==
```

An `install` records the kit's `id`, `version`, `publisher`, the `bot`, the `places` created so far (place name to nest), the `routines` steward reported (task ids), and when it was installed.

## Not yet

- Installing into an existing group. Install always creates the group.
- Updating an installed kit to a newer version.
- A kit defining its own bot. `bot` is the installer's choice, one per workspace.
