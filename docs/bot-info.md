# Bot info

Bots publish **who they are** — harness and versions — in their own contact profile. The Tlon client reads that claim off the synced contact record and uses the claimed harness to pick one of its own static slash-command lists for the bot's conversations.

Bots do **not** publish what they can do. Command lists live in the app (`packages/shared/src/domain/slashCommands.ts`), bound to each runtime's actual command registry by a CI drift contract (see [Command lists](#command-lists)). A command change therefore ships as an app release, and a third-party bot cannot advertise custom commands — an unknown or absent harness gets the default (OpenClaw) list.

No Hoon/desk changes are involved: a v1 contact is an open key-value map (`+$ contact (map @tas value)`, `desk/sur/contacts.hoon`), unknown keys pass validation and replicate to subscribers, and the client's contacts pipeline carries the key through.

## Wire format

-   Contact key: `bot-info` (`@tas`-safe).
-   Value: a `%text` contact field whose text is JSON.
-   The claim is self-published by the bot ship via a `%self` contact action (a merge — nickname/avatar/other keys survive), and propagates to peers through ordinary contact sync (`/v1/news` `%peer`/`%page` facts, `/v1/book`, `/v1/contact/{ship}`).

```json
{ "type": "text", "value": "{\"v\":1,\"harness\":\"openclaw\",\"version\":\"0.19.0\",\"harnessVersion\":\"2026.5.28\"}" }
```

## JSON schema

```json
{
    "v": 1,
    "harness": "openclaw",
    "version": "0.19.0",
    "harnessVersion": "2026.5.28"
}
```

| field            | type                | notes                                                                                                                                   |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `v`              | `number`            | Format version. Anything other than `1` rejects the whole claim.                                                                        |
| `harness`        | `string` (required) | Non-empty. Matched **case-sensitively** against known ids (`openclaw`, `hermes`); anything else is stored but selects the default list. |
| `version`        | `string` (required) | Non-empty. The plugin/adapter's own version — first-party knowledge.                                                                    |
| `harnessVersion` | `string` (optional) | Non-empty when present. The underlying agent runtime's version; a diagnostic rider, never load-bearing.                                 |

Unknown fields are ignored (forward compatibility). Wrong types — arrays, numbers, `null` where a string belongs — reject the claim rather than being coerced.

### Why `harnessVersion` is optional

It is a diagnostic rider on an identity claim, and a missing rider must never invalidate the claim. The sources below are conventions of the current host versions, not APIs; a future host restructuring them must cost a diagnostic field, never harness selection. Publishers treat a failed sourcing as a loud warning in their own logs — for the in-repo runtimes it always indicates breakage — while the wire stays tolerant.

