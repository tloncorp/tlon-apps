# Surface channels: local seed and click-through

This is how to put the whole surface-channel slice on screen and exercise it
by hand, without reading any of the code.

The seed creates nine dashboard channels on the local rube fakeships — one
per interesting state — as **real channels written through the real client
store**. Nothing is hand-written into ship state: channels come from
`store.createChannel`, every spec write goes through `store.updateChannel`
(the one production caller of `applyMetadataEdit`), and posts go through
`api.sendPost` under the allowlisted surface kind tails. What you click is
what the app does.

---

## 1. Start the ships

From the repo root:

```bash
./start-playwright-dev.sh
```

This boots ~zod, ~ten and ~bus in the background and returns when they are
ready (a few minutes; longer the first time, when it downloads the piers).
It also starts one web dev server per ship.

**Stop them when you are finished:**

```bash
./stop-playwright-dev.sh
```

Ship access codes (from `CLAUDE.md`):

| ship | web              | access key                    |
| ---- | ---------------- | ----------------------------- |
| ~zod | `localhost:3000` | `lidlut-tabwed-pillex-ridrup` |
| ~bus | `localhost:3001` | `riddec-bicrym-ridlev-pocsef` |
| ~ten | `localhost:3002` | `lapseg-nolmel-riswen-hopryc` |

Open `http://localhost:3000/apps/groups/`, and when the Urbit login page
appears paste ~zod's key. Do the same on `:3002` for ~ten if you want to
click as a second member.

## 2. Run the seed

From the repo root, in a second terminal:

```bash
pnpm seed:surfaces
```

It prints a check per fixture and then **stays running**, because it is also
the local file server the dashboards fetch their app bundles from. Leave it
up while you click; Ctrl+C when you're done.

| flag     | effect                                                           |
| -------- | ---------------------------------------------------------------- |
| (none)   | seed, verify, then keep serving bundles until Ctrl+C             |
| `--once` | seed, verify, exit (the dashboards will stop loading afterwards) |
| `--bump` | only bump the F2 fixture's spec revision, then keep serving      |

Re-running is safe and expected: the seed reuses the group and channels it
already made and clears their posts, so every run starts from the same
history.

### The bundle server

In production a dashboard's app bundle lives in the user's remote storage
and `assetRef` points at that bucket. Provisioning the bot's moon with write
access to a user's bucket is a separate, human, out-of-repo task, so the
seed stands in for it with a plain localhost file server on **:4321**. The
client does not special-case this at all: it fetches `assetRef` on the
host's own network stack and verifies the sha256 before the sandbox sees a
byte, exactly as it would against a real bucket.

A second server on **:4322** exists only as somewhere for the hostile
navigation probes to try to escape to.

### If the seed refuses to run

