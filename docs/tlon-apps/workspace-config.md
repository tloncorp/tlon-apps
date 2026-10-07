# Workspace Config

A group's workspace config is the bot-facing configuration for that group: which bot it is for, the instructions that bot loads on every turn there, and which kits built it. It lives in the group's `blob`, a nullable text field that %groups stores and relays as opaque text. All semantics live in the client and the bot.

Definitions live in `packages/api/src/client/workspaceConfig.ts`. Writes go through `updateWorkspaceConfig` in `packages/shared/src/store/groupActions.ts`.

## Wire format

The blob is JSON text, or null when the workspace is unconfigured.

```json
{
  "version": 2,
  "bot": "~bot-ship",
  "instructions": "…",
  "defaults": {},
  "kits": [
    {
      "ref": "~publisher/book-club@0.1.0",
      "places": {
        "discussion": "chat/~host/discussion",
        "log": "notes/~host/reading-log"
      }
    }
  ]
}
```

| field | type | meaning |
| --- | --- | --- |
| `version` | `2` | format version; bumped only for a breaking change |
| `bot` | ship (optional) | the one bot this workspace's config is for; other members' bots in the group ignore the document |
| `instructions` | string (optional) | free text the bot loads on every turn in the workspace's channels; user-editable |
| `defaults` | object (optional) | workspace defaults; contents not yet defined |
| `kits` | array (optional) | provenance: the kits that built this workspace |
| `kits[].ref` | string | `~publisher/kit-id@version` |
| `kits[].places` | object | the kit's place names mapped to channel nests |

Version 1 was the unreleased kits install config. It reads as a foreign payload.

## Invariants

- **Nothing secret.** Every member can read the blob. Credentials and anything that grants access to the bot stay bot-side, under the owner's authority.
- **Definitions only.** No run state, no history, no setup status. Routines live in steward, not here. A routine belongs to the workspace whose group owns its delivery channel.
- **Absent means inherit.** A null blob, or a missing field, means unconfigured. Writers drop empty known fields, and write null rather than a document holding only `version`.
- **Unknown keys survive.** Readers ignore keys they don't know. Writers carry them through unchanged, at the top level and in `kits[]` entries, so an older client never drops a field a newer one wrote.
- **`places` is authoritative.** Readers never infer a place from the group's channel list. A place that isn't in the map yet is pending.

## Reading

`readWorkspaceConfig(blob)` returns the config, or null when the workspace is unconfigured. Null also covers any blob this client can't interpret, so readers fall back to defaults. Malformed `kits[]` entries are skipped, and dropped on the next write.

`parseWorkspaceConfigBlob(blob)` returns the reason when a reader needs it:

| kind | blob | read as | writable |
| --- | --- | --- | --- |
| `empty` | null or empty | unconfigured | yes, starts a new document |
| `config` | a version-2 document | the config | yes |
| `newer` | a document with a higher `version` | unconfigured | no |
| `foreign` | anything else | unconfigured | no |

## Writing

Edits merge on the client. There is no compare-and-swap in %groups:

1. Read the freshest blob the client holds. The local group row is kept current from the `/groups/ui` subscription.
2. Change only the fields the caller owns.
3. Write the whole blob back.

```ts
await store.updateWorkspaceConfig(groupId, (config) => ({
  ...config,
  instructions: 'Keep replies short.',
}));
```

The updater cannot change `version`. `updateWorkspaceConfig` throws `WorkspaceConfigWriteError` rather than overwrite a `newer` or `foreign` blob. Two admins writing at the same moment is last-writer-wins.

Only group admins can set the blob, and the host rejects a blob over 256 KB (measured as the jammed noun, `size-limit` in `desk/app/groups.hoon`). The write is an ordinary `%blob` group action. The host emits no update when the value is unchanged, so `updateGroupBlob` skips a no-op write rather than wait out its timeout.
