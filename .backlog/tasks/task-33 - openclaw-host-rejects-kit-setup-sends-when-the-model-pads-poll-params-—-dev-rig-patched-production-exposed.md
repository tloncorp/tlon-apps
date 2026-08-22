---
id: TASK-33
title: >-
  openclaw host rejects kit-setup sends when the model pads poll params — dev
  rig patched, production exposed
status: To Do
assignee: []
created_date: '2026-08-21 00:10'
updated_date: '2026-08-22 20:40'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (researched 2026-08-22)

The dev-rig half is done and stable (dev/patch-host-poll-heuristic.mjs, run by dev/entrypoint.sh against both host installs). Three pieces remain, matching the ACs:

1. **AC #1 — upstream.** File an issue on github.com/openclaw/openclaw against `src/poll-params.ts` (openclaw@2026.5.28): `hasPollCreationParams` treats any nonzero auxiliary field (pollDurationHours, pollMulti) as poll intent, so padding models (observed: openrouter/openai/gpt-5.6-terra, which fills every optional param — `""`, `[]`, `1`) get every plain `action:"send"` rejected with `Poll fields require action "poll"`, retry-looped ~27 times, and the turn dies. Proposed fix (identical to our dist patch): honor the auxiliary-param sweep only when an essential field (pollQuestion/pollOption) is non-empty. Include the repro payload and the patch diff. If maintainers are receptive, follow with a PR (needs a fork; the change is ~6 lines plus a test).
2. **AC #2 — production/sandbox pods.** The pods start via the tlonbot repo's entrypoints (`entrypoint/shard.py` / `tlawn.py`), which run the host from its own install (not this repo's dev entrypoint). Cross-repo change: vendor `patch-host-poll-heuristic.mjs` into tlonbot (or fetch it from the plugin package, which ships `dev/` in its files? — verify; vendoring is simpler) and invoke it during pod startup against the pod's openclaw dist, before the gateway starts. Same idempotency and fail-loud-on-shape-change semantics as the dev rig. Needs a tlonbot PR + a pod restart via bot-harness-deploy.
3. **AC #3 — bump guard.** Add a step to openclaw-ci.yml's unit job: run the patch script against a throwaway copy of the freshly installed `node_modules/openclaw/dist`. The script already exits 1 when the code shape changed (a version bump moved/fixed the heuristic) and 0 when the validator is gone — so a host bump that invalidates the patch fails CI with a message telling the bumper to re-validate or delete the patch, instead of production silently running an unpatched heuristic.

Sequencing: (3) is self-contained in this repo — do first. (1) is a write-up — no repo changes. (2) lands in tlonbot and needs a deploy window.

Note: if TASK-31 ships first, kit setup's FINAL message routing changes shape slightly, but the poll-heuristic rejection hits every plain send from a padding model, not just setup — the fix stays necessary regardless.
<!-- SECTION:PLAN:END -->