-   OpenClaw: `api.runtime.version` (the plugin SDK's host runtime).
-   Hermes: `from hermes_cli import __version__, __release_date__` → `"0.17.0 (2026.6.19)"`. Both numbers: the SemVer alone matches nothing the pins or the README use, and the CalVer matches the release tag. This is byte-for-byte the source core's own `/version` command reads, guaranteed importable because the gateway process itself is `hermes_cli`. Fallback: `importlib.metadata.version("hermes-agent")` (SemVer only; beware editable-install staleness — dist-info freezes at install time). Then omit. Never `git describe` (production strips `.git`) and never a `hermes --version` subprocess.

### These are version claims, not code-identity claims

The constants bump at release-cut, so a build off an unreleased ref reports the last release. Commit-level identity (`get_build_sha()`) exists but returns nothing in current environments; if it is ever wanted, it becomes a separate optional `harnessCommit` — never folded into `harnessVersion`.

## Caps

Client-enforced at parse time, in one pure function (`parseBotInfo` in `packages/shared/src/domain/slashCommands.ts`):

-   Raw claim: ≤ **512 UTF-8 bytes** (`new TextEncoder().encode(raw).byteLength` in TS, `len(raw.encode('utf-8'))` in Python).
-   Each field: ≤ **64 Unicode code points**, non-empty.

These are abuse bounds on an identity field, not a data budget. The backend additionally caps the **whole jammed profile** (bio, groups, attestations, claim included) at 10 kB (`desk/lib/contacts.hoon`), so publishers must treat a rejected poke as a real, non-fatal outcome — the bot keeps working and clients fall back to the default list.

## Publishing

Compare-then-poke at boot (and on reconnect catch-up): compute the claim JSON, read the current self-contact (`/contacts/v1/self`), and poke only when the value differs. Byte-stable serialization (fixed key order) so the comparison does not false-positive. Example poke, via Eyre or any existing poke path:

```json
{
    "app": "contacts",
    "mark": "contact-action-1",
    "json": {
        "self": {
            "bot-info": {
                "type": "text",
                "value": "{\"v\":1,\"harness\":\"openclaw\",\"version\":\"0.19.0\"}"
            }
        }
    }
}
```

## Clearing the key (rollback / retirement)

`%self` is a merge: contact keys die only by explicit `null`. Reverting or downgrading a runtime, or retiring a bot, leaves the last-published claim in the profile until it is cleared. Poke:

```json
{
    "app": "contacts",
    "mark": "contact-action-1",
    "json": { "self": { "bot-info": null } }
}
```

runnable via each runtime's existing poke path or curl against Eyre. Clients then fall back to the default list. A runtime _switch_ needs no clearing — the new runtime's differing claim overwrites on first boot.

## Client consumption

-   The raw JSON is stored on the contact row (`contacts.bot_info`) and validated only at read.
-   `useBotSlashCommandManifest` (`packages/shared/src/store/useBotSlashCommandManifest.ts`) resolves the bot ship for DM channels, parses the claim, and passes `harness` to `getStaticSlashCommandManifest`. Gating (which conversations get a popup at all) is unchanged.
-   Cold-start backfill: the legacy v0 `/all` peers scry strips namespaced keys, so the client fetches `/v1/contact/{ship}` on demand for qualifying bot channels that lack a claim.

## Command lists

Each harness's static list in `packages/shared/src/domain/slashCommands.ts` is split into two explicitly named parts:

-   **`*_RUNTIME_COMMANDS`** — what the runtime itself handles. Each runtime commits a token-only fixture generated from its own command registry (`packages/openclaw/fixtures/commands.json`, `packages/hermes-tlon-adapter/fixtures/commands.json`), and `packages/shared/src/domain/runtimeCommandContract.test.ts` asserts the fixture's tokens and the static list's tokens are equal once both are sorted. An addition, a removal, or a duplicate in a runtime turns that test red on the PR that makes it — note that sorted-sequence equality is what catches the duplicate; comparing `Set`s instead would silently drop that case. The CI job `bot-checks` runs the contract so a runtime-only PR — which skips the app-wide suite — still executes it.
-   **`*_CORE_COMMANDS`** — host-provided commands the runtime neither registers nor dispatches. Neither host exposes its registry to us, so no CI binding is possible: these are deliberate, audit-pinned constants, and changing one means re-auditing the host first. The audit citations live in comments on the lists.

The split is display-neutral. Presentation order comes from each entry's `priority` — `rankSlashCommands` sorts by it and never by array position — so membership lives in the two arrays and ordering lives in the priorities, asserted through the production ranking function in `packages/app/ui/components/BareChatInput/useSlashCommands.test.ts`.

**Removals are two-phase.** Hosted bots redeploy from the tracked branch on container restart while the app releases slowly, so removing a runtime command means keeping its handler alive until an app release stops suggesting it. The contract test turning red on the removal PR is the reminder.

### Icons

Static-list entries carry an `icon`: the **name** of a glyph in the client's built-in icon set (`packages/ui/src/assets/icons`) — not a URL and not an image. Unknown names degrade to the generic command glyph; `packages/app/ui/components/SlashCommandPopup.test.ts` asserts every name in every static list resolves, so a typo cannot silently degrade.
