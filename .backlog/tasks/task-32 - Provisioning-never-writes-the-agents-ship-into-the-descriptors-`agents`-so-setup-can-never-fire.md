---
id: TASK-32
title: >-
  Provisioning never writes the agent's ship into the descriptor's `agents`, so
  setup can never fire
status: To Do
assignee: []
created_date: '2026-08-20 21:55'
labels:
  - workspaces
  - kits
  - openclaw
  - onboarding
dependencies: []
priority: high
type: bug
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`%kits` writes `agents: [our]` at install — the *installing* ship (`desk/lib/kits-json.hoon:125`, `['agents' a+~[s+(scot %p our)]]`). But `agents` means "which ships' agents may execute this workspace's kit" (`workspaceAgents` in `packages/shared/src/logic/workspaceDescriptor.ts`), and the agent is a **different ship** — a separate bot @p seated as a group member, per TASK-16 AC #1 ("a secret group with the agent seated as a member").

Nothing ever corrects it. `grep agents packages/shared/src/store/workspaceProvisioning.ts` returns nothing: TASK-16 seats the agent via `ensureWorkspaceAgentSeated` but never updates the descriptor. So the descriptor claims the human's ship is the executing agent.

The consequence is that setup can never fire. `shouldFireSetup` (`packages/openclaw/src/kits/setup.ts:37`) requires `entry.agents.includes(botShip)`, and `botShip` is the harness's own ship. Installer ≠ bot, so the gate is always false — the kit's `install.setup` instruction never runs and the starter artifact never appears.

**This is not local-rig-only.** In production the bot is a moon (`~moon-sampel`), a different `@p` from the installing ship (`~sampel`), so the same mismatch holds. Observed on the walkthrough rig: three workspaces on `~ten`, all with both places created correctly, all stuck at `setup: "pending"` with an agent that could never claim them.

Related gap found alongside it: TASK-16 deliberately does not write the descriptor at all, to avoid racing `%kits`' own blob write (last-write-wins on the cord). So "who writes `agents` after seating, and how without clobbering the install's write" is the actual design question — possibly `%kits` should take the agent ship as an install parameter rather than assuming `our`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After provisioning, the descriptor's `agents` names the ship whose harness will execute the kit, not the installing ship
- [ ] #2 A kit install by ~ten with a bot on ~zod fires setup, and the starter artifact appears
- [ ] #3 Whatever writes `agents` does not race or clobber the blob write %kits performs during install
- [ ] #4 Production's moon-based bot satisfies the same path — the fix is not specific to two independent ships
- [ ] #5 A test covers installer ≠ agent, so the case that is broken today cannot silently return
<!-- AC:END -->
