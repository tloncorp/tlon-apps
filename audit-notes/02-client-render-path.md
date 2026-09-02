# Client-side surface rendering path — state and coverage

Audit date: 2026-09-02. Branch `patrick/mini-app-mvp`, worktree
`/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3`.
Read-only: nothing was edited, committed, published, or written to any ship.

## Verdict

The client rendering path is **built, wired, and demonstrably working** — I loaded three
live boards in the real client at `localhost:3000` and confirmed the real sandboxed
iframe mounts, the real shell artifact runs, the real bundle renders real folded state,
Chart.js paints actual pixels, and the sandbox is genuinely opaque-origin with storage
and `window.top` blocked. That is better than the milestone's framing suggested: this is
not unverified code, it is code nobody had _looked_ at. The problem is not quality, it is
**where the coverage stops**. The unit coverage of the individual pieces is unusually
good (34 tests in `packages/app/ui/components/SurfaceChannel/`, all passing, plus deep
suites in `surface-shell` and `shared/store/surface`), but the two halves of the render
path are each tested against a _stand-in of the other_: the jsdom tests drive the real
React host against a fake shell whose `ready` is hand-dispatched, and the Playwright
tests drive the real shell against a hand-rolled iframe that is not the React host. **No
test anywhere composes the real host component with the real shell artifact**, and the
one suite that runs the real artifact in a real browser (`apps/tlon-web/sandbox-posture/`)
**is not referenced anywhere in CI**. Two of the milestone's own exit criteria are
therefore unproven by any automated check: _live update on a new event_ is asserted only
by a doc comment, and _the client renders_ is asserted only by tests that stop one layer
short of the client. I also found and reproduced one real bug: a bundle that throws
before it calls `surface.register` produces a permanently blank frame with no error
state, no telemetry, and no user-visible message.

## Path map

### Channel row → rendered app

| #   | Layer                                                                                                                            | File                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Channel row suppresses unread badges for surfaces (`isSurfaceChannel`)                                                           | `packages/app/ui/components/listItems/ChannelListItem.tsx:50-54`                                                                                                                   |
| 2   | Channel's `defaultPostCollectionRenderer` is `tlon.r0.collection.surface`, decoded from the channel description payload (`SCDP`) | `packages/api/src/client/channelContentConfig.ts`, `packages/shared/src/logic/surfaceChannels.ts`                                                                                  |
| 3   | Renderer id → component lookup                                                                                                   | `packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx:50` (`[CollectionRendererId.surface]: SurfacePostCollection`); the composer is deliberately `DraftInputId.none` |
| 4   | **State machine.** Hydrates, gates on shell version, fetches bundle, maps to one of eight rendered states                        | `packages/app/ui/components/SurfaceChannel/SurfacePostCollection.tsx`                                                                                                              |
| 5   | Hydration (react-query)                                                                                                          | `packages/shared/src/store/surface/useSurfaceHydration.ts` → `hydration.ts` (`hydrateSurface`) → `packages/api/src/client/surface/reducer.ts`                                      |
| 6   | Bundle resolution                                                                                                                | `packages/app/ui/components/SurfaceChannel/useSurfaceBundle.ts` (`fetchBundleText`) → `packages/shared/src/store/surface/bundleCache.ts` (`getOrFetchBundle`)                      |
| 7   | Pure status → view mapping                                                                                                       | `packages/app/ui/components/SurfaceChannel/surfaceViewState.ts`                                                                                                                    |
| 8   | Non-ready states as UI                                                                                                           | `packages/app/ui/components/SurfaceChannel/SurfaceStates.tsx`                                                                                                                      |
| 9   | **Container.** Assembles the sandbox document, derives permission, maps theme, owns the React key and the host clock             | `packages/app/ui/components/SurfaceChannel/SurfaceSandboxContainer.tsx`                                                                                                            |
| 10  | **Sandbox boundary.** Web: `<iframe sandbox="allow-scripts" srcDoc={…}>`. Native: `WebView`                                      | `SurfaceSandboxHost.tsx` / `SurfaceSandboxHost.native.tsx`                                                                                                                         |
| 11  | Platform-agnostic message discipline                                                                                             | `packages/app/ui/components/SurfaceChannel/sandboxSession.ts`                                                                                                                      |
| 12  | Inside the sandbox: nav guard → shell artifact → wrapped bundle                                                                  | `packages/surface-shell/src/sandbox/document.ts`, `src/harness/index.ts`                                                                                                           |
| 13  | Invoke write-back                                                                                                                | `packages/shared/src/store/surface/invoke.ts` (`sendSurfaceInvoke`) → `api.sendPost` with `kindTail: 'surface/event'`                                                              |

