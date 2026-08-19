---
id: TASK-22
title: 'Chat landing: starter artifact, one clear action, first result in 90 seconds'
status: To Do
assignee: []
created_date: '2026-08-19 13:49'
labels:
  - workspaces
  - onboarding
  - ui
milestone: m-1
dependencies:
  - TASK-4
  - TASK-13
  - TASK-16
references:
  - PLAN.md
  - packages/app/ui/components/Wayfinding/BotChatPreview/mockConversation.ts
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The moment of value from PLAN.md: after the two interstitials, the user lands directly in the real workspace conversation — not a demo or mock. The landing must show: (1) a starter artifact already visible, (2) one meaningful action the user can take immediately, (3) live task rows showing agent progress (e.g., "Drafting plan → Saving grocery list → Ready"), and (4) a completed durable artifact within a target of 90 seconds.

The existing onboarding uses a mocked gardening conversation (packages/app/ui/components/Wayfinding/BotChatPreview/mockConversation.ts); this replaces mock content with the real provisioned workspace. If provisioning is still finishing when the user arrives, the landing must handle that gracefully rather than showing an empty room.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User lands in the real provisioned workspace conversation immediately after interstitial 2
- [ ] #2 A starter artifact is visible at landing and one clear next action is presented
- [ ] #3 Agent progress renders as live task rows from landing through first-artifact completion
- [ ] #4 The first durable artifact completes and is visible within 90 seconds on a typical connection
- [ ] #5 Arriving before provisioning finishes shows honest in-progress state, and killing/reopening the app during landing returns to a consistent state
- [ ] #6 No mock conversation content appears anywhere in the flow
<!-- AC:END -->