If it stops with a message about a channel that "exists in %channels but is
not listed in the group", that ship's channel names are burned — see
[Known backend traps](#known-backend-traps). Stop and restart
`./start-playwright-dev.sh`, which nukes ship state, and seed again.

---

## 3. The fixtures

All nine live in the **Surface seed** group on ~zod. Two general things to
watch across all of them:

- **No composer.** A surface channel has `tlon.r0.input.none`; there is no
  message box at the bottom. If you see one, the content configuration did
  not survive.
- **No badges.** Every surface channel shows `0` in the channel list no
  matter how much activity it has, and the group does not badge. That is
  the §8 policy, not a bug.
- The channel-list **preview text** does show the surface posts' fallback
  story text ("~ten: Voted in "Lunch poll". Update Tlon to view this
  dashboard."). That is deliberate: the fallback exists so pre-surface
  clients degrade to inert chat messages, and the preview is rendered by
  that same older path.

### 3.1 Poll — happy path

`chat/~zod/surface-poll`

A rendered poll with two options. ~zod and ~ten have both already voted, so
you should see **Pizza 1, Tacos 1, turnout 2**, and a list at the bottom
reading `~ten → tacos` / `~zod → pizza`.

Click **Vote** on the other option. Your ship's vote _changes_; the turnout
stays at 2. Per-user state is a `set /votes/$actor` keyed by the verified
post author, so voting twice cannot inflate the count and cannot touch
anyone else's vote.

To see it from both sides, open `localhost:3002` as ~ten in another tab and
vote there. Both windows converge.

### 3.2 Chart.js — real canvas draw

`chat/~zod/surface-chart`

**A drawn bar chart** with axes, a legend and three bars: Ship 1, Boat 2,
Plane 0 (3 data points). If the canvas is blank, or the card says "Chart.js
is not available in this shell", the vendored Chart.js is not reaching a
live 2D context and this fixture has failed.

This is the fixture that matters most for the shell: every chart assertion
before it ran under happy-dom, which returns `null` from
`canvas.getContext('2d')` — so Chart.js's _degrade-cleanly_ path was being
tested and its _render_ path never was.

Boat is 2 rather than 1 because one of its two data points comes from a
**host event** with raw ops rather than a member invoke. Host ops and member
invokes fold together, in sequence order.

Click **Pick** on any row and the chart redraws.

### 3.3 Migration pending

`chat/~zod/surface-migration`

**"Dashboard update in progress"**, with a spinner. Not an error, and — the
important part — **no state behind it**.

The spec is at revision 2 with `preserveState: true`, and the host has not
posted the migration snapshot at revision 2. The channel _does_ contain a
revision-1 snapshot holding "STALE REVISION 1 STATE — must not be rendered",
plus a revision-1 event. If you ever see that string on screen, the
migration gate has fallen back across a revision boundary, which it must
never do.

### 3.4 Invalid definition

`chat/~zod/surface-invalid`

**"This dashboard has a broken definition."** The spec is present but fails
validation (a malformed `sha256`, a negative `size`, an illegal action id).

The thing to check is what you _don't_ see: the channel contains a surface
event post whose fallback text reads "This is a surface event post. It must
NOT render as chat." It must not appear in the main pane. An invalid spec
falls back to a defined error state, never to the chat renderer — otherwise
a broken dashboard would start spraying its own event log at members as
messages. (The text does appear in the sidebar preview; see above.)

### 3.5 Spec version too new

`chat/~zod/surface-future`

**"Update Tlon to view this."** The spec declares `version: 2`, a protocol
version this client predates. Refusal, not best-effort: a future-version
spec is not invalid, it is from the future, and guessing at it is how
clients diverge.

This spec also carries a `futureOnlyField` key that this client has never
heard of, which has to survive the payload round trip untouched.

### 3.6 Broken bundle

`chat/~zod/surface-broken-bundle`

The sandbox loads and the harness error boundary paints **"This app hit an
error / Error: seed fixture: render exploded on purpose"** inside the frame.
The Tlon chrome around it stays intact. An app exception must produce a
defined broken state, never a white screen and never a crashed channel.

### 3.7 Oversized bundle

`chat/~zod/surface-oversized`

**"Can't load this dashboard right now"** with a **Retry** button. Retry
fails the same way.

The spec is valid and declares a within-cap `size`; the asset host answers
with a 320 KB body and a truthful `Content-Length`. The host refuses it on
the declared length before buffering a byte. (The spec has to under-declare,
because the schema caps `bundle.size` at 256 KB — an honestly oversized spec
would land on "invalid definition" and never reach the fetch at all. A host
that over-delivers what a spec under-declares is exactly the lying-asset-host
case this check exists for.)

### 3.8 Stale revision — the F2 case

`chat/~zod/surface-revision`

Shows the current revision number, a note, and a **Ping** button.

The point of this fixture is that **the bundle bytes never change**. Every
revision points at the same `assetRef` with the same `sha256`. A host that
keyed its sandbox session on the bundle hash alone would keep showing the
old revision forever.

To exercise it live:

1. Open this channel and leave it open. Note the revision number and press
   **Ping** — your ship appears in the ping list.
2. In another terminal: `pnpm seed:surfaces --bump`.
3. Watch the open page. It must flip to the **next revision number** with an
   **empty ping list** — a fresh session over the new revision's
   `initialState` — and **Ping must still work**. The previous revision's
   ping must _not_ reappear: the revision is non-preserving, so prior-revision
   events are filtered out rather than replayed.

A frozen dashboard (old revision still on screen, or Ping doing nothing) is
the F2 regression.

### 3.9 Hostile navigation

`chat/~zod/surface-hostile-nav`

A card listing five self-navigation vectors — `nav-replace`, `nav-href`,
`nav-window-location`, `nav-anchor`, `nav-meta` — each with a **Fire**
button, and a "Fire every vector" button. These are the probes from
`apps/tlon-web/sandbox-posture/navigation.spec.ts`, running for the first
time inside a real channel on the shipping host page rather than a synthetic
harness.

**On the dev server the two classes of vector behave differently, and that
difference is the point.** Measured on chromium against the shipping host
page:

- **`nav-replace` and `nav-href`** (labelled "in-realm shimmed") do nothing.
  The dashboard stays on screen. The host shadows the bare `location`
  identifier inside the bundle's scope, and these two reach it.
- **`nav-window-location`, `nav-anchor`, `nav-meta`** (labelled
  "unshimmed") **do navigate the frame.** The console logs

  ```
  Framing 'http://127.0.0.1:4322/' violates the following report-only
  Content Security Policy directive: "frame-src 'self' https://tlon.network".
  The violation has been logged, but no further action has been taken.
  ```

  and the surface **disappears** — the host tears the iframe down on the
  post-initial `load`, so you never see the attacker page, but the request
  to `127.0.0.1:4322` was already made and the request itself is the egress.

None of that is a regression; it is the recorded posture, now measured
somewhere real rather than in a synthetic harness:

- The in-realm shim is **bar-raising, not a boundary**. A bundle walks
  around it in one property access, which is exactly what
  `nav-window-location` shows.
- The host page's `frame-src` allowlist ships in **Report-Only** on the dev
  and preview servers (D44 — `Content-Security-Policy-Report-Only` cannot be
  delivered in a `<meta>` tag, and `tlon-web` ships as a `%docket` glob that
  emits only `content-type`, so there is no production Report-Only path).
  Report-Only logs and permits; the enforcing policy is written but disabled
  behind a flag. Under the enforcing policy the navigation is blocked
  pre-flight and the frame stays put.
- Teardown-on-load bounds how long a second-stage page can sit in the frame.
  It cannot un-send the first request.

So: seeing the surface vanish after firing an unshimmed vector is the
**expected dev-server behaviour**. What would be a genuine regression is the
frame being _replaced_ by the red "NAVIGATION SUCCEEDED" page and staying
there — that would mean teardown had failed too.

---

## 4. What the seed verifies on its own

Printed on every run:

- **Byte identity** — for every fixture, the spec written into the channel
  description is compared byte-for-byte against what `%groups` hands back,
  read straight out of a scry with no client-side transform in the middle.
  One fixture's spec carries a deliberate torture payload: NFD and NFC forms
  of the same grapheme, a ZWJ emoji sequence with a skin-tone modifier, CJK
  and RTL text, leading/trailing whitespace, tabs and CRLF, JSON escape
  characters, deliberately unsorted object keys, number formats, empty
  string/object/array, and deep nesting. On a mismatch the seed prints the
  first differing codepoint with context and stops — a difference here is a
  fact about the backend, and normalizing around it would defeat the
  guarantee it is measuring.
- **`readSurfaceSpec`** returns the expected result per fixture (valid /
  invalid / version-too-new).
- **Hydration** reaches the expected status per fixture, including
  migration-pending carrying no state.
- **F3** — a fold whose window falls short of the ship's advertised head
  reports `partial` and carries no state, then `hydrated` once the posts
  catch up.
- **F4** — every surface channel is hushed on the ship after discovery, and
  no surface channel carries a notifying activity summary after ~ten's
  invokes have landed.
- **F2** — the revision bump lands and reads back valid with an unchanged
  bundle hash. (That the _open page_ replaces its session rather than
  freezing is §3.8's browser step; a headless check cannot see it.)

---

## Known backend traps

Two things the seed had to be built around. Neither is caused by the seed,
and both are worth knowing before you go poking at fakeship state by hand.

**A deleted channel's name is burned.** `store.deleteChannel` pokes
`%groups`, which unlists the nest; `%channels` and `%channels-server` both
keep their own maps and neither is told. `%channels-server`'s `ca-create`
then opens with

```hoon
?:  (~(has by v-channels) n)
  %-  (slog leaf+"channel-server: create already exists: {<n>}" ~)
  ca-core
```

— a **silent no-op**. So creating a channel under a name that was ever used
before on that ship leaves it half-created: `%channels` holds an entry whose
`perms.group` is the bunt flag (`~zod/`), `%groups` never learns about it,
and the client's tracked poke still resolves _successfully_, because
`%channels` answered. The app does not hit this because `createChannel`
generates a random slug unless a `customSlug` is passed. The seed avoids it
by never deleting a channel: it reuses them and clears their posts instead.

**`foreign_keys` is off everywhere in production.** `activity_events` has a
composite primary key `(id, bucketId)`, but
`activity_event_contact_group_pins.activity_event_id` references
`activityEvents.id` alone, which is not unique. SQLite raises `foreign key
mismatch` on that whenever FK enforcement is on. It never fires in the app
because op-sqlite, SQLocal and better-sqlite3-via-Electron all leave the
pragma at SQLite's default (off) and nothing turns it on. The seed sets
`foreign_keys = OFF` explicitly to match, because the better-sqlite3 _driver_
turns it on for new connections.

## Transient states you may see

- **"Catching up on dashboard history…"** on first opening a channel that
  has no posts yet (Broken bundle, Oversized bundle, Hostile navigation).
  The channel row reaches the local mirror before its head watermark does,
  and until coverage is provable the fold reports `partial` and carries
  nothing rather than presenting a possibly-truncated history as current.
  It resolves on its own within a second or two. This is F3's rule working,
  not a wedge — but it does mean a freshly published dashboard with no
  events yet shows a spinner briefly before its empty state renders.
