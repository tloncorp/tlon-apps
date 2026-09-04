# Seed fixture audit — do the negative controls still fail?

Read-only investigation, 2026-09-02, against the live `~zod` fakeship
(`http://127.0.0.1:35453`) and group `~zod/surface-seed` (27 channels).
Nothing was written to any channel, group, or ship.

## Verdict

**Seven of the nine named fixtures still demonstrate exactly the defect they
were built for, and none of the seven is vacuous.** Every negative control's
_stimulus_ is still physically present and still malformed in the documented
way — the broken bundle still throws, the asset host still over-delivers 320 KB
against a 1 KB declaration, the invalid spec still carries all three
malformations, the future spec still declares `version: 2`, the migration
channel still holds a live revision-1 snapshot containing the exact
`"STALE REVISION 1 STATE — must not be rendered"` string that the gate refuses
to show, and the hostile-nav escape target on `:4322` is still up and still
serving its red `NAVIGATION SUCCEEDED` page. The two exceptions are not
regressions but **misidentifications in the brief**: `chat/~zod/surface-chart`
is a _positive_ control (a happy-path canvas render), not a negative one, and it
is healthy; and `chat/~zod/dash-ltjbt690` ("Dev storage E2E") **is not a fixture
at all** — it is an orphaned, empty, spec-less channel that appears in no
document anywhere in the repo. Separately, two fixtures have **drifted out of
compliance with the publish gate they predate**: `surface-revision` now fails
lint with 8 `jargon` errors and `surface-chart` with an `undeclared-action`
error. Neither affects channel behaviour, but neither bundle could be published
through today's gate.

## The set is not the set

`docs/tlon-apps/surface-channels-seed.md` §3 enumerates the seed's nine
fixtures. The brief's list of nine **substitutes `dash-ltjbt690` for
`surface-poll`**. The documented nine are: poll, chart, migration, invalid,
future, broken-bundle, oversized, revision, hostile-nav. Only **six** of them
are negative controls; poll and chart are happy paths, and revision is a
liveness probe.

For completeness, the real ninth is healthy:

```
chat/~zod/surface-poll → status "reduced", votes {"~zod":"pizza","~ten":"tacos"}
```

Pizza 1, Tacos 1, turnout 2 — exactly §3.1.

## Table

| Fixture                                  | Built to show                                                                                                                 | Current behaviour                                                                                                                                                       | Verdict                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Broken bundle `surface-broken-bundle`    | `render()` always throws; harness error boundary paints a defined broken state, never a white screen                          | Bundle still throws; all 6 initial preview cells report the exact error; error card painted; gate fires `smoke-render`                                                  | **Still demonstrates**                                    |
| Oversized bundle `surface-oversized`     | Spec under-declares `size: 1024`; asset host serves 320 KB with a truthful `Content-Length`; host refuses pre-buffer          | Host serves `content-length: 327683` vs cap `262144`; spec still declares 1024; client guard intact; gate fires `byte-cap`                                              | **Still demonstrates**                                    |
| Invalid definition `surface-invalid`     | Spec present but fails validation (bad `sha256`, negative `size`, illegal action id); must not fall back to the chat renderer | All three malformations present verbatim; shared `readSurfaceSpec` → `spec-invalid`; gate fires exactly those 3; the "must NOT render as chat" event post is still live | **Still demonstrates**                                    |
| Spec version too new `surface-future`    | `version: 2` plus an unknown `futureOnlyField` that must survive round-trip                                                   | Both present verbatim in the backend-held description; `readSurfaceSpec` → `spec-version-too-new`; gate fires                                                           | **Still demonstrates**                                    |
| Hostile navigation `surface-hostile-nav` | Five self-navigation vectors, live in a real channel, with a real off-origin escape target                                    | All five render with correct shimmed/unshimmed labels; `:4322/stolen` live serving `NAVIGATION SUCCEEDED`; gate rejects 4 sites / 3 vectors                             | **Still demonstrates**                                    |
| Migration pending `surface-migration`    | Revision-2 preserving spec with the migration snapshot withheld, and a revision-1 snapshot behind it that must never leak     | Rev-1 snapshot still live carrying the stale string; hydration → `migration-pending`, `state: null`                                                                     | **Still demonstrates** — strongly non-vacuous             |
| Stale revision (F2) `surface-revision`   | Bundle bytes identical across revisions; non-preserving, so prior-revision events are filtered not replayed                   | At revision 2; one live revision-1 `ping` event; fold reports `skippedEventCount: 1` and `pings: {}`                                                                    | **Still demonstrates** (headless half)                    |
| Dev storage E2E `dash-ltjbt690`          | _Nothing — no recorded intent anywhere_                                                                                       | Zero posts, no `surfaceSpec`, `spec-absent`                                                                                                                             | **Not a fixture.** Misidentified                          |
| Chart.js `surface-chart`                 | _A positive control:_ a real canvas draw — Ship 1, Boat 2, Plane 0                                                            | Real axes/legend/gridlines/bars; folded state renders 1 / 2 / 0 and "3 data points"                                                                                     | **Still demonstrates** (but it is not a negative control) |

