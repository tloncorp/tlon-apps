# Bot command manifests

Bots advertise the slash commands they implement in their own contact profile. The Tlon client reads the manifest off the synced contact record and uses it to drive the slash-command popup for bot conversations; bots that do not advertise a manifest fall back to a static list. The manifest is the bot's property, not the client binary's — a command change ships as a bot deploy, not an app release.

No Hoon/desk changes are involved: a v1 contact is an open key-value map (`+$ contact (map @tas value)`, `desk/sur/contacts.hoon`), unknown keys pass validation and replicate to subscribers, and the client's contacts pipeline carries the key through.

## Wire format

- Contact key: `bot-commands` (`@tas`-safe).
- Value: a `%text` contact field whose text is JSON.
- The manifest is self-published by the bot ship via a `%self` contact action (a merge — nickname/avatar/other keys survive), and propagates to peers through ordinary contact sync (`/v1/news` `%peer`/`%page` facts, `/v1/book`, `/v1/contact/{ship}`).

```json
{ "type": "text", "value": "{\"v\":1,\"commands\":[...]}" }
```

## JSON schema

```json
{
  "v": 1,
  "commands": [
    {
      "command": "/allow",
      "title": "Allow",
      "subtitle": "Approve a pending request",
      "keywords": ["approve"],
      "insertText": "/allow "
    }
  ]
}
```

| field                   | type                | notes                                                                                     |
| ----------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `v`                     | `number`            | Format version. Anything other than `1` rejects the whole manifest (static fallback).    |
| `commands`              | `array`             | **Array order is the ranking priority** — the client assigns `priority = index + 1`.     |
| `commands[].command`    | `string` (required) | Must match `^\/[a-zA-Z0-9-]{1,32}$` or it can never trigger the popup.                   |
| `commands[].title`      | `string` (required) | ≤ 64 chars.                                                                               |
| `commands[].subtitle`   | `string` (optional) | ≤ 160 chars.                                                                              |
| `commands[].icon`       | `string` (optional) | Icon name, ≤ 32 chars. Unknown names degrade to the generic command icon.                 |
| `commands[].keywords`   | `string[]` (optional)| ≤ 8 entries, each ≤ 32 chars.                                                             |
| `commands[].insertText` | `string` (optional) | ≤ 128 chars. Defaults to `"<command> "` when omitted.                                     |

Unknown fields are ignored at every level (forward compatibility). Invalid entries are skipped; duplicate `command` tokens keep the first occurrence. A manifest with zero valid entries is treated as absent.

## Caps

Client-enforced at parse time (in one pure function, `parseBotCommandManifest` in `packages/shared/src/domain/slashCommands.ts`):

- Raw manifest: ≤ **6,000 UTF-8 bytes** (`new TextEncoder().encode(raw).byteLength` in TS, `len(raw.encode('utf-8'))` in Python).
- ≤ 32 entries (first 32 kept), plus the per-field caps in the table above.

These are manifest-local ceilings only. The backend additionally caps the **whole jammed profile** (bio, groups, attestations, manifest included) at 10 kB (`desk/lib/contacts.hoon`), so publishers must treat a rejected poke as a real, non-fatal outcome — the bot keeps working and clients fall back to the static list.

## Publishing

Compare-then-poke at boot: compute the manifest JSON, read the current self-contact (`/contacts/v1/self`), and poke only when the value differs. Byte-stable serialization (fixed key order) so the comparison does not false-positive. Example poke, via Eyre or any existing poke path:

```json
{
  "app": "contacts",
  "mark": "contact-action-1",
  "json": {
    "self": {
      "bot-commands": {
        "type": "text",
        "value": "{\"v\":1,\"commands\":[{\"command\":\"/allow\",\"title\":\"Allow\"}]}"
      }
    }
  }
}
```

## Clearing the key (rollback / retirement)

`%self` is a merge: contact keys die only by explicit `null`. Reverting or downgrading a runtime, or retiring a bot, leaves the last-published manifest in the profile until it is cleared. Poke:

```json
{
  "app": "contacts",
  "mark": "contact-action-1",
  "json": { "self": { "bot-commands": null } }
}
```

runnable via each runtime's existing poke path or curl against Eyre. Clients then fall back to the static list. A runtime _switch_ needs no clearing — the new runtime's differing manifest overwrites on first boot.

## Client consumption

- The raw JSON is stored on the contact row (`contacts.bot_commands`) and validated only at read.
- `useBotSlashCommandManifest` (`packages/shared/src/store/useBotSlashCommandManifest.ts`) resolves the bot ship for DM channels, prefers the advertised manifest, and falls back to the static OpenClaw list when absent/invalid. Gating (which conversations get a popup at all) is unchanged.
- Cold-start backfill: the legacy v0 `/all` peers scry strips namespaced keys, so the client fetches `/v1/contact/{ship}` on demand for qualifying bot channels that lack a manifest.

## Runtime implementations

- OpenClaw plugin: registry + publisher in `packages/openclaw/src/commands-registry.ts` / `src/bot-command-manifest.ts`; fixture `packages/openclaw/fixtures/command-manifest.json`. Advertises its 10 plugin commands; OpenClaw _core_ commands (`/status`, `/help`, `/new`) are not advertised because the core's builtin command registry is not exported from the pinned `openclaw` package and cannot be parity-asserted in CI.
- Hermes adapter: registry + publisher in `packages/hermes-tlon-adapter/commands.py` / `adapter.py`; fixture `packages/hermes-tlon-adapter/fixtures/command-manifest.json`. Advertises its 10 adapter control commands; `/tlon-version` is handled but hidden (`advertise=False`, reason: legacy alias of `/tlon version`). Hermes _core_ chat commands are never advertised (not verifiable from this repo).

Both fixtures are parity-tested against their runtime's actual registrations and parsed client-side in CI, so an advertised manifest can only list commands the bot actually handles.
