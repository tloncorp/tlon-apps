---
id: TASK-27
title: Let a kit declare a place backed by a third-party channel host
status: To Do
assignee: []
created_date: '2026-08-20 15:42'
labels:
  - workspaces
  - kits
  - platform
  - hoon
milestone: m-1
dependencies:
  - TASK-2
  - TASK-7
references:
  - PLAN.md
  - desk/app/kits.hoon
  - packages/tlon-kits/src/manifest.ts
  - kits/SCHEMA.md
  - docs/backend/channel-hosts.md
priority: high
type: feature
ordinal: 2700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A workspace needs a durable artifact store, but a kit cannot currently declare one that is not deprecated.

A kit's place vocabulary is `chat | notebook | gallery`, and %kits instantiates every place with a single create poke to %channels. So the only durable-document option a kit can name is `notebook`, which becomes a %diary channel — and %diary is deprecated and replaced by %notes, with an owner migration path already shipped. Building the hero workspace on it would mean shipping an artifact store that needs migrating on day one.

Extend the vocabulary so a kit can name a place backed by a third-party channel host, and teach install to create it through that host rather than through %channels. %notes is the case that unblocks the meal-planning kit; %apps (structured app-channel state) is the same seam and should not require a second extension.

This is the backend half of the workspace's artifact store. The kit content that uses it is tracked separately and is blocked on this.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A kit manifest can declare a place backed by %notes, and the place vocabulary and its host mapping are documented in kits/SCHEMA.md
- [ ] #2 Installing a kit that declares a notes place creates that channel in the workspace group and records its nest in the group blob's places map under the kit's abstract place name
- [ ] #3 A group member other than the installer can read and write the created place, inheriting the group's permissions rather than a separate grant
- [ ] #4 A kit declaring a place kind this build does not support is rejected at install with a clear error, rather than partially installing or silently creating a different channel type
- [ ] #5 Existing kits declaring only chat, notebook, or gallery places install exactly as before, with no change to the nests they produce
- [ ] #6 Adding a further host-backed place kind requires no new branch in the install path beyond its host mapping
- [ ] #7 Agent (Hoon) tests cover install with a notes place, the unsupported-kind rejection, and the unchanged behaviour for existing place kinds
<!-- AC:END -->