### Where the bundle is fetched, verified, executed

- **Fetched** host-side, on the host's own network stack, outside the sandbox —
  `fetchBundleText` (`useSurfaceBundle.ts:13`). A declared `Content-Length` over
  `SURFACE_CAPS.bundleSize` short-circuits before the body is read; this is advisory only
  and a streaming check is an explicitly documented deferred gap.
- **Verified** in `getOrFetchBundle` (`bundleCache.ts`), which hashes with
  `@aws-crypto/sha256-js` (pure JS, _not_ WebCrypto). Hashing happens twice: verify-on-read
  from cache (a corrupt row is deleted and treated as a miss) and verify-on-fetch (a
  mismatch returns `{status:'unavailable', reason:'hash-mismatch'}` and is **never
  stored**). Size is checked against actual received bytes before hashing, so a ref that
  under-reports `size` does not soften the cap.
- **Cached** in SQLite (`$surfaceBundles`), 16 MB LRU budget — so it **does** survive app
  restart, which is what makes offline cold start possible in principle.
- **Executed** only after verification, as the third inline `<script>` of the srcdoc
  document, passed through `wrapBundleSource()` (shadows the bare `location` identifier)
  and `escapeInlineScript()` (rewrites `</script` only).

### Sandbox boundary and bridge protocol

