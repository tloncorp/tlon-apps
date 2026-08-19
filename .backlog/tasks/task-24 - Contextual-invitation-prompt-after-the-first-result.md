---
id: TASK-24
title: Contextual invitation prompt after the first result
status: To Do
assignee: []
created_date: '2026-08-19 13:50'
labels:
  - workspaces
  - onboarding
milestone: m-1
dependencies:
  - TASK-22
references:
  - PLAN.md
priority: medium
type: feature
ordinal: 6400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md activation milestone: for users who continued alone at interstitial 2, offer the invitation contextually after the first result — when there is something real to share ("invite your partner to see this meal plan") rather than an abstract ask upfront.

Invitations use the existing group invitation machinery; the invitee accepts into the workspace experience (not a raw group channel list). Skip the prompt entirely for users who already invited someone during onboarding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A solo user sees an invitation prompt in context after the first artifact completes, framed around sharing the artifact
- [ ] #2 Users who already invited someone during onboarding never see the prompt
- [ ] #3 Sending the invitation delivers a standard workspace invitation; the recipient accepting lands in the workspace experience
- [ ] #4 Dismissing the prompt does not block further work and does not re-prompt in the same session
- [ ] #5 Tests cover solo-user prompt, already-invited suppression, and dismissal
<!-- AC:END -->
