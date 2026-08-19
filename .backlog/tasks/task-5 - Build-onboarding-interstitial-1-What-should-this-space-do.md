---
id: TASK-5
title: 'Build onboarding interstitial 1: "What should this space do?"'
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - onboarding
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - packages/app/ui/components/Wayfinding/SplashSequence.tsx
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md replaces the current multi-pane onboarding wizard (packages/app/ui/components/Wayfinding/SplashSequence.tsx exposes bot identity, provider, model, group, and invitation) with exactly two interstitials before landing in a real workspace.

Screen 1 asks "What should this space do?" and offers three concrete shared starters — weekly meals + grocery list (recommended), garden plan + shared reminders, household tasks + recurring routines — plus a secondary "Something else" path that must not be the primary flow. Bot naming, avatar, provider, model, and connected services move out of onboarding to settings or later contextual prompts.

The starter list should match the wedge confirmed by the capability-matrix spike; build with the three PLAN.md defaults unless that spike revises them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Screen presents the three starter options with meal planning visually recommended, plus a de-emphasized Something else option
- [ ] #2 Selecting a starter records the chosen kit and advances to interstitial 2 with no intermediate panes
- [ ] #3 No bot identity, provider, model, or group configuration appears anywhere in the screen
- [ ] #4 Screen renders correctly on mobile and desktop/web navigation stacks
- [ ] #5 Component tests cover option selection and the Something else path
<!-- AC:END -->
