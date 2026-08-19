---
id: TASK-21
title: 'Build action replay, snapshots, upgrade, and recovery for kit surfaces'
status: To Do
assignee: []
created_date: '2026-08-19 13:49'
labels:
  - workspaces
  - platform
milestone: m-3
dependencies:
  - TASK-6
  - TASK-15
references:
  - PLAN.md
  - commit 385fbe9f0
priority: low
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Final platform-milestone prerequisite from PLAN.md before allowing arbitrary mini-app code: the action-log/reducer/render model from the mini-app demo (commit 385fbe9f0) is the right mental model, but it needs action replay, state snapshots, upgrade handling, and recovery.

Deliver the durability layer for kit surfaces: an append-only action log with periodic snapshots, deterministic replay to reconstruct state, state migration across kit version upgrades, and recovery from corrupt or divergent state. Client-executed JavaScript bundles remain out of scope until this and the signing/capability work are done.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Surface state can be reconstructed by replaying the action log from the latest snapshot and yields the same state
- [ ] #2 Snapshots bound replay time and old log entries can be compacted without changing reconstructed state
- [ ] #3 Upgrading a kit version migrates or replays existing state without data loss
- [ ] #4 Corrupt or divergent state is detected and recovers to the last consistent snapshot with the divergence reported
- [ ] #5 Tests cover replay determinism, snapshot compaction, upgrade migration, and corruption recovery
<!-- AC:END -->
