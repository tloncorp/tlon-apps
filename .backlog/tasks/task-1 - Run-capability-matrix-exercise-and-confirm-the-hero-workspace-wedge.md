---
id: TASK-1
title: Run capability matrix exercise and confirm the hero workspace wedge
status: To Do
assignee: []
created_date: '2026-08-19 13:46'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - product
milestone: m-0
dependencies: []
references:
  - PLAN.md
priority: high
type: spike
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md proposes making Workspace the product primitive with Groups as hidden infrastructure. Before building, the team needs to validate the first activation wedge (meal planning is the recommended default) via a structured exercise.

Capture each candidate workspace idea in a matrix with columns: user job, people or agents involved, required authenticated action, durable data produced, trigger (tap / message / event / schedule), possible today?, missing dependency. Cross off anything requiring arbitrary generated UI, unsupported integrations, or unclear permissions. Cluster what remains into templates and select one shared-domestic hero (candidates: weekly meals + grocery list, garden plan + reminders, household tasks + routines).

The outcome gates the content of the starter kit and the onboarding starter options in milestone 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Capability matrix exists as a Backlog document or docs/ file covering all candidate ideas with the seven columns from PLAN.md
- [ ] #2 Ideas requiring arbitrary generated UI, unsupported integrations, or unclear permissions are explicitly crossed off with the blocking reason recorded
- [ ] #3 One hero template is selected and recorded with rationale
- [ ] #4 The three starter options for onboarding screen 1 are confirmed or revised based on the matrix
<!-- AC:END -->
