---
id: TASK-8
title: Add the workspace descriptor to the group blob and detection helpers
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
updated_date: '2026-08-20 15:11'
labels:
  - workspaces
  - kits
milestone: m-1
dependencies:
  - TASK-2
references:
  - PLAN.md
priority: high
type: feature
ordinal: 2500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md defines a workspace as a secret group carrying a workspace descriptor stored in the group blob: kit identity, agent identities, named places, setup status, schedules, and permissions. Only groups carrying this descriptor receive the new app-shaped treatment; existing social groups remain Communities/Chats untouched, avoiding a disruptive migration.

Building on the kit foundation's group-blob configuration, define the descriptor schema and shared helpers so any client surface can ask "is this group a workspace?" and read its kit, places, agents, setup status, and schedules. This descriptor is what onboarding provisioning writes and what the Workspace IA milestone keys off.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workspace descriptor schema (kit identity, agent identities, named places, setup status, schedules, permissions) is defined and typed in shared code
- [ ] #2 Shared helpers exist to detect whether a group is a workspace and to read/update descriptor fields
- [ ] #3 Groups without a descriptor are completely unaffected — no behavior or rendering change for existing groups
- [ ] #4 A malformed or partial descriptor fails safe: the group is treated as a plain group, not a broken workspace
- [ ] #5 Tests cover descriptor round-trip, detection, and malformed-descriptor handling
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

One decision needs you — §2, whether the descriptor *is* the kits entry or sits beside it. That choice determines everything else, so I have kept the rest short.

### 1. Most of this already exists, which changes the shape of the task

`GroupKitEntry` (`packages/tlon-kits/src/groupConfig.ts`) already carries five of the six things AC #1 names:

| AC #1 asks for | already in `GroupKitEntry` |
| --- | --- |
| kit identity | `kit: {id, version, publisher}` |
| agent identities | `agents: string[]` |
| named places | `places: Record<string, string>` — abstract name → nest |
| setup status | `setup: 'pending' \| 'done'` |
| schedules | `schedules: {id, cron}[]` |
| **permissions** | **missing** |

It also already fails safe in exactly the way AC #4 wants: `parseGroupKitConfig` returns null for a non-JSON blob, an unrecognized payload, or an unsupported version; skips malformed `kits[]` entries individually rather than failing the whole config; and `setup` uses `.catch('done')` so an unreadable value cannot re-run a setup conversation. The envelope and every entry are `.passthrough()`, so unknown keys survive a read-modify-write — which the SCHEMA.md versioning rules require.

So the honest description of this task is **not** "define a descriptor". It is: *decide where the descriptor lives relative to the kits config, add permissions, add the detection and read/update helpers, and prove the fail-safe behaviour that is currently only implied.*

### 2. Decision — descriptor as the kits entry, or a sibling key

PLAN.md says a workspace is a group carrying a workspace descriptor. The kits config already marks kit-installed groups. Two readings:

- **(a) The kits entry *is* the descriptor.** "Is this group a workspace?" becomes "does its blob carry a kit install?". One schema, one writer, no sync problem, and provisioning already writes it. Add `permissions` to the entry and the helpers read from there.
- **(b) A sibling `workspace` key in the blob envelope,** alongside `kits`. The envelope is `.passthrough()`, so `{version, kits, workspace}` is already legal and old readers ignore it. Separates "this group runs a kit" from "this group is a workspace", which matters if a kit is ever installed into an ordinary community — a real possibility, since `%kits` installs into any group.

**I recommend (a),** with one caveat I want to state rather than bury. It is genuinely simpler: no second schema to keep in step, no window where a group has one and not the other, and no ambiguity about which one provisioning must write. The caveat is that it *fuses* two concepts that PLAN.md keeps separate, so the day someone installs a kit into an existing community, that community becomes a workspace and gets the app-shaped treatment — which AC #3 is specifically trying to prevent for existing groups.