## Method and tooling

- The CLI was run **from source** inside the container, never the stale binary:
  `docker exec openclaw-surfaces-6a-openclaw-1 sh -lc 'cd /workspace/tlon-apps/packages/tlon-skill && ~/.bun/bin/bun run scripts/main.ts …'`.
  (`bun` is not on the container's `PATH`; it lives at `/root/.bun/bin/bun`.
  `/workspace/tlon-apps` is a bind mount of this worktree, so container and host
  see identical source.)
- Previews were run with **`--no-populated`**, so only `*-initial-*` cells were
  ever read. For the chart I additionally rendered `--state` from the channel's
  **actual folded state** as reported by `surface state` — real group-produced
  data, not the synthetic three-actor fold.
- Specs were taken from the **backend-held channel description** via a raw scry
  (`groups/v2/groups/~zod/surface-seed.json`), not from a client transform, so
  what was linted is what `%groups` holds.
- Post blobs were read via `channels/v4/<nest>/posts/newest/<n>/post.json`.
- Artifacts written to
  `packages/openclaw/dev/surfaces-6a-out/audit01/` (the sanctioned scratch dir).

---

## Per-fixture evidence

### 1. Broken bundle — `chat/~zod/surface-broken-bundle` — STILL DEMONSTRATES

Intent (`surface-channels-seed.md` §3.6):

> The sandbox loads and the harness error boundary paints **"This app hit an
> error / Error: seed fixture: render exploded on purpose"** inside the frame.
> The Tlon chrome around it stays intact.

The bundle is unchanged and still throws unconditionally. Fetched from the live
asset host, 403 bytes, sha256 `0eb6f331…f328` — **matching the spec's declared
hash exactly**:

```js
(function () {
  surface.register({
    render() {
      throw new Error("seed fixture: render exploded on purpose");
    },
  });
})();
```

`surface preview --no-populated` exits 1 and the shell reports the throw in
every initial cell:

```
The shell reported 6 error(s) while capturing:
  phone-initial-light.png [render] Error: seed fixture: render exploded on purpose
  phone-initial-dark.png [render] Error: seed fixture: render exploded on purpose
  phone-full-initial-light.png [render] Error: seed fixture: render exploded on purpose
  phone-full-initial-dark.png [render] Error: seed fixture: render exploded on purpose
  desktop-initial-light.png [render] Error: seed fixture: render exploded on purpose
  desktop-initial-dark.png [render] Error: seed fixture: render exploded on purpose
EXIT=1
```

`prev-broken/phone-initial-light.png` shows the defined error card — a pink
bounded panel reading **"This app hit an error"** over
**"Error: seed fixture: render exploded on purpose"** — not a white screen. The
publish gate independently rejects it:

```
error smoke-render bundle: render threw (initial state): Error: seed fixture: render exploded on purpose
Gate failed: 1 violation
```

### 2. Oversized bundle — `chat/~zod/surface-oversized` — STILL DEMONSTRATES

Intent (§3.7): the spec under-declares `size` because the schema caps
`bundle.size` at 256 KB, and "a host that over-delivers what a spec
under-declares is exactly the lying-asset-host case this check exists for."

The lie is still being told. Spec, read back from `%groups`:

```json
"bundle":{"assetRef":"http://127.0.0.1:4321/oversized.js",
          "sha256":"42299f7a…e400ed","size":1024,"shellVersion":1}
```

The asset host's actual response:

```
HTTP/1.1 200 OK
content-type: application/javascript; charset=utf-8
content-length: 327683
```

