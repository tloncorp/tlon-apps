---
id: TASK-35
title: 'Bifurcated kit channel: pinned interactive surface above the chat'
status: Done
assignee: []
created_date: '2026-08-21 02:19'
updated_date: '2026-08-21 13:53'
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
- [x] #4 Workspace provisioning declares the view on the kitchen place at install, and a client without the renderer degrades to the plain post list (no crash, composer notice contract unchanged)
- [x] #5 Unit tests cover pinned selection (config override, newest-surface heuristic, none present) and list exclusion
- [x] #6 Verified live in the web client on the task34-e2e kitchen: card pinned on top, chat flows beneath, Replace round-trip still works
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented and verified live (~02:15–02:20 UTC), commit follows TASK-34's. tlon.r0.collection.pinnedSurface registered as a built-in collection renderer; PinnedSurfaceCollectionView renders the surface post via ConnectedPostView (live-updating, buttons functional) in a max-55%-height bordered area, ListPostCollection beneath with the card filtered from the stream via a context override. Selection: channel pin (order[0]) if it carries a surface, else newest surface post; 5 unit tests. Provisioning declares the view on chat places post-install via the new api.getGroupChannelListing raw read + whole-listing resubmit; 4 unit tests; failures non-fatal. Declared live on task34-e2e's kitchen by hand (raw group-action-4 edit); verified in the browser: card pinned on top with Replace buttons, chat below, card absent from stream — and a Replace round-trip (sent from the sim at 22:13, not by me) edited the pinned card in place to 'Creamy tomato, spinach & basil pasta — replaced'. Screenshot scratchpad/bifurcated-kitchen.png.

Gotchas hit: the playwright-dev vite server never saw the new file (dead fs-watcher on the external volume) — fresh vite on :3010 resolved it; use that port for web checks until the shared server restarts. AC #4's live half (a fresh install auto-declaring) still unexercised — the sim app needs a Metro reload to pick up the new provisioning code, then the user's next onboarding run covers it. Wart fixed in the kit: card.md now says to create Meal Plan/Card.md when absent (the agent's edit-failure notice was echoing into the kitchen); re-seeded to both ships — needs an openclaw restart to clear the package cache before the next fresh install.

Full-bleed refinement (e2bad65ba4), per user direction — 'special-case that first message to not have an author row, a timestamp, or borders, just go full bleed': the canvas now renders the card's a2ui tree directly via a new SurfaceCanvas (live post + ContentContext + A2UIBlock fullBleed), with the button wiring extracted from StaticChatMessage into usePostA2UIActions (shared, not duplicated). A2UIBlock fullBleed lifts the 560px cap and strips the outermost Card's chrome; nested cards unchanged. Selection tightened: both blob halves (a2ui + interactive-surface) required to pin — 6 unit tests. Bug fixed en route: Row cross-axis align was forwarded as textAlign, centering all labels at full width. Verified live on :3010: edge-to-edge widget (title block, left-aligned day rows, Replace rail), chat below, no chrome anywhere — screenshot scratchpad/canvas-final.png. The %apps streaming variant is TASK-36 (deferred, specced).

Design pass (commit after e2bad65ba4), recreating the user's prototype list: A2UIBlock buttons are now 36px rounded-full pills with $label/m text (global to a2ui), heading variants carry font weight, and the auto CTA margin above button rows is skipped in fullBleed. a2ui limits raised 50→80 components and 12→20 children (sized for a divided-list card; byte/depth caps unchanged, ref-expansion guard still holds — all 11 a2ui tests pass). card.md template restructured to the prototype's anatomy: header Row (week title + right-aligned '✓ Saved'), per-day Divider + Row [caption day label, meal-name column with optional caption note, compact Replace pill], footer unchanged; names short, reasons live in the notebook; a no-cook night may drop its button (Friday in the template). SKILL.md limits line updated. The LIVE task34-e2e card was re-emitted in the new structure as ~zod (posts edit --blob --expected-revision 3 → revision 4) and verified in the browser — screenshot scratchpad/canvas-redesign.png, a close match to the prototype (remaining nit: day labels are natural-width so meal names align slightly ragged; a fixed-width day column would need an a2ui width prop). Kit re-seeded to both ships; openclaw restarted for the package cache. User's live Replace taps kept landing throughout (Sat replaced at 08:16–08:17).

App-primary inversion (third pass, per user: 'chat trapped in a sheet that slides atop the app surface… repl.it for normies'): the surface now fills the entire channel body; the conversation is a bottom sheet with a docked 56px handle (grabber, chevron, latest-message one-line preview) that expands to cover from 12% down with rounded top corners. The composer stays docked beneath the sheet — outside this view's remit — so the agent can be steered with the sheet closed; the transcript is opt-in. selectLatestChatPost picks the handle preview (excludes the surface post, skips deleted; tested — 7 tests in the file, app suite 569 green). No surface post → plain chat, which is also the onboarding arc: the view flips to app-primary when the agent's card lands. Verified live in the browser, both states — screenshots scratchpad/app-primary-collapsed.png and app-primary-expanded.png. Sim needs a Metro reload to pick this up.

AC #4 CLOSED live and the task is complete: the user's fresh onboarding run (workspace meal-plan-4f3l0j wiped-ship walkthrough, then a second fresh run) produced a kitchen that rendered app-primary on the SIMULATOR — which requires the provisioning-declared pinnedSurface configuration end to end. Simulator screenshot (scratchpad/sim-check2.png): new Aug 24–30 card in the redesigned template (the agent followed the divided-row anatomy unprompted on a fresh install — the hardened structure rule holds), sheet handle above the floating composer, panel edges continuing beneath it to the screen bottom with the input floating inside. Native-specific fixes this session: sheet docks above the floating composer via contentInsets.bottom; the panel continues beneath it (paints under the overlay — trivial on native, impossible on web where the Channel chrome carries the edges instead); composer edge-wrapper gated to web. Also: thinking indicator in the collapsed handle; horizontal-only sheet inset without drop shadow.
<!-- SECTION:NOTES:END -->