That is a real risk, and (b) is the answer if you think kit-in-a-community is a case we will actually hit. It costs one more schema and one more field to write at provisioning. If you pick (b) I would make `workspace` minimal — a marker plus `permissions` — and have the helpers read the rest from the kit entry rather than duplicating it, so there is still one source of truth per field.

**This is the decision I need.** Everything below is written for (a) and is a small edit either way.

### 3. Permissions — what the field actually holds

The one genuinely new field, and worth getting right rather than inventing a policy language. Three candidates:

- **A capability list** — what the workspace's agent is allowed to do (`postToPlaces`, `editOwnPosts`, `runSchedules`, `readContacts`). This is what `docs/kits.md` means by "a kit's power is bounded by the policy the owner grants", and it is the same shape as a kit's `policy` patch.
- **Member roles** — who may act. Already lives in `%groups` roles and the channel `can-read`/`can-write` gates; duplicating it in the blob would create a second, drifting source of truth. **Not this.**
- **Both.**

**I recommend the capability list**, typed as a `string[]` of known capability ids with unknown ones preserved and ignored. Member permissions stay in `%groups`, which is where every other reader already looks and where `%apps` and `%notes` both defer.

Kept as strings rather than an enum for the same reason the channel view registry stays open: a workspace descriptor written by a newer client is a normal input, and an unrecognized capability must degrade to "not granted", never to "malformed descriptor".

### 4. Helpers — AC #2

New module in `packages/shared/src/logic/` beside `groupBlobSupport.ts`, re-exported through `logic/index.ts`:

```ts
isWorkspace(group): boolean
readWorkspaceDescriptor(group): WorkspaceDescriptor | null
workspacePlace(descriptor, name): string | null
workspaceHasCapability(descriptor, capability): boolean
updateWorkspaceDescriptor(blob, patch): string   // read-modify-write
```

Two constraints on the update helper, both from SCHEMA.md's versioning rules and both easy to get wrong:

- It must **read-modify-write the whole payload**. Anything not re-emitted is lost, exactly as with post blobs — and I have now hit that same class of bug twice (TASK-9's `posts edit`, TASK-12's `rebuildBlobWithSurface`). It should walk the raw JSON rather than reserialize parsed output, so an entry a newer client wrote survives byte-for-byte.
- Writers are last-write-wins on the cord for v1. That is accepted, and worth a comment rather than a fix.

Where the helpers take a `db.Group`, they read `group.blob` — already a real column (`schema.ts:514`) and already parsed by `api.parseGroupKitConfig`.

### 5. AC #3 — proving existing groups are unaffected

This is the criterion most likely to be quietly false, so it wants more than a passing test.

Every helper returns "not a workspace" for a group whose blob is null, and **nothing existing calls them yet** — this task adds no call sites in rendering or behaviour. So AC #3 holds by construction at this point, and the honest way to record that is:

- a test that a blob-free group reads as a plain group through every helper, and
- stating plainly that the risk arrives with the *consumers* (TASK-14, TASK-17–19), not here.

I would rather say that than claim a rendering guarantee this task cannot make.

### 6. Tests — AC #5

In `packages/shared`, beside the module:

- **Round trip** — write a descriptor, read it back, fields intact including an unknown capability and an unknown top-level key.
- **Detection** — blob-free group is not a workspace; kit-carrying group is; blob present but empty `kits` is not.
- **Malformed** — non-JSON, wrong version, `kits` not an array, an entry missing `installId`, an entry whose `setup` is garbage. Each reads as a plain group or skips just that entry; none throws. This is AC #4, and the existing `groupConfig.test.ts` already covers the parse half, so these test the descriptor layer on top.
- **Update preserves the unknown** — the read-modify-write case from §4, asserted on the bytes.
- **Capability** — unrecognized capability is "not granted", not an error.

### 7. Verification

`pnpm -r tsc`, the shared and api suites, prettier. No Hoon, no ship: the blob is opaque `@t` to the backend, so this is entirely client-side typing and parsing.

### 8. What this does not do

