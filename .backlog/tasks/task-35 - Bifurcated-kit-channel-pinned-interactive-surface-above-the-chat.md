---
id: TASK-35
title: 'Bifurcated kit channel: pinned interactive surface above the chat'
status: In Progress
assignee: []
created_date: '2026-08-21 02:19'
updated_date: '2026-08-21 03:02'
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
- [x] #1 A channel declaring tlon.r0.collection.pinnedSurface renders the newest interactive-surface card post in a fixed surface above the chat, with the chat list and chat composer working beneath it
- [x] #2 The pinned card's buttons work from the pinned surface (sendMessage posts into the channel; the agent's in-place edit updates the pinned card live)
- [x] #3 The pinned post does not also appear in the flowing chat list; with no surface post in the channel the view renders as a plain chat
- [ ] #4 Workspace provisioning declares the view on the kitchen place at install, and a client without the renderer degrades to the plain post list (no crash, composer notice contract unchanged)
- [x] #5 Unit tests cover pinned selection (config override, newest-surface heuristic, none present) and list exclusion
- [x] #6 Verified live in the web client on the task34-e2e kitchen: card pinned on top, chat flows beneath, Replace round-trip still works
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented and verified live (~02:15–02:20 UTC), commit follows TASK-34's. tlon.r0.collection.pinnedSurface registered as a built-in collection renderer; PinnedSurfaceCollectionView renders the surface post via ConnectedPostView (live-updating, buttons functional) in a max-55%-height bordered area, ListPostCollection beneath with the card filtered from the stream via a context override. Selection: channel pin (order[0]) if it carries a surface, else newest surface post; 5 unit tests. Provisioning declares the view on chat places post-install via the new api.getGroupChannelListing raw read + whole-listing resubmit; 4 unit tests; failures non-fatal. Declared live on task34-e2e's kitchen by hand (raw group-action-4 edit); verified in the browser: card pinned on top with Replace buttons, chat below, card absent from stream — and a Replace round-trip (sent from the sim at 22:13, not by me) edited the pinned card in place to 'Creamy tomato, spinach & basil pasta — replaced'. Screenshot scratchpad/bifurcated-kitchen.png.

Gotchas hit: the playwright-dev vite server never saw the new file (dead fs-watcher on the external volume) — fresh vite on :3010 resolved it; use that port for web checks until the shared server restarts. AC #4's live half (a fresh install auto-declaring) still unexercised — the sim app needs a Metro reload to pick up the new provisioning code, then the user's next onboarding run covers it. Wart fixed in the kit: card.md now says to create Meal Plan/Card.md when absent (the agent's edit-failure notice was echoing into the kitchen); re-seeded to both ships — needs an openclaw restart to clear the package cache before the next fresh install.
<!-- SECTION:NOTES:END -->