`327683` actual bytes, sha256 matches the declared hash. Cap is
`SURFACE_CAPS.bundleSize = 256 * 1024 = 262144`
(`packages/api/src/client/surface/schemas.ts:27`), so the declared length
exceeds it by 65,539 bytes. The client guard that this is aimed at is intact —
`packages/app/ui/components/SurfaceChannel/useSurfaceBundle.ts:30`:

```ts
const declaredLength = response.headers.get("content-length");
if (declaredLength !== null) {
  const declaredBytes = Number(declaredLength);
  if (
    Number.isFinite(declaredBytes) &&
    declaredBytes > SURFACE_CAPS.bundleSize
  ) {
    throw new Error(
      `bundle too large: ${declaredBytes} bytes declared, cap ${SURFACE_CAPS.bundleSize}`,
    );
  }
}
```

And the publish gate rejects the real bytes:

```
error byte-cap bundle: bundle is 327683 bytes; the cap is 262144
Gate failed: 1 violation
```

The documented rationale also still holds: `size` is
`z.number().int().positive().max(SURFACE_CAPS.bundleSize)`
(`schemas.ts:158`), so an honestly-declared oversized spec really would land on
"invalid definition" and never reach the fetch. The under-declaration is
load-bearing, not sloppiness.

_Not observed:_ the on-screen "Can't load this dashboard right now" + Retry.
See the closing section.

### 3. Invalid definition — `chat/~zod/surface-invalid` — STILL DEMONSTRATES

Intent (§3.4): a spec that is present but fails validation, with the critical
negative being that it must **not** fall back to the chat renderer.

All three deliberate violations are still in the backend-held description,
verbatim:

```json
"surfaceSpec":{"version":1,"surfaceId":"seed-invalid","specRevision":1,
"title":"Invalid on purpose",
"bundle":{"assetRef":"http://127.0.0.1:4321/poll.js","sha256":"not-a-sha","size":-1,"shellVersion":1},
"initialState":{"note":"unreachable"},
"actions":{"NOT A VALID ACTION ID":{"ops":[]}}}
```

The shared reader refuses it. Note this is the **same** `readSurfaceSpec` the
app uses (`packages/api/src/client/surface/schemas.ts:332`, imported by
`packages/tlon-skill/scripts/surface-runtime.ts:67`), so this is not merely a
CLI opinion:

```json
{
  "ok": false,
  "code": "spec-invalid",
  "message": "chat/~zod/surface-invalid's app definition is present but fails validation. It must be republished before anything can be read or written against it.",
  "details": { "channel": "chat/~zod/surface-invalid", "errorClass": "author" }
}
```

The gate names all three independently:

```
error spec-schema bundle.sha256: Invalid [invalid_string]
error spec-schema bundle.size: Number must be greater than 0 [too_small]
error spec-schema actions.NOT A VALID ACTION ID: Invalid [invalid_string]
```

Critically, **the bait is still in the channel** — the event post that must not
appear as chat is live at seq 13 (the older seqs are tombstones):

```
seq 13 kind /chat/surface/event
  blob: [{"type":"surface-event","version":1,"surfaceId":"seed-invalid","specRevision":1,"mode":"host","ops":[{"op":"set","path":"/note","value":"folded nothing"}]}]
  content: [{"inline": ["This is a surface event post. It must NOT render as chat."]}]
```

This is what makes the fixture non-vacuous: an invalid spec with an empty
channel would prove nothing.

### 4. Spec version too new — `chat/~zod/surface-future` — STILL DEMONSTRATES

Intent (§3.5): `version: 2` must produce refusal, not best-effort, and the
unknown `futureOnlyField` must survive the payload round trip untouched.

Both properties hold. From the raw `%groups` scry:

```json
"surfaceSpec":{"version":2,"surfaceId":"seed-future","specRevision":1,
"title":"From the future",
"bundle":{"assetRef":"http://127.0.0.1:4321/poll.js","sha256":"aaaa…aaaa","size":1024,"shellVersion":1},
"initialState":{},"actions":{},
"futureOnlyField":{"capability":"not-yet-invented"}}
```

`futureOnlyField` is intact — the round-trip guarantee is still being measured.
The reader refuses rather than guesses:

```json
{
  "ok": false,
  "code": "spec-version-too-new",
  "message": "chat/~zod/surface-future's app definition declares version 2, which this build does not understand. Update the CLI.",
  "details": {
    "channel": "chat/~zod/surface-future",
    "version": 2,
    "errorClass": "environment"
  }
}
```

