---
id: TASK-36
title: 'Stream the canvas from an %apps channel (deferred: post-card full-bleed won)'
status: To Do
assignee: []
created_date: '2026-08-21 12:06'
labels:
  - workspaces
  - interactive-cards
  - channel-views
  - apps-channel
milestone: m-3
dependencies:
  - TASK-7
  - TASK-35
references:
  - packages/api/src/client/appsApi.ts
  - docs/apps.md
  - docs/backend/channel-hosts.md
  - >-
    packages/app/ui/components/postCollectionViews/PinnedSurfaceCollectionView.tsx
priority: medium
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved then deferred in favor of the simpler presentation change: the pinned canvas (TASK-35) currently renders the agent's card post full-bleed, and the agent "streams" by editing that post in place. When frame-level streaming (skeleton → sections filling in, sub-second frames, no chat-history noise per frame) becomes worth it, the designed path is the %apps channel from TASK-7:

- The canvas renders the A2UI tree stored in an app channel document instead of a post blob; clients subscribe via the existing `subscribeAppUpdates` fact stream and re-render per write. New joiners scry current state — the channel stores only the current doc, which is what a live surface wants.
- Agent tooling: the tlon CLI has no `apps` commands — needs `tlon apps read/write <flag> --state <json> [--expected-revision n]` wrapping `appsApi` (write forwarding to a foreign host and the revision/idempotency rules are already implemented and tested agent-side).
- Provisioning creates the app channel next to the kitchen (`store.createChannel({channelType: 'app'})` already exists) and points the canvas at it via the pinnedSurface declaration's `configuration` (already plumbed to the renderer as `collectionConfiguration`).
- The post card remains the durable artifact + old-client degradation story; the app doc is the live layer.

Kit-manifest follow-up folded in here: places should be able to declare an `app` kind (and a view id) so %kits creates the app channel at install instead of provisioning — that is the TASK-15 place-vocabulary extension (`placeKindSchema` is chat|notebook|gallery and `desk/app/kits.hoon` maps only onto %channels kinds today).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tlon CLI gains apps read/write commands with idempotency ids and expected-revision, documented in SKILL.md
- [ ] #2 The pinned canvas renders the app doc's A2UI tree when the view configuration names an app channel, falling back to the post card; frames validated with the same a2ui limits
- [ ] #3 Provisioning creates the app channel and wires the canvas configuration at install
- [ ] #4 Live verify: the agent streams at least two frames into the canvas during a setup run, visible in a client without a page reload
- [ ] #5 Kit manifest place vocabulary supports an app place kind (%kits creates it), replacing the provisioning-side creation
<!-- AC:END -->
