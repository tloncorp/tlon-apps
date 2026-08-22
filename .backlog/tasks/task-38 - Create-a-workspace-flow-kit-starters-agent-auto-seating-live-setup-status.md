---
id: TASK-38
title: 'Create-a-workspace flow: kit starters, agent auto-seating, live setup status'
status: Done
assignee: []
created_date: '2026-08-21 16:47'
updated_date: '2026-08-22 13:00'
labels:
  - workspace
  - agents
  - kits
dependencies: []
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The in-app create flow should feel like onboarding: the New workspace picker offers the same kit starter options, creating one runs the real %kits provisioning (install, agent seated as admin, pinned-surface views declared), and the user watches live setup status (AgentTaskRows from the PR #6290 stack) until the app navigates into the new conversation. Also: remove the chat-list filter tabs, drop the create sheet headline, and rename the join affordance to "Paste an invite code".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Home chat list has no All/Groups/Messages tab strip
- [x] #2 Create sheet: no headline; join line reads 'Paste an invite code'
- [x] #3 New workspace opens the onboarding starter options (incl. Something else → blank kit)
- [x] #4 Creating a workspace from Home seats the user's agent as admin in the new group (verified via groups fleet scry)
- [x] #5 A setup sheet shows live provisioning steps and navigates into the conversation when the channel row syncs
- [x] #6 The onboarding 'Setting up your workspace…' notice shows the same live rows instead of static text
- [x] #7 Agent setup turns fire with kit instructions even when a stale group record exists (openclaw regression test)
- [x] #8 %kits setup-done lands on the host ledger so gateway restarts stop replaying setup conversations
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Landed across 412082670c (tabs removal), 320a32ed93 (create-flow provisioning + AgentTaskRows setup sheet + web setDevAgentShip), d3c104dc51 (openclaw stale-group scan fix), 6cb1e2b25d (%kits setup-done relay), 032cfe07aa (live rows win over the ledger's premature setup-done), b1ca3379f7 (onboarding always lands in the new workspace: handoff recorded with null channelId + reactive useWorkspaceLanding), and 590ecbf1e4 (pnpm dev:workspaces one-command rig reset). All verified live on the dev rig; branch pushed.
<!-- SECTION:FINAL_SUMMARY:END -->