Gate:

```
error spec-schema version: Invalid literal value, expected 1 [invalid_literal]
```

### 5. Hostile navigation — `chat/~zod/surface-hostile-nav` — STILL DEMONSTRATES

Intent (§3.9): five self-navigation vectors with Fire buttons, running inside a
real channel on the shipping host page, with a real off-origin target to escape
to.

All five vectors are still present in the bundle (sha256 matches the spec) and
all five render. `prev-hostile-nav/phone-full-initial-light.png` shows the card
with the target `http://127.0.0.1:4322/stolen` and the five rows carrying their
correct labels:

- `nav-replace` — _in-realm shimmed_
- `nav-href` — _in-realm shimmed_
- `nav-window-location` — _unshimmed_
- `nav-anchor` — _unshimmed_
- `nav-meta` — _unshimmed_

plus the "Fire every vector" button.

**The escape target is live.** This matters — a hostile-nav fixture pointed at a
dead port would be the textbook vacuous guard, "containment" that is really just
`ECONNREFUSED`:

```
$ curl http://127.0.0.1:4322/stolen
HTTP 200  bytes 215
<h1>NAVIGATION SUCCEEDED</h1><p>The sandbox frame reached an off-origin URL. This vector is open.</p>
```

The publish gate rejects the bundle, 4 violations across 3 vectors:

```
error navigation-vector bundle:50:7:  a member `location` reaches the real Location object, which no in-realm shim can take away; navigating the frame is egress the sandbox cannot block
error navigation-vector bundle:54:26: a synthesized anchor is a navigation vector
error navigation-vector bundle:63:7:  document.write can rewrite the frame into unpinned markup
error navigation-vector bundle:64:10: meta refresh navigates the frame
Gate failed: 4 violations
```

