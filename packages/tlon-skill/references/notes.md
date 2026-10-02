# Find, create, and edit notes

Notebooks use `notes/~host/name`; individual notes have a separate numeric ID. Never infer a notebook slug from its display name or substitute a chat/diary nest.

## Find the right notebook

When the user names a workspace (group), resolve it with `groups list` if necessary, then
read `groups info <group-flag>` or `channels groups`. Match the notebook title
within that group's channels and use the returned `notes/` nest. Start here
before inspecting a global notebook list: other groups may have notebooks and
notes with exactly the same titles.

```json
{"command":"groups info ~host/group"}
{"command":"notes show notes/~host/name"}
{"command":"notes notes notes/~host/name"}
{"command":"notes note notes/~host/name 12"}
```

Use `notes list` for a standalone notebook or when no group is specified. If there are multiple matches, resolve the ambiguity before writing. Read the current note before editing it and use its returned revision.

## Create a notebook in a group

Discover the group with `groups list` / `groups info`, then:

```json
{"command":"channels create ~host/group \"Research\" --kind notes"}
```

Use the returned notebook nest. `%notes` owns its listing, so `--description` and writer-role flags are not accepted for this channel kind. `notes create` creates a standalone notebook, not an app/group channel. The deprecated `notebook` command operates on neither of these supported workflows.

## Write and verify content

Use `write` to save Markdown to a workspace file, such as `draft.md`. Then:

```json
{"command":"notes note-create notes/~host/name root \"Title\" --body draft.md"}
{"command":"notes note-update notes/~host/name 12 --body revised.md --expected-revision 3"}
{"command":"notes note notes/~host/name 12"}
```

Replace `12` and `3` with the returned note ID and revision. `root` resolves to that notebook's root folder. For a different folder, discover its ID with `notes folders`.

`--body` takes a filename, not inline Markdown. `--markdown` is an alias only on `note-create`; use `--body` for updates. Relative paths use the active agent workspace. The tool cannot provide stdin or execute shell redirections.

Verify the saved body and identity before claiming completion. If the command reports a pending write/request ID, use `notes request <request-id>` before repeating the write. On a revision conflict, re-read and reconcile; do not blindly overwrite a newer edit. `--expected-revision` is optional in the CLI, but protects edits from concurrent changes.

Tlon does not render LaTeX. Use plain text/Unicode math or code blocks in notes and messages.

## Other notebook operations

Use `help notes` and operation-specific help for folders, membership, renaming, moving, history, or deletion. Recursive folder deletion and notebook deletion have wider effects than deleting one note.

Legacy `%diary` management is unsupported. Ask the owner to use `/migrate <diary-nest>` for migration; model-issued migration writes are blocked even if shell help lists them. Do not attempt to bypass the owner confirmation through a shell.