Boundary: an `allow-scripts`-only iframe (opaque origin — **confirmed live**, `origin`
reads `"null"`). The network gate is a host-injected CSP meta inside the document:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'
```

Outbound `postMessage` uses `targetOrigin: '*'` by necessity (an opaque origin matches no
concrete origin string); inbound is `event.source`-checked against the exact frame.

| Direction    | Message      | Fields                                                           |
| ------------ | ------------ | ---------------------------------------------------------------- |
| host → shell | `init`       | `protocolVersion`, `spec`, `state`, `theme`, `canInvoke`, `now?` |
| host → shell | `state`      | `state`                                                          |
| host → shell | `theme`      | `theme: 'light'\|'dark'`                                         |
| host → shell | `permission` | `canInvoke`                                                      |
| host → shell | `now`        | `now` (finite epoch ms)                                          |
| shell → host | `ready`      | `shellVersion`, `protocolVersion`                                |
| shell → host | `invoke`     | `actionId` (≤64, `/^[a-z0-9-]+$/`), `specRevision`               |
| shell → host | `error`      | `phase: 'init'\|'render'\|'bridge'`, `message` (≤1024)           |

Schemas: `packages/surface-shell/src/protocol/schemas.ts` (strict zod, host side) and
`src/protocol/guards.ts` (dependency-free, in-sandbox — zod never ships in the artifact).
Every inbound message is schema-validated, then cross-checked against host-held truth:
spec revision, current permission, and own-property action declaration.

Session identity is `sha256:specRevision` (`sandboxSessionKey`), used as the React key, so
a revision bump is a **remount** (new element, new load, new `ready`, new `init`) rather
than a mutation of the live frame — which is what keeps an intentional replacement from
being read as hostile self-navigation by the host's post-initial-load teardown.

## Coverage table

| Behaviour                                                                   | Tested?                                                 | Where                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge message discipline (validation, strictness, widened-field rejection) | **Yes, thorough**                                       | `sandboxSession.test.ts` (16 tests); `surface-shell/src/protocol/protocol.test.ts`                                                                                                                                                                  |
| Stale/future `specRevision` invoke dropped                                  | **Yes**                                                 | `sandboxSession.test.ts` "stale or future revision invokes are dropped"; `SurfaceSandboxHost.test.tsx`                                                                                                                                              |
| Undeclared / prototype-inherited action dropped                             | **Yes**, at three layers                                | `sandboxSession.test.ts`; `invoke.test.ts`; `harness.test.ts`                                                                                                                                                                                       |
| Permission re-checked host-side (not just shell chrome)                     | **Yes**                                                 | `sandboxSession.test.ts` "invokes are gated on the permission the host currently holds"                                                                                                                                                             |
| Revision bump on unchanged bundle keeps dashboard live (F2)                 | **Yes, through the real container**                     | `SurfaceSandboxContainer.test.tsx` (2 tests); `SurfaceSandboxHost.test.tsx`                                                                                                                                                                         |
| Self-navigation teardown; replacement re-armed                              | **Yes** (jsdom) + engine-measured                       | `SurfaceSandboxHost.test.tsx`; `sandbox-posture/navigation.spec.ts`                                                                                                                                                                                 |
| Invoke stamped at validated revision, never N+1                             | **Yes**                                                 | `SurfaceSandboxHost.test.tsx` "an invoke validated at revision N is stamped N"                                                                                                                                                                      |
| Shell-error telemetry carries no sandbox bytes; per-session cap             | **Yes, thorough**                                       | `sandboxSession.test.ts` (4 tests)                                                                                                                                                                                                                  |
| **Hash mismatch → never rendered, never stored**                            | **Yes, at the cache layer only**                        | `bundleCache.test.ts` "fetched bytes failing the hash are never stored or returned"; `surfaceViewState.test.ts` maps `unavailable` → `bundle-unavailable`. **Not** exercised through the React component.                                           |
| Oversize bundle refused (declared and actual)                               | **Yes**                                                 | `useSurfaceBundle.test.ts` (7 tests, `fetchBundleText` only); `bundleCache.test.ts`                                                                                                                                                                 |
| **Bundle throws _inside_ `render`**                                         | **Yes, shell-side only**                                | `harness.test.ts`; `surface-shell/test/pollFixture.test.ts` (`broken` fixture). Host-side there is no UI — see gap 6.                                                                                                                               |
| **Bundle throws at module-eval time**                                       | **No — and it is silent**                               | Nothing. Reproduced live, see gap 4.                                                                                                                                                                                                                |
| Shell-version mismatch → refuse before fetch                                | **Yes, at the pure mapper**                             | `surfaceViewState.test.ts` "a bundle pinned to a newer shell major refuses before any fetch". The duplicate guard in `SurfacePostCollection.tsx:44` is untested.                                                                                    |
| Migration-pending state                                                     | **Yes, at hydration + mapper**                          | `hydration.test.ts` "a preserving revision transition is migration-pending until the host snapshot lands"; `surfaceViewState.test.ts`. Component wiring untested.                                                                                   |
| Partial fold never presented as current                                     | **Yes, thorough**                                       | `hydration.test.ts` (6 coverage-proof tests, incl. key-absence assertions)                                                                                                                                                                          |
| **Read-only member (no write permission)**                                  | **Partially** — session + shell only                    | `sandboxSession.test.ts`; `surface-shell/test/templates.test.ts` ("read-only viewers see identical content with disabled controls"). `useCanWrite` → `canInvoke` is never exercised, and I could not observe it live.                               |
| **Live update on a new event arriving**                                     | **No**                                                  | No test. `useSurfaceHydration.ts` has **no test file at all**. `hydration.test.ts` "live post arrivals fold incrementally on re-hydration" calls `hydrateSurface` twice by hand — it proves the fold is incremental, not that anything triggers it. |
| **Cold start from cache while offline**                                     | **No**                                                  | `bundleCache.test.ts` covers a cache hit skipping the network, but nothing exercises the hook/component with a cached bundle and a dead network.                                                                                                    |
| Real shell + real bundle + CSP, in a real browser                           | **Yes — but never in CI**                               | `apps/tlon-web/sandbox-posture/sandbox.spec.ts` (2 tests), `navigation.spec.ts`. See gap 2.                                                                                                                                                         |
| **Real React host + real shell artifact, composed**                         | **No**                                                  | Nothing, anywhere. See gap 1.                                                                                                                                                                                                                       |
| `SurfacePostCollection` / `SurfaceChannelView` state machine                | **No**                                                  | No test file.                                                                                                                                                                                                                                       |
| `SurfaceStates.tsx`                                                         | **No** (cosmos fixture only, renders without asserting) | `packages/app/fixtures/SurfaceChannel.fixture.tsx`                                                                                                                                                                                                  |
| `SurfaceSandboxHost.native.tsx`                                             | **No — self-declared unverified**                       | Five `SURFACE-NATIVE-VERIFY` markers in the file                                                                                                                                                                                                    |
| End-to-end e2e (Playwright, through the app)                                | **No**                                                  | No surface spec in `apps/tlon-web/e2e/`                                                                                                                                                                                                             |

App-layer suite status: `pnpm vitest run ui/components/SurfaceChannel/` → **5 files, 34
tests, all passing** (1.65s).

## Ranked gaps

**1. Nothing composes the real host with the real shell.** The seam is untested from both
sides. `SurfaceSandboxContainer.test.tsx` and `SurfaceSandboxHost.test.tsx` mock
`shellArtifactJs` to `'void 0;'` and hand-dispatch a `ready` MessageEvent with
`source: iframe.contentWindow` — the shell never runs. `sandbox.spec.ts` runs the real
shell but builds its own iframe in `mountSandbox()` with its own listener that does no
schema validation and no revision check — the host never runs. So the composed
behaviour (does React's `srcDoc` write survive `buildSandboxDocument`'s output intact?
does the real shell's `ready` reach the real session? does an opaque-origin `postMessage`
with `targetOrigin:'*'` land?) is proven by nothing. It _does_ work — I verified it by
hand — but no check would notice if it stopped.

**2. The only real-browser test of the real artifact never runs.** `apps/tlon-web` defines
`"e2e:sandbox": "playwright test --config playwright.sandbox.config.ts"`, but
`grep -rn "e2e:sandbox\|playwright.sandbox" .github/` returns **nothing**. Both
`sandbox-posture` specs — the hostile-bundle egress proof, the CSP enforcement, the
three-engine load-event measurement that the host's teardown logic explicitly depends on —
are dead weight in CI. `ci.yml:146` says the surface preview headless capture "is the only
check in the repo that renders a surface bundle through the real shell in real Chromium",
which is accurate and is precisely the problem: that check is the _authoring_ preview
harness, not the client. A regression in the CSP string, the `</script` escaping, or the
sandbox flags ships silently.

**3. Live update is asserted only by a doc comment.** The mechanism is real and I traced
it: `useSurfaceHydration` puts `new Set(['posts','channels'])` at `queryKey[1]`, and
`db/query.ts`'s write-invalidation predicate invalidates any query whose `queryKey[1]` is
a Set overlapping the tables just written; `sync.handleAddPost` → `db.insertChannelPosts`
declares `['posts']`. With the global `staleTime: Infinity`, that predicate is the _only_
thing that ever refreshes a board. It is one silent misplacement away from a board that
never updates again, and there is no test — `useSurfaceHydration.ts` has no test file.
This is half the milestone's exit criterion.

**4. A bundle that fails before `surface.register` is silently blank.** _Reproduced live,
in the real client's own sandbox document._ The shell registers no `window.onerror`; the
bundle runs as its own top-level `<script>`, so a synchronous top-level throw aborts that
script, `surface.register` never runs, `app` stays `null`, and `renderNow()` returns early.
Probe results, driving the real shell artifact with three bundle bodies:

| Bundle                                  | Messages posted to host | Frame               |
| --------------------------------------- | ----------------------- | ------------------- |
| `throw new Error('eval boom')`          | `ready` **only**        | blank forever       |
| `surface.register({render(){throw …}})` | `ready`, `error:render` | `BrokenState` shown |
| `var x = 1;` (never registers)          | `ready` **only**        | blank forever       |

The host has sent `init` and believes the session is healthy; `resolveSurfaceViewState`
returned `ready`, so the container is mounted. The exception appears _only_ as
`Error: eval boom at about:srcdoc:37:15` in the browser console — it reaches no telemetry
and no UI. Any bundle with a top-level syntax-or-eval fault (a bad minifier pass, a
missing global, a `const` TDZ) presents to the user as an empty white panel with no
explanation and no retry.

**5. The state machine that chooses among eight states has no test.**
`SurfacePostCollection.tsx` / `SurfaceChannelView` is untested. `surfaceViewState.ts` (the
pure mapper it delegates to) is well tested, but the component holds real logic the mapper
does not: the pre-fetch shell-version guard at line 44 that decides whether to call
`useSurfaceBundle` at all, the `retry` wiring, and the `stateFull` banner composed _over_
the live surface rather than instead of it. All three are exactly the "distinct state"
guarantees §6 is about, and none is asserted.

**6. `onShellError` is plumbed end-to-end and never connected.** `sandboxSession.ts:236-240`
justifies giving the full untruncated error text to `onShellError` because it "is the host
component's own error UI, where the developer looking at a broken dashboard is exactly who
should see the message." `SurfaceSandboxContainer.tsx:88-97` does not pass `onShellError`.
That UI does not exist; the parameter is dead in the web path. Not a security problem (the
telemetry boundary is intact and well tested) but the comment describes a feature that
isn't there.

**7. The native host is entirely unverified, and says so.** `SurfaceSandboxHost.native.tsx`
carries five `SURFACE-NATIVE-VERIFY` markers, and its header states egress blocking is not
enforced: `onShouldStartLoadWithRequest` vetoes navigations only, not subresource requests,
so on native the in-document CSP meta is the sole resource gate. No test imports the native
host (the `.test.tsx` resolves to the web file). Nothing here is wrong — it is honestly
labelled — but "the client renders" is currently a web-only claim.

**8. Offline cold start is untested through the component.** The pieces exist (SQLite-backed
cache, verify-on-read, LRU) and are unit-tested, but no test drives `useSurfaceBundle` (the
hook — `useSurfaceBundle.test.ts` only tests the standalone `fetchBundleText` function)
against a populated cache with a failing fetch. Given hydration also needs local posts, a
genuinely offline board is a plausible-but-unproven scenario.

**9. Hydration and bundle resolution are never tested together.** No test hands
`hydrateSurface`'s returned `spec.bundle` to `getOrFetchBundle`, despite that being exactly
the composition the component performs. `specConvergence.test.ts` is the closest
integration-shaped test and stops at the returned spec.

**10. (Perf, not correctness) Table-level invalidation is not channel-scoped.** The
invalidation predicate matches on table overlap only, so _any_ post insert anywhere in the
app re-runs `hydrateSurface` — a full re-page and re-fold — for _every_ mounted surface
channel. With `staleTime: Infinity` there is no other refetch source, so this is deliberate,
but a busy unrelated channel will drive repeated full re-folds.

## What I observed live

Dev server already running at `http://localhost:3000/apps/groups/` (~zod); I did not start,
stop, or restart it. Port 3002 (~ten) also answers; 3001 does not. I navigated and read
only — I pressed no control inside any board, so no invoke was ever posted.