- **No rendering or behaviour change.** Keying the app-shaped treatment off the descriptor is TASK-14 and TASK-17–19.
- **No provisioning.** Writing a descriptor during onboarding is TASK-16.
- **No permission enforcement.** This defines and reads the capability list; honouring it is the executing agent's job.
- **No kit content.** The meal-planning kit is TASK-13, which is blocked on this and is the first real consumer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**The descriptor substantially already exists.** `GroupKitEntry` in `packages/tlon-kits/src/groupConfig.ts` carries `kit {id,version,publisher}`, `agents: string[]`, `places: Record<abstract, nest>`, `setup: 'pending'|'done'`, `schedules: {id,cron}[]`, and `installedAt`. That is five of the six things AC #1 lists; only **permissions** is missing. So this task is mostly "decide where the descriptor lives relative to the kits config, add permissions, add helpers" rather than defining a schema from scratch.

**The fail-safe behaviour AC #4 asks for is already implemented, and deliberately.** `parseGroupKitConfig` returns null for a non-JSON blob, a payload that is not a kits payload, or an unsupported version; it `flatMap`s `kits[]` so a malformed entry is skipped without losing its siblings; and `setup` uses `.catch('done')` with a comment explaining why — an unreadable value must not re-run a setup conversation that already posted and wrote scaffolds. Both the envelope and every entry are `.passthrough()`, so unknown keys survive, which SCHEMA.md's versioning rules require. The existing `groupConfig.test.ts` covers the parse half of AC #4 already.

**The envelope has room for a sibling key.** `envelopeSchema` is `{version: number, kits: array}.passthrough()`, so `{version, kits, workspace}` is already legal and old readers ignore the extra key. That makes option (b) in the plan cheap rather than a migration.

**There is a genuine conceptual question here, not just a placement one.** PLAN.md treats "is a workspace" and "has a kit installed" as separate facts, but `%kits` installs into any group, so fusing them means installing a kit into an existing community silently turns that community into a workspace — which is precisely what AC #3 is trying to prevent. Hence the §2 decision rather than a quiet choice.

**Existing client-side blob support is thin.** `packages/shared/src/logic/groupBlobSupport.ts` is 23 lines and only does version gating (`groupsVersionSupportsBlob`, min `12.2.0`, conservative on unparseable semver, mirroring `activityVersionSupportsNotes`). There is no descriptor reading anywhere yet. `group.blob` is a real column (`schema.ts:514`), and `api.parseGroupKitConfig` (`packages/api/src/client/groupKitConfig.ts`) is the existing wrapper that logs its rejection reason.

**Only two consumers of the parse today**, both read-only: `packages/openclaw/src/kits/group-config.ts` and `packages/api/src/client/groupKitConfig.ts`. Nothing renders off it. So AC #3 ("existing groups completely unaffected") holds by construction for this task — the risk arrives with the consumers in TASK-14 and TASK-17–19, and I would rather say that than imply this task proves a rendering guarantee it cannot.

**The read-modify-write hazard is the same one I have now hit twice.** SCHEMA.md: "Blob writers must read-modify-write the whole payload." That is the identical rule as post blobs, where TASK-9 found `tlon posts edit` erasing blobs and TASK-12 found my own first `rebuildBlobWithSurface` dropping entries the parser could not validate. The update helper here should walk the **raw** JSON rather than reserialize parsed output, or a descriptor written by a newer client loses whatever this build cannot parse.

**Permissions should not duplicate membership.** `%groups` already owns roles, and both `%notes` and `%apps` defer to its `can-read`/`can-write` gates rather than keeping their own copy — TASK-7 established that pattern and `docs/backend/channel-hosts.md` writes it down. A member-permission list in the blob would be a second, drifting source of truth. The capability-list reading (what the *agent* may do) is the one that has no existing home, and it matches what `docs/kits.md` means by "a kit's power is bounded by the policy the owner grants, not by its text."

**No backend work.** The blob is opaque `@t` to `%groups`; it stores and relays it without inspecting it. This is entirely client-side typing and parsing, so no ship, no Hoon, no desk build.
<!-- SECTION:NOTES:END -->
