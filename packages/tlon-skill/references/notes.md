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

Use the returned notebook nest. `%notes` creates its listing, so `--description` is not accepted at create; set it afterwards with `channels update`. Writer roles are not supported for this channel kind. `notes create` creates a standalone notebook, not an app/group channel. The deprecated `notebook` command operates on neither of these supported workflows.

To rename a group notebook as it appears in the app, use `channels rename notes/~host/name "New Title"` or `channels update notes/~host/name --title "New Title"`. To change its description, use `channels update notes/~host/name --description "Description"`. These operations require group admin rights.
`notes list/show` pick up the new title once the notebook host runs a desk with
%notes title sync; on older desks they keep the original title.

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

## Publish a note to the web

```json
{"command":"notes note-publish notes/~host/name 12"}
{"command":"notes note-unpublish notes/~host/name 12"}
```

OpenClaw defaults these commands to the configured owner unless `--self` or explicit credential flags are supplied, so the page is served from the owner's ship and, after a refresh, the owner's app shows the note as published and can unpublish it too. The owner's ship must host or have joined the notebook. Do not switch identities silently to work around an error. Publishing makes the note public to anyone with the link: publish only notes the user asked to publish, and return the URL the command prints, not a constructed one. The page is a snapshot: after `note-update`, run `note-publish` again to refresh it.

## Other notebook operations

Use `help notes` and operation-specific help for folders, membership, renaming, moving, history, or deletion. Recursive folder deletion and notebook deletion have wider effects than deleting one note.

Legacy `%diary` management is unsupported. Ask the owner to use `/migrate <diary-nest>` for migration; model-issued migration writes are blocked even if shell help lists them. Do not attempt to bypass the owner confirmation through a shell.
