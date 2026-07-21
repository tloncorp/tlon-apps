# Design: two-way sync of the agent workspace to a protected %notes notebook

Status: **proposal — not implemented**. Part of TLON-6182.

## Goal

Give the owner a durable, browsable, Tlon-native window into the bot's workspace (the directory OpenClaw's file tools operate in, e.g. `/pier/<ship>/.openclaw/workspace`), and let the owner edit those files from the Tlon client by editing notes. Concretely: the bot's `MEMORY.md`, memory shards, plans, and other working documents appear as notes in a notebook in the bot's home group; edits flow both ways.

## Protection model

%notes has **no folder-level ACLs** — permissions are per notebook (`owner/editor/viewer` members, `public/private` visibility; group notebooks defer reads to the group and can restrict readers to a set of group roles). So "a protected folder" is really **a dedicated restricted notebook**:

-   The bot creates (or is pointed at) a notebook hosted on the bot ship, e.g. `notes/~bot-ship/workspace`, attached to the home group with `readers` restricted to the admin role (owner + bot only). Bot-hosted means sync writes are local to the pier — no network dependency.
-   The sync engine refuses to run against a notebook whose visibility is public or whose group readers are unrestricted, unless explicitly overridden (`workspaceSync.allowOpenReaders: true`). Workspace content can contain sensitive material; the default posture is locked down.

## Mapping

-   One note per synced file. Note title = workspace-relative path (`memory/2026-07-20.md`); the title is the sync key, stored alongside ids in local state so renames on either side are detected as delete+create.
-   Notebook folders mirror workspace directories (folder per directory, created on demand via `notes folder-create`).
-   Scope: text files only, Markdown-first. Default include: `**/*.md`. Configurable include/exclude globs; hard excludes always applied: `media/`, dotfiles, `*.env*`, key/credential patterns, files > 256 KB. Binary files are never synced.

## Sync engine

Local state file `.notes-sync.json` in the workspace root (atomic write-then-rename, same pattern as `context-lens-store.ts`), mapping relative path → `{ noteId, folderId, revision, contentHash }`.

Each sync pass (per file):

1. Compute file hash; fetch note revision (cheap list scan via `notes notes <nest>`, then `notes note` only for changed entries).
2. File changed, note unchanged → `notes note-update --expected-revision <lastSyncedRevision>`.
3. Note changed, file unchanged → write note body to file.
4. Both changed (or the expected-revision write is rejected) → **conflict**: keep the note's version in place, write the local version as a sibling conflict note titled `<path> (conflict <timestamp>)`, and surface a one-line notice to the owner session. No silent overwrites in either direction; no attempt at three-way merge in v1.
5. File deleted → note moved to an `Archive` folder (not deleted), and vice versa: archived/deleted notes remove the file only after recording a tombstone in state, so a fresh state file never mass-deletes a workspace.

Transport: the same v1 HTTP surface the `tlon` CLI uses (`notesV1` in `@tloncorp/api`), called directly from the plugin — not by shelling out to the CLI — so errors, revisions, and ids are typed.

## Triggers

-   Periodic pass on an interval (`workspaceSync.intervalMs`, default 5 min), registered like the existing discovery `setInterval` in `src/monitor/index.ts`, **never on the reply dispatch path**.
-   A debounced pass shortly after an agent run that used file tools (`after_tool_call` hook already exists for context-lens; reuse the signal).
-   Stretch (v2): subscribe to the notebook's SSE stream (`/v0/notes/<host>/<name>/stream`) for push-based note→file sync. The stream is gated `from-self`, which holds here because the plugin is authenticated as the bot ship talking to its own %notes agent.

## Config surface (`config-schema.ts`)

```jsonc
workspaceSync: {
  enabled: false,              // opt-in
  notebook: "notes/~bot/workspace", // omit → bot creates it in the home group
  include: ["**/*.md"],
  exclude: [],
  intervalMs: 300000,
  allowOpenReaders: false,
}
```

## Open questions for review

1. Should note→file sync be allowed to touch files outside the include set (owner creates a brand-new note in the notebook)? Proposal: yes, if the title is a valid relative path inside the workspace and matches include globs; otherwise the note is left alone and flagged once.
2. Home-group discovery: take the group flag from config, or reuse an existing "home group" notion if one lands for tlonbots?
3. Is `MEMORY.md` (OpenClaw core's own memory surface) safe to round-trip while the agent is mid-run, or should sync pause during active runs?
4. Hermes parity: the Hermes adapter has no local workspace (state lives in the on-ship %settings store), so this feature is OpenClaw-only for now.