Mapping those line numbers onto the bundle: 50 is `window.location.replace`
(`nav-window-location`), 54 is `document.createElement('a')` (`nav-anchor`),
63–64 are `document.write` + meta refresh (`nav-meta`). **The gate does not flag
lines 40 and 44** — `location.replace(TARGET)` and `location.href = TARGET`,
the two bare-identifier vectors. That is consistent with the recorded posture
(those two are the ones the in-realm shim shadows, and §3.9 says they "do
nothing" on the dev server), so it is not a regression — but it is worth stating
plainly that the gate's navigation lint covers 3 of the 5 vectors this fixture
carries.

_Not observed:_ actually firing the vectors. See the closing section.

### 6. Migration pending — `chat/~zod/surface-migration` — STILL DEMONSTRATES (strongest of the set)

Intent (§3.3): "Dashboard update in progress", and — the important part — **no
state behind it**. The channel deliberately holds a revision-1 snapshot so that
a gate falling back across a revision boundary would be caught.

This is the fixture most at risk of going vacuous (clear the old posts and the
gate has nothing to leak). **It has not.** The revision-1 snapshot is still live
at seq 25, carrying the tripwire string verbatim:

```
seq 25  kind /chat/surface/snapshot
  blob: [{"type":"surface-snapshot","version":1,"surfaceId":"seed-migration",
          "specRevision":1,"upToSequenceNum":0,
          "state":{"question":"STALE REVISION 1 STATE — must not be rendered",
                   "options":[],"votes":{"~zod":"pizza"}}}]
```

and the revision-1 event at seq 26:

```
seq 26  kind /chat/surface/event
  blob: [{"type":"surface-event","version":1,"surfaceId":"seed-migration",
          "specRevision":1,"mode":"invoke","actionId":"vote-pizza"}]
```

The spec is still at revision 2 with `preserveState: true` and no revision-2
snapshot posted. Hydration — through the shared `hydrateSurface` /
`packages/api/src/client/surface/reducer.ts:265` path the app uses, not a
CLI-only route — returns:

```json
{
  "ok": true,
  "channel": "chat/~zod/surface-migration",
  "status": "migration-pending",
  "surfaceId": "seed-migration",
  "specRevision": 2,
  "state": null
}
```

`state: null` with a fully-formed, foldable revision-1 state sitting one seq
away. The gate has something real to leak and does not leak it.

### 7. Stale revision (F2) — `chat/~zod/surface-revision` — STILL DEMONSTRATES (headless half)

Intent (§3.8): the bundle bytes never change across revisions, so a host keying
its sandbox session on the bundle hash alone would freeze; and the revision is
non-preserving, so prior-revision events must be filtered rather than replayed.

The channel is at revision 2. There is exactly one live post, and it is a
**revision-1** ping (seqs 11–15 are tombstones):

```
seq 16  /chat/surface/event
  blob: [{"type":"surface-event","version":1,"surfaceId":"seed-revision",
          "specRevision":1,"mode":"invoke","actionId":"ping"}]
```

And the fold explicitly counts it as skipped rather than folding it:

```json
{
  "status": "reduced",
  "specRevision": 2,
  "state": {
    "title": "Revision probe",
    "revision": 2,
    "note": "This is revision 2. The bundle bytes have not changed since revision 1.",
    "pings": {}
  },
  "foldedEventCount": 0,
  "skippedEventCount": 1,
  "posts": 16
}
```

`skippedEventCount: 1` with `pings: {}` is the filter working on a real event,
not on an empty channel. `prev-revision/phone-initial-light.png` confirms the
rendered surface: "Rendering revision 2", "No pings yet", "0 pings this
revision", Ping button present.

Bundle identity across revisions holds by construction — the seed's `revise`
closure (`packages/shared/seed/fixtures.ts:657`) reuses the same `bundle` object
and only moves `specRevision` and `initialState` — and the current revision's
declared sha256 `3d29117e…a775` matches the served `revision.js` byte-for-byte.
I could not independently observe revision 1's declared hash, since only the
current spec is stored.

_Not observed:_ the live browser behaviour (an open page flipping to the next
revision with an empty ping list). That requires `pnpm seed:surfaces --bump`,
which is a write. §4 of the seed doc already concedes "a headless check cannot
see it."

### 8. Dev storage E2E — `chat/~zod/dash-ltjbt690` — NOT A FIXTURE

**This one is the finding.** It is not a negative control that went vacuous; it
was never a negative control.

Current state:

```json
{
  "ok": false,
  "code": "spec-absent",
  "message": "chat/~zod/dash-ltjbt690 carries no app definition — it is an ordinary channel, not a dashboard. Publish one with `tlon surface publish`.",
  "details": {
    "channel": "chat/~zod/dash-ltjbt690",
    "errorClass": "environment"
  }
}
```

Its description carries surface _content configuration_ but no `surfaceSpec` at
all — the shape `tlon surface create` leaves behind before a publish lands:

```json
{
  "channelContentConfiguration": {
    "draftInput": "tlon.r0.input.none",
    "defaultPostContentRenderer": "tlon.r0.content.chat",
    "defaultPostCollectionRenderer": "tlon.r0.collection.surface"
  }
}
```

And it is empty — the posts scry returns `newest: 0`. Zero posts, ever.

On intent, the record is _silent_:

- `grep` for `ltjbt690` across `DECISIONS.md`, every `surface-channels-session*.md`,
  `docs/tlon-apps/surface-channels-seed.md` and the whole repo returns **nothing**.
- `docs/tlon-apps/surface-channels-seed.md` §3 enumerates the seed's nine
  fixtures by slug and this is not among them.
- Inside the container, every one of its ~20 occurrences across the 6a/6c bot
  transcripts is a **channel-listing artifact** — the bot enumerating the group —
  never a `publish`, `lint`, `preview` or `show` target. Its listing neighbour is
  `dash-tux55wac` / "6a topology probe", the same kind of scratch channel.

The most defensible reading: it is an orphan from a manual dev-storage wiring
check (seed doc §2a, `tlon surface create` → `tlon surface publish`) where the
create landed and the publish did not. Its title is the only thing that ever
described it, and titles are not intent.

**Verdict: excluded — it demonstrates nothing, and there is nothing it was
supposed to demonstrate.** Counting it as one of nine negative controls
overstates the corpus by one. If a `spec-absent` control _is_ wanted, it should
be created deliberately and written down; a leftover is not a fixture just
because it happens to be broken.

### 9. Chart.js — `chat/~zod/surface-chart` — STILL DEMONSTRATES, but it is a positive control

The brief files this under "channels that exist in order to FAIL". It does not.
§3.2 is a happy path, and the _failure_ it guards against is the shell silently
degrading:

> If the canvas is blank, or the card says "Chart.js is not available in this
> shell", the vendored Chart.js is not reaching a live 2D context and this
> fixture has failed. … every chart assertion before it ran under happy-dom,
> which returns `null` from `canvas.getContext('2d')` — so Chart.js's
> _degrade-cleanly_ path was being tested and its _render_ path never was.

It is healthy on both counts. At the spec's `initialState`
(`prev-chart/phone-initial-light.png`) the canvas draws real axes, gridlines, a
"Responses" legend swatch and the three category labels — a live 2D context,
with zero-height bars because `entries` is empty. No "not available" card.

Rendered against the channel's **actual** folded state — from
`surface state`, not a synthetic fold:

```json
"entries":{"~zod":"Ship","~sampel-palnet":"Boat","~ten":"Boat"}
```

`prev-chart-real/phone-initial-light.png` draws exactly the documented picture:
a bar of height 1 at Ship, height 2 at Boat, nothing at Plane, y-axis 0–2, rows
reading "Ship — 1", "Boat — 2", "Plane — 0", and "3 data points". §3.2's
Boat-is-2 detail (one of its two points arriving as a host event with raw ops
rather than a member invoke) is preserved — `~sampel-palnet` is in the folded
state and is not a member of the seed group.

## Incidental finding: two fixtures no longer pass the gate they predate

Neither of these affects channel behaviour — the seed writes specs straight into
the channel description via `store.updateChannel` and never goes through
`surface publish` — but both mean the fixture bundle as committed **could not be
published today**:

```
######## LINT revision
error jargon bundle: rendered copy (initial state) contains "revision", which is mechanism vocabulary
error jargon bundle:21:42: "revision" is mechanism vocabulary; say what the member sees, not how it works
… (6 more)
Gate failed: 8 violations
```

```
######## LINT chart
error undeclared-action bundle:66:37: invoke("pick-") references an action the spec does not declare
Gate failed: 1 violation
```

The chart one is a false positive of a sort — the bundle builds its action id
dynamically (`'pick-' + label.toLowerCase()`) and the gate cannot cross-reference
a computed argument — but it is an error-severity rule, so the exit is 1 either
way. The revision one is real: the fixture's whole purpose requires it to say
"revision" on screen, and the gate's jargon denylist now forbids that word.
Worth a decision: either these fixtures get exempted/reworded, or the corpus
quietly contains two bundles that the authoring path would reject.

## What I could not determine, and what it would take

**The four client-render assertions.** For oversized, invalid, future and
migration, I verified the _stimulus_ (the malformed or lying input, still
present and still malformed) and the _shared code path_ that consumes it — but
not the pixels in the channel:

| Fixture   | Unverified on-screen claim                                                     |
| --------- | ------------------------------------------------------------------------------ |
| Oversized | "Can't load this dashboard right now" + a Retry button that fails the same way |
| Invalid   | The event post does not appear in the main pane as a chat message              |
| Future    | "Update Tlon to view this."                                                    |
| Migration | "Dashboard update in progress" with a spinner                                  |

For invalid, future and migration I consider the gap small: the CLI's verdicts
come from the same `readSurfaceSpec` / `hydrateSurface` / reducer the app calls,
so the decision those screens render is the decision I observed. For oversized
the gap is slightly larger, because the refusal lives in
`useSurfaceBundle.fetchBundleText`, which only runs in the app — I read the code
and confirmed the arithmetic, but did not execute it.

**Closing these needs a browser.** The `~zod` dev server _is_ up
(`localhost:3000` → 200, `localhost:3002` → 200; `:3001`/~bus is down). I did
not use it: opening a channel in Tlon writes read/activity state to the ship, and
the brief authorised CLI reads and `surface preview` only. Thirty minutes with a
browser at `localhost:3000/apps/groups/` (access code `lidlut-tabwed-pillex-ridrup`)
against those four channels would close all four.

**Firing the hostile-nav vectors** is likewise browser-only. I confirmed the five
probes render and the escape target answers, but not that the three unshimmed
vectors still reach `:4322` and that the host still tears the frame down. §3.9
records the expected result precisely enough to check against.

**F2's live half** — an open page flipping revision with an empty ping list and a
still-working Ping — needs `pnpm seed:surfaces --bump`, which is a write and was
out of scope. The seed doc already flags this as unobservable headlessly.

**Revision 1's declared bundle hash** is unrecoverable: only the current spec is
stored in the channel description, so "the bytes never changed across revisions"
rests on the seed's `revise` closure reusing the same bundle object rather than
on an observation of both revisions.
