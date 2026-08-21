---
id: TASK-35
title: 'Bifurcated kit channel: pinned interactive surface above the chat'
status: In Progress
assignee: []
created_date: '2026-08-21 02:19'
labels:
  - workspaces
  - interactive-cards
  - channel-views
  - demo
milestone: m-1
dependencies:
  - TASK-34
references:
  - packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx
  - packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx
  - packages/api/src/client/channelContentConfig.ts
  - docs/tlon-apps/channel-views.md
  - packages/shared/src/store/workspaceProvisioning.ts
priority: high
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Direct user request continuing TASK-34's demo: "bifurcate the channel to give it a static message that's 'pinned' at the top where the in-channel widget UI goes, then allows the chat to flow underneath it. the idea here is a little mini-app that sits above the chat."

Architecture: a new built-in **collection renderer** in the components-kit registry — `tlon.r0.collection.pinnedSurface` — that renders the channel's current interactive-surface card in a fixed area at the top (using the context's standard `PostView`, so surface buttons keep working) and delegates the flowing chat below to the existing `ListPostCollection` (with the pinned post filtered out of the stream to avoid duplication). The composer and post renderer stay `chat`. A channel opts in by declaring the id in its `contentConfiguration` (`defaultPostCollectionRenderer`), which lives in the group channel listing's structured description and replicates to every member; clients without the renderer degrade to the plain post list per the channel-views contract.

Pinned-post selection v1: `collectionConfiguration.pinnedPostId` when the declaration carries one, else the newest loaded post whose blob parses to an a2ui + interactive-surface pair. The agent's weekly card edit-in-place means the same post stays pinned across updates, and a new week's card (newer post) takes over automatically.

Declaration writers: workspace provisioning declares the view on the kit's kitchen place after install (JS-side, no Hoon change); the kit-manifest-declared variant (places naming a view id, written by %kits at create) is follow-up work under the TASK-15 place-vocabulary extension.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A channel declaring tlon.r0.collection.pinnedSurface renders the newest interactive-surface card post in a fixed surface above the chat, with the chat list and chat composer working beneath it
- [ ] #2 The pinned card's buttons work from the pinned surface (sendMessage posts into the channel; the agent's in-place edit updates the pinned card live)
- [ ] #3 The pinned post does not also appear in the flowing chat list; with no surface post in the channel the view renders as a plain chat
- [ ] #4 Workspace provisioning declares the view on the kitchen place at install, and a client without the renderer degrades to the plain post list (no crash, composer notice contract unchanged)
- [ ] #5 Unit tests cover pinned selection (config override, newest-surface heuristic, none present) and list exclusion
- [ ] #6 Verified live in the web client on the task34-e2e kitchen: card pinned on top, chat flows beneath, Replace round-trip still works
<!-- AC:END -->
