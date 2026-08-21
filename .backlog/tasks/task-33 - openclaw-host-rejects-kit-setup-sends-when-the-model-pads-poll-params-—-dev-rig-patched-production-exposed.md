---
id: TASK-33
title: >-
  openclaw host rejects kit-setup sends when the model pads poll params — dev
  rig patched, production exposed
status: To Do
assignee: []
created_date: '2026-08-21 00:10'
labels:
  - openclaw
  - infra
dependencies: []
references:
  - packages/openclaw/dev/patch-host-poll-heuristic.mjs
  - packages/openclaw/dev/entrypoint.sh
priority: high
type: bug
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
openclaw@2026.5.28's message tool refuses `action:"send"` with `Poll fields require action "poll"` whenever `hasPollCreationParams` sees any nonzero poll field. Padding models (observed: openrouter/openai/gpt-5.6-terra) fill every optional schema param — `""` for strings, `[]` for arrays, and `1` for integers they can't leave empty — so `pollDurationHours:1` rides along on every plain send and the heuristic reclassifies it as poll intent even though `pollQuestion:""`/`pollOption:[]` make poll creation impossible. The agent then retries the identical send until the turn dies (observed ~27 retries then `outcome=error`), so kit setup messages never land in the kitchen channel.

Local fix: `packages/openclaw/dev/patch-host-poll-heuristic.mjs`, run from `dev/entrypoint.sh` against BOTH host installs (`$(npm root -g)/openclaw/dist` and `/workspace/tlon/node_modules/openclaw/dist` — the gateway actually runs the plugin's hoisted copy because the entrypoint prepends its .bin to PATH). The patch makes auxiliary fields (pollDurationHours, pollMulti) count as poll intent only when an essential field (pollQuestion/pollOption) is non-empty.

Remaining exposure: production/sandbox pods run the same host version unpatched — any padded-params model there hits the same wall on kit setup and every other plain send. Resolve by (a) reporting/patching upstream openclaw, or (b) applying the same dist patch in the production pod entrypoint, and (c) on any openclaw version bump, check whether upstream fixed the heuristic and drop the patch (the script exits 1 if the code shape changed).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Upstream openclaw issue filed (or fix PR'd) for the poll-intent heuristic misfiring on padded-but-empty poll params
- [ ] #2 Production/sandbox bot entrypoint applies the same patch or runs a fixed host version
- [ ] #3 On the next openclaw version bump, the patch is re-validated or removed (script fails loudly on shape change)
<!-- AC:END -->