**Boards loaded, all three rendered correctly:**

- `~zod/umnjhaod` → _Harvest dinner — 20th_ (`chat/~zod/dash-kjcffmpq`): full potluck app,
  real folded state (~ten's Dessert claim, per-category counts "1 of 2", "0 of 3"), five
  enabled action buttons.
- `~zod/umnjhaod` → _Ski trip expenses_: costs, per-payer sigils, computed settle-up.
- `~zod/umnjhaod` → _Ping-pong standings_: standings, progress bars, **and a Chart.js chart**.

**Hard evidence from inside the sandbox** (reached via Playwright's frame protocol):

```
origin:            "null"          (opaque — allow-same-origin absent, as intended)
sandbox attr:      allow-scripts
cspMeta:           default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'
script tags:       3               (nav guard, shell, wrapped bundle — matches buildSandboxDocument)
surface global:    html, h, primitives, Chart, register, invoke, canInvoke
localStorage:      blocked
window.top:        blocked
BrokenState:       absent
srcdoc length:     538,138 bytes
```

The chart canvas is 753×320 with a live 2D context and **5,075 painted pixels** of 240,960 —
it is genuinely drawn. This matters because `chartLifecycle.test.ts` and
`artifact/chart.test.ts` both document that happy-dom has no 2D context, so _no test in the
repo ever paints a chart_; the client is the first place it happens.

Bundle fetch observed: `GET http://127.0.0.1:4323/86eebc8e…7da.js → 200` — content-addressed
by sha256, consistent with the verify-on-fetch design.

**Console:** no surface-specific errors, no CSP violation reports. The 4 errors and 7
warnings present are all pre-existing app noise (PostHog initialized without a token, React
`accessibilityState`/`accessibilityRole` DOM-prop warnings, vite HMR websocket timeouts, a
`settings` query returning undefined, and two `@urbit/http-api` teardown `TypeError`s on
`getEventId`/`abort`). None originates in the surface path.

**Two content defects noticed in passing** (authoring-side, in the boards' own copy — not
the client path): _Harvest dinner_ renders "**1 people** signed up" and _Ski trip expenses_
renders "a head, split **1 ways**". Recent commits (`4b6d513bab` "catch dead controls and
count/noun disagreement") added a lint for exactly this class, so these nine live boards
appear to predate or evade that guard. Worth a separate look; not a rendering-path issue.

## What I could not determine, and what I'd have needed

- **Whether live update actually works.** This is the biggest hole and I could not close it
  read-only: observing it requires a _new event post landing in a channel while a board is
  open_, and every mechanism for producing one (`surface event`, any CLI write, posting from
  a second ship) is a channel write and out of scope. I traced the mechanism through
  `useSurfaceHydration` → `db/query.ts` invalidation → `sync.handleAddPost` and it is
  correctly wired, but **that is a code reading, not an observation.** To settle it: a second
  browser context on ~ten (port 3002 is up) pressing a control on a shared board while ~zod's
  board is open, or one `surface event` write.
- **The read-only member screen.** ~zod is the group admin, so `canInvoke` was true on every
  board and controls were enabled. I never saw the disabled state in the client. Would need a
  non-writer account on a surface channel — ~ten on 3002 is the obvious candidate.
- **Whether hash mismatch, bundle-unavailable, migration-pending, or update-to-view render
  correctly in the client.** All nine live boards are healthy, so only the `ready` branch was
  exercised. The other seven states have unit coverage at the mapper and hand-built cosmos
  fixtures, but I saw none of them in the app. Would need a board deliberately published with
  a bad hash or a future shell version — a write.
- **Native (iOS/Android).** Not exercised at all; needs a device build, which is what the
  file's own `SURFACE-NATIVE-VERIFY` markers are asking for.
- **Whether `sandbox-posture` currently passes.** I did not run `pnpm e2e:sandbox` — it
  requires a built shell artifact and browser binaries and would have been a longer detour;
  `dist/` is present and dated 2026-09-01, so it likely would. Its _absence from CI_ is
  established independently by grep and is the finding that matters.

One transient probe was performed in the browser to establish gap 4: three throwaway
iframes were created inside the already-open page, driven with the page's own srcdoc
(bundle script swapped), observed for 1.2s each, and removed. No file, no config, and no
ship state was touched.
