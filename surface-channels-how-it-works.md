# Surface Channels — how it works

A **surface channel** is a Tlon channel that renders a small live app instead of
a message list. A bot writes the app; group members use it. Polls, RSVPs,
signup sheets, trackers.

## No new backend

There is **zero new Hoon**. A dashboard is an ordinary `%chat` channel with two
things layered onto what already exists:

- **The channel description carries the app definition** — a hash-pinned
  reference to an HTML bundle, the actions the app declares, and its initial
  state. Description edits are already gated on group admins, so app authorship
  is backend-enforced without new code.
- **The posts are the database.** Every interaction is a post carrying a small
  structured record. The client folds those posts into current state with a
  pure reducer.

Because the data layer is just channels and posts, we inherit replication,
permissions, offline caching and history for free.

## What runs inside the sandbox

One self-contained HTML document, assembled in memory by the client — never a
file, never fetched:

```
<meta CSP: default-src 'none' …>
<style>   shell CSS   (6 KB)     design tokens as CSS custom properties
<script>  nav guard              bar-raising Location shim (not a boundary)
<script>  shell JS    (499 KB)   preact + htm + Chart.js + the harness
<script>  the app bundle         ~18 KB, the only part that varies
```

The app's entire library universe is what the shell exposes. No per-app
dependencies, no build step. A bundle is a **single plain script** that calls
`surface.register({ render })`, where `render(state)` is pure and returns a
Preact tree. The shell re-runs it on every state update.

Design tokens are compiled from the Tamagui config at build time, so app
styling cannot drift from real Tlon styling — apps never choose fonts or
colors.

## How the shell gets into the client

Literally as a string constant in the shipped JavaScript:

1. `vite build` → `dist/surface-shell.js` + `.css`
2. A post-build script reads those and emits `dist/artifactStrings.js`:
   `export const shellArtifactJs = "…"` — the whole artifact as one
   `JSON.stringify`'d literal (byte-exact; template literals corrupt it through
   escape processing)
3. `packages/app` imports it like any module, so Metro/Vite compile it into the
   app bundle
4. At render time it is interpolated into the sandbox document

Embedding is forced, not chosen: **the sandbox has no network**, so a fetched
shell could never load.

The app bundle itself is different — it lives in the user's own S3-compatible
storage (the same bucket as their images), and the **host** fetches it and
verifies its sha256 before the sandbox sees a byte. Storage is transport, not
trust: whoever holds storage credentials can overwrite the bytes but cannot
change what clients will _run_, because only an admin edit to the description
changes the hash.

## The interaction loop

Tap → shell calls `invoke('vote-pizza')` → postMessage to the host → host
validates against a strict schema, confirms the action is declared, confirms
you may write, confirms the revision matches → posts to the channel → normal
Urbit replication → reducer refolds → new state pushed into the sandbox →
`render(state)` runs again.

**App code never writes state.** It can only request an action the spec
declared in advance, and the reducer takes the operations from the _spec_, not
from the message. Hand-crafting the post achieves exactly what tapping
achieves — which is what makes a member's tap unforgeable and an app's
capabilities exactly two: read state, invoke declared actions.

## What is and isn't contained

**Blocked and verified:** `fetch`, XHR, WebSocket, beacons, image pings,
`localStorage`, access to the host page, top navigation, popups, forms,
downloads.

**Not blocked:** a bundle can navigate its own frame to an external URL, which
both leaks and loads unpinned code. No browser feature prevents this — the
relevant CSP rule was proposed and dropped from the standard. Mitigations: the
publish gate rejects navigation APIs before a bundle is ever published, and a
host-page policy that blocks it pre-flight is written and verified on Chrome,
Firefox and Safari and SHIPS ENFORCING (`ENFORCE_HOST_CSP = true`; an earlier revision of this line said "ships disabled", which was two sessions stale — D171.5). The structural fix — running app code
where there is no browsing context to hijack — is an M4 deliverable and is what
gates **shared groups**.

On iOS and Android the network-layer interception that _would_ cover this is
not built yet, and native behavior is unverified on device.

## Where it stands

Working end to end on web and the iOS simulator: nine seeded dashboards on real
ships, members interacting, state converging, charts drawing. Two independent
security reviews both say the foundation is **not yet ready** for the bot
authoring layer; the second found three of four earlier defects genuinely
closed.

Blocked on two provisioning items outside this repo: the bot's moon needs an
admin role in the user's personal group, and write access to their storage.

## Try it

```
./start-playwright-dev.sh     # boots ~zod, ~ten, ~bus
pnpm seed:surfaces            # creates 9 dashboards, serves bundles
```

Then `http://localhost:3000/apps/groups/` (auth `lidlut-tabwed-pillex-ridrup`).
Walkthrough with expected behavior per fixture:
`docs/tlon-apps/surface-channels-seed.md`.
