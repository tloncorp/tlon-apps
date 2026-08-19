---
id: TASK-16
title: 'Provision the workspace in the background during onboarding, with recovery'
status: To Do
assignee: []
created_date: '2026-08-19 13:49'
labels:
  - workspaces
  - onboarding
  - agent
milestone: m-1
dependencies:
  - TASK-8
  - TASK-13
references:
  - PLAN.md
  - branch cron-prompt-onboarding
  - branch agent-onboarding-v2
  - packages/openclaw/src/session-route.ts
priority: high
type: feature
ordinal: 5400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: while the user is on the two onboarding interstitials, the system provisions everything behind the scenes — a secret group with membership and permissions, the notes-backed artifact space, the user's agent seated as an explicit authenticated member with a stable task-specific session, the selected starter kit installed, and the workspace descriptor written.

Retain the provisioning, recovery, trusted-agent, and telemetry work from the cron-prompt-onboarding and agent-onboarding-v2 branches; discard their conversational wizard and session-only UI state. Provisioning must survive the user killing/reopening the app or backgrounding it mid-flow (this is explicitly on the live review checklist).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Completing the interstitials yields a secret group with the agent seated as a member, a notes artifact space, the chosen kit installed, and a complete workspace descriptor
- [ ] #2 Provisioning runs concurrently with the interstitials and does not block screen transitions
- [ ] #3 Killing and reopening the app mid-provisioning resumes or recovers to a complete workspace without duplicates
- [ ] #4 Backgrounding the app during provisioning does not corrupt or orphan the workspace
- [ ] #5 A provisioning failure surfaces a recoverable state, never a half-configured workspace presented as ready
- [ ] #6 Setup status in the descriptor reflects provisioning progress and completion
<!-- AC:END -->
