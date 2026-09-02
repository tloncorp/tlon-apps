# The surface paradigm

Read this before writing any surface app. Every rule here exists because
something broke without it; where the reason is not obvious it is stated.

Two files, one job: **the spec** (`spec.json`) declares the data and the
complete list of things members may do; **the bundle** — one script file — is
a pure function from state to screen. Neither can do the other's job.

`PRIMITIVES.md` is the kit you draw with. `RUBRIC.md` is what you score
`tlon surface preview`'s screenshots against once the app renders — the
last step before publishing, and the only one that sees what a member sees.

---

## 1. The contract

The bundle is **a single plain script**. No `import`, no `export`, no module
syntax, no build step. It is JavaScript — the shell injects its source into a
`<script>` element in a document the host assembles, so it contains no HTML
markup, no `<html>`, no `<style>`, whatever the template file is named. The
shell loads first and puts everything you get on `globalThis.surface`. You
register one function:

```js
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const { Card, ListRow, Button } = primitives;

  surface.register({
    render(state) {
      return html`<${Card} title=${state.title || "Untitled"}>…<//>`;
    },
  });
})();
```

- **`render(state)` is pure.** Same state in, same tree out. It runs again on
  every state change and every permission change. A second argument,
  `render(state, context)`, carries the host's clock for the few apps that
  need one — display only, and §3 has the whole rule. (A theme flip only swaps
  the CSS variables — your tree is not re-rendered, which is why an
  already-drawn chart keeps its colors until the next state update.)
- **There is no app-local state.** No `useState`, no hooks, no module
  variables that outlive a render, no manual DOM. The reduced state is the
  only state. This is deliberate: the whole class of "the screen disagrees
  with the store" bugs is unwritable.
- **`state` is whatever the reducer folded** — `initialState` plus events.
  Nothing guarantees a key is present. `state.votes || {}` everywhere.
- **Your capabilities are exactly two:** read `state` (the render argument)
  and `invoke(actionId)`. Everything else on `surface` is presentation, and
  `context` is an input rather than a capability — nothing you read from it
  can be written back.
- Your script is wrapped in a function, so top-level `var`/`function`
  declarations are local to the bundle, not globals.

**The sandbox denies everything else.** No network of any kind (`fetch`,
`XMLHttpRequest`, `WebSocket`, images, fonts, external scripts — all dead),
no storage, no cookies, no device access. The publish gate rejects the
syntax before the sandbox ever has to. Do not write a fallback for "if the
fetch fails"; there is no fetch.

**Navigation is forbidden rather than denied, and the difference is yours
to respect.** No browser feature stops a frame navigating itself, so
`location`, `window.open`, the Navigation API, meta refresh, links out and
hand-assembled markup are rejected by the publish gate rather than blocked
by the platform. A surface has no links out and never sends the viewer
anywhere.

**`invoke(actionId)` returns `false`** when the viewer cannot write or the
id is not declared in the spec. It never throws and never carries arguments.

---

## 2. Action design

An action is a named, **parameterless** list of ops. Members supply no
values — only which declared button they pressed. That is what makes a
hand-crafted post achieve exactly what tapping the control achieves, and
nothing more.

### An app with no actions has to say so

A spec with an empty `actions` map is a surface **no member can change**.
That is a real shape — a countdown, a schedule, a read-only summary whose
state moves only from host events — and it is also what an app looks like
when you forgot the thing it was asked for. Two apps shipped with
`actions: {}` for the second reason: expense splits that render "who owes
what" and offer no way to add an expense. Nothing in the gate or the rubric
said a word, because a screenshot of a board nobody can touch looks exactly
like a screenshot of a board somebody can.

So the gate now **warns** on an empty action map. It is a warning, not a
refusal: display-only is allowed, it just has to be on purpose.

**Before you reach for the marker, answer this: who changes this board, and
how?** If any part of the answer is a member — someone adds a cost, marks a
dish, claims a slot, casts a vote — then the app is missing that action and
the marker is the wrong fix. Silencing the warning does not give anyone a
button.

A worked counter-example, because this is the case that has now shipped
three times. "Who owes what for the trip" is **not** display-only. Somebody
has to add an expense, and if the answer is "the organizer types it in
chat and I republish", that is an app that does not work — the whole point
is that the board changes without you. It needs an action.

Display-only means the state moves **only** from host events you post on a
schedule, or from a value written once at creation: a countdown, a rota that
rolls over nightly, a summary of something outside the group. If you cannot
name the host event that moves it, it is not display-only.

**Naming it is the marker.** The declaration is not a flag, it is a sentence,
and the sentence is the part that does the work:

```json
"memberInteraction": {
  "mode": "none",
  "because": "<name the host event that moves this app's state, or the value fixed at creation>"
}
```

Write your own sentence. If the true one is "the organizer edits it and I
republish", you have just written down that the app does not work, which is
the point — the whole promise of a dashboard is that it changes without you.

This is scored. A spec carrying the marker draws an eighth rubric check
(`RUBRIC.md`, check 8), and it is scored against the request: display-only has
to be what was **asked for**, not what was convenient to build.

The last time this marker was a bare word, it was copied out of this document
into the first spec written for an expense split — one session after two
expense splits had shipped inert, eleven lines below the paragraph saying that
exact app shape is the wrong reason to reach for it. The rule fired on nothing.
That is why it costs a sentence now.

### The default: idempotent `set` keyed by `$actor`

```json
"vote-pizza": { "ops": [{ "op": "set", "path": "/votes/$actor", "value": "pizza" }] }
```

Per-member state — votes, RSVPs, check-ins, today's lifts — is a `set` at a
path keyed by `$actor`. Pressing twice writes the same literal to the same
path: the second press changes nothing. Reach for this first, every time.

`del` is idempotent too (`del` on a missing path is a no-op), so a "clear my
entry" action is `{ "op": "del", "path": "/today/$actor" }`.

### `append` means "duplicates are acceptable"

Not "avoid duplicates" — **accept them**. Three sources produce genuinely
distinct posts:

- a double-tap,
- a transport retry (the backend stamps a fresh id per poke; there is no
  `(author, sent)` dedup, so a retry is two real posts),
- the same member on two devices.

And because members supply no values, all three produce **byte-identical
entries**. Nothing downstream — your `render`, the bot, or a human reading
state — can tell a double-tap from two legitimate entries. Keying the path
by `$actor` does not help: it dedupes _different actors_, not _repeated
appends by the same actor_.

So: use `append` only where a stray duplicate is cosmetic, never where it
drives derived logic (a count, a total, a streak, a progression). If your
app would compute something wrong when an entry appears twice, you must not
use `append`. The publish gate folds every action twice and fails any action
whose second fold changes state, unless the action declares
`duplicatesTolerated: true` — a gate-level marker, so the gate's own
violation message is authoritative if it names something else.

### Host-is-the-clock: how you get periodic logs without `append`

The pattern, using the workout tracker (the worked example — read
`templates/workout-tracker/`):

1. **The member writes into a scratch area, idempotently.**
   `set /today/$actor/squat` with the literal `{"r":"ok"}`. Ten actions
   (ok/fail per lift) against a cap of 64. A double-tap re-sets the same
   path to the same literal and changes nothing.
2. **The host archives and clears.** The channel host posts one host event
   with two raw ops: `set /history/<date>` with a copy of `/today`, then
   `del /today`. The host computes both the date and the copied value from
   its own fold — members never supply either.

You get dated history, full idempotency, two ops well under the cap of 20,
and no `append` anywhere. It degrades gracefully: a missed rollover just
stretches "this session".

**Roll over LAZILY, not on a schedule.** The bot archives on its next organic
interaction with the channel. An OpenClaw cron job is not a line in a crontab —
it wakes the agent and runs a model turn, so scheduling this puts inference in
a timer path: every night a model works out what channel it is in, what date to
write, and composes a two-op bookkeeping post with no judgement in it. That
turn costs tokens, can fail, and can decide to do something else. Inference
belongs where somebody asked a question.

**The test for whether lazy is allowed: say out loud what a late close costs.**
For a habit log it is that a mark tapped at half past midnight files under the
day that just ended, and nothing on the board is paid, awarded, closed or
expired at midnight. If you cannot say the cost — money, a deadline, a winner,
anything disputable — the period is load-bearing and this is not the pattern
for it. v0 has no right answer for those, because a scheduled host event is
still a bot turn and a bot turn is still not a clock.

Two consequences to write into the app's copy rather than hide: a merged entry
covers everything since the last close and its marks are the UNION, and a run
therefore counts days ON THE BOARD, not calendar days — so never claim a
calendar streak.

**Both ops go in one host event, in that order, and that is load-bearing.**
The `del` is safe only because the `set` before it succeeded. The archiving
`set` is the op that fails, and it fails three ways: near the 128 KB
live-state cap, because it grows state while the `del` shrinks it; at any
size at all if `/history` is holding something other than an object, because
then there is nowhere to write; and at any size at all if you simply mistyped
the path. An entry that carried on past any of those would clear the day
without ever archiving it. The reducer will not let that happen: **when an op
is refused, every remaining op in that entry is refused too** — whatever it
was refused for — so the clear is unreachable unless the archive landed.
State after an entry is always a **prefix** of that entry's ops, never a
subsequence with a hole in the middle. Split the two ops across two host
events and the protection is gone — the second event is its own entry and
applies on its own.

That is the mechanism, and it covers every way the guard can fail, including
a guard that was never well formed to begin with. A typo'd path, a `$actor`
in a host op, a forbidden segment: the op is refused like any other and the
entry stops there. The reducer does not ask whose fault a refusal was before
deciding whether the ops after it were written expecting it to land.

So the doctrine rule below is belt-and-braces rather than your only
protection — write to it anyway, because it is what keeps an entry
_readable_ as a unit: **no destructive op whose safety depends on a preceding
op succeeding — unless both sit in the same entry with the destructive one
second.** Order every entry so the destructive op is last, and lint before
you post.

When a rollover does stop, the day is still sitting in `/today`. At the cap
the surface shows "dashboard full": snapshot, prune, post the rollover again.
A shape mismatch or a bad path raises no banner — the fold just reports an
aborted entry — so repair the op or the shape with a host op and post the
rollover again.

Host events are honored only from the channel host ship, and they cannot use
`$actor` (the op is refused, and takes the rest of its entry with it). They
are how the bot corrects data, closes a poll, archives a period, or prunes
state.

### Failures are silent

An op with a bad path, a `$actor` misuse, or a forbidden segment is refused —
with a debug log nobody reads. So is an op **state** turns down: a write
through a non-object, an `append` onto something that is not an array, the
live-state cap, the depth cap. Every one of them takes the rest of its entry
with it (§12). A typo in an action path is not an error, it is an action that
quietly does nothing — and quietly does nothing to the ops written after it
in the same entry. Lint, then fold, then preview.

Two things are not refusals and stay silent in a different way. A `del` on a
path that is not there does nothing and the entry carries on — that is the
op succeeding at deleting nothing, however the path fails to exist, below a
scalar or below an array alike. And a whole entry over cap never reaches the
fold at all: it degrades to an unknown entry and is skipped in one piece.

The fold reports a count of aborted entries, so `surface snapshot` and the
records commands can tell you an entry landed only in part. Nothing surfaces
it to the app.

### Keep action ids literal: the handler table

The gate cross-references every `invoke('…')` in the bundle against the spec's
declared actions. That check is the only thing standing between a typo'd id
and a button that silently does nothing — and it works on **literals only**.
`invoke(option.actionId)` or `invoke('vote-' + option.id)` cannot be
cross-referenced at all: the gate warns and **that call goes unchecked**, so
every id reaching `invoke` that way is a typo nothing will catch.

Rendering one button per item is still the natural shape. Do it through a
table keyed by item id, with a literal in every entry:

```js
const VOTE = {
  pizza: function () {
    return invoke("vote-pizza");
  },
  tacos: function () {
    return invoke("vote-tacos");
  },
};

const has = function (object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
};
```

Then look it up per item, and render a **disabled** control when there is no
entry:

```js
html`<${Button} disabled=${!canInvoke() || !has(VOTE, id)} onPress=${VOTE[id]}>
  Vote
<//>`;
```

Adding a choice is two edits — an action in `spec.json`, a line in the table —
and the gate fails if you make one without the other. A choice with no entry
is **visibly inert** rather than a live control that does nothing, which is
the same refusal-over-best-effort posture as every other state in the runtime.
Use `hasOwnProperty`, never a bare `id in VOTE`: an inherited name like
`constructor` would otherwise resolve to something that is not an action.

Both templates use it — `VOTE` in `templates/poll/`, `LOG` in
`templates/workout-tracker/`.

---

## 3. Time never enters ambiently, and never enters writes

The rule, in one line: **time never enters ambiently and never enters
writes; a host-supplied `now` is a display input.**

### Why the clock is banned

`render` never reads a clock. No `Date`, no `Date.now()`, no
`setTimeout`/`setInterval`, no `requestAnimationFrame`, no
`performance.now()`, no elapsed time measured inside the sandbox.

The sandbox's clock is the **viewer's**. Every boundary that matters — the
rollover, the archived date, the deadline the host wrote down — is the
**host's**. An app that reads its own clock shows a different board to a
member in Lisbon and a member in Los Angeles, and **nothing tells either of
them that.** There is no error, no warning, no divergence anyone can see: two
people describe the same screen differently and conclude one of them is
confused. That silence is the whole reason this is a rule and not a
preference.

Start from state. The **order** of state is yours (arrays and sorted keys are
ordered), and **any date the host wrote into state** is yours. For most apps
that is all the time information that should exist: a deadline is a string
the host wrote, a "closed" flag is a field the host set. Reach for the
paragraph below only when the screen genuinely has to move between host
events — and note that "genuinely" is rarer than it feels.

### Writes are not display, ever

A state transition that depends on time — "closed once the date passes",
"archived at midnight", "streak broken after 48 hours" — is a **host event**
and nothing else. No value of `now` can cause a write: `render` writes
nothing, `invoke` carries no arguments, and an action's ops are fixed in the
spec. If the rule you are implementing changes what is IN the board rather
than what is ON the screen, it belongs to the host, and the host-is-the-clock
pattern (§2) is how it gets there.

Display and writes never blur. An app may grey out an expired row it derived
from `now`; it may not decide the row is expired in state.

### The display hatch: a host-supplied `now`

When the screen really must stay current between host events, `render`'s
**second argument** carries the host's clock:

```js
surface.register({
  render(state, context) {
    // context.now is epoch milliseconds from the HOST, or null
    const left = context.now === null ? null : state.targetMs - context.now;
    ...
  },
});
```

and the spec declares that the screen depends on it:

```json
"timeDisplay": { "refreshSeconds": 60 }
```

The declaration is what makes the host resend `now` on that cadence; without
it `context.now` is the single reading the screen was opened with, and the
app is frozen at it. `context.now` is `null` when the host supplied nothing —
render something sane for that rather than assuming a number.

Three properties, all load-bearing:

- **It is an input, not state.** It arrives beside `state`, never inside it,
  and nothing derived from it can be written back.
- **It is per-viewer, like theme.** Two members can see different values; that
  is fine for a countdown and fatal for a stored fact, which is what the
  previous section is about.
- **It is injectable, so captures are reproducible.** `surface preview`, the
  publish gate's smoke render and the preflight witness all inject the same
  FIXED `now`, so the same cell rendered by two preview runs at different
  wall-clock times is byte-identical — measured, with the ambient-clock arm
  measured beside it to show the comparison can fail.

  Stated at the strength it actually holds: what is pinned is the CONTENT, and
  cell-to-cell byte equality within one run has been seen to flake about once
  in sixty cells on visually indistinguishable images. So compare a cell
  against ITSELF across runs, which is what the control does; do not build
  anything that diffs one cell's bytes against another's.

Integer arithmetic on epoch milliseconds (§5) is how you turn it into "3 days
left". Do not reach for `Date` to format it — `Date` is refused by the gate,
and an absolute calendar date is a string the host should have written.

### What the gate actually enforces, and what it does not

Two checks, and neither subsumes the other:

- **Lexical** — the bundle's code is scanned for `Date`,
  `setTimeout`/`setInterval`, `requestAnimationFrame`/`requestIdleCallback`
  and `performance.now`. Any of them is an **error**. Comments are not code,
  so a comment saying "this app never calls `Date`" is fine.
- **Behavioral** — the gate renders the initial state twice, one day apart on
  the host-supplied clock, and compares the painted output. A screen that
  moves without a declared `timeDisplay` is an **error**; a declared
  `timeDisplay` whose screen never moves is a **warning**.

It does **not** catch: a clock reached through an alias or a computed member
expression (`globalThis['Da' + 'te']`); a `Date` read whose painted result
happens to be identical across a day; `Intl.DateTimeFormat`, which formats a
host-supplied timestamp without reading a clock and still renders in the
viewer's timezone. The ordinary ways of reading a clock are refused. A
determined evasion is not, and never was the claim — the rule is a rule
because of what it costs the members, not because a scanner can prove it.

---

## 4. No viewer identity

The bridge tells the app whether the viewer **can** invoke (`canInvoke()`).
It does not tell the app **who** the viewer is. There is no "my vote", no
"you're up next", no personalized greeting.

Design around it, do not fight it:

- **Render the whole crew.** Show every member's row; the viewer finds
  themselves. This is why the sigil avatar exists.
- **Label controls "you".** "All reps" / "Clear my entry" / "This clears
  only your own entries." The button acts on the viewer because the _effect_
  targets `$actor` server-side — the app never needs the name to be correct.
- **Never guess.** Do not infer the viewer from the newest event, the only
  member, or anything else.

Use `canInvoke()` to disable controls for read-only viewers rather than
hiding them, so the screen is stable for everyone.

---

## 5. Integer arithmetic

`render` is ordinary JavaScript, so it has ordinary floats.
`25 * 0.9` is `22.499999999999996`. An obvious floor to the nearest 2.5 kg
plate yields **20 kg where 22.5 was meant** — a silent, plausible, wrong
number.

Carry money in **cents**, weights in **tenths of a kilo**, percentages in
**basis points**, anything divisible in its smallest whole unit. Do all
arithmetic on integers, divide only in the formatter:

```js
const tenths = (kg) => Math.round(kg * 10);
const format = (t, unit) => String(t / 10) + " " + unit;
```

**A proportion handed to a primitive is not a derived value.** `Progress`
takes a fraction from 0 to 1 by contract, so every app that uses it divides.
That is the formatter boundary, not a violation of this section: the fraction
is consumed as geometry and never displayed, and the number a member reads
("4 of 5", "80.0%") must still come from integers. Divide for the bar; never
divide for the label.

Store integers in state too. The op language has no arithmetic at all, so
every computed value is derived in `render` — which is exactly why the
rounding has to be right there.

---

## 6. `$actor` is the only identity in a path

`$actor` is substituted by the reducer from the post's verified author, and
only inside spec-declared action ops. It works in two positions:

- **As a whole path segment:** `set /votes/$actor` → the state key is the
  member's ship. Partial segments (`/votes/x$actor`) are invalid.
- **As an exact string value,** anywhere in the value tree:
  `{"who": "$actor"}` → `{"who": "~zod"}`. Substrings stay literal.

Never write a ship name into a path yourself; use `$actor`. If a host op
genuinely must name a literal ship, remember:

**A ship has two spellings, and one spec routinely needs both.**

| position                            | spelling | why                                                                                                                  |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| path segment                        | `~0zod`  | RFC 6901: `~` is the escape character, so a bare `~z` is an invalid escape and **silently invalidates the whole op** |
| object key or string inside a value | `~zod`   | values are not pointers; no escaping applies                                                                         |

Reading it back in `render`, the state key is the plain ship: after
`set /votes/$actor`, `Object.keys(state.votes)` gives `['~zod']`. Pass that
string straight to `<${Avatar} ship=${ship} />`.

`/` inside a segment escapes as `~1`. Segments may not be `__proto__`,
`constructor`, or `prototype`.

---

## 7. `sentAt` is display data, not evidence

If a post's time ever reaches you, know which one it is. The post **id** is
stamped by the host ship's clock and cannot be forged. `sentAt` is a field
the **sender** wrote into their own post and can hold any value they like.

Reduced state carries no timestamps at all today — op values are literals
from the spec — so this matters in one place: **never treat a
sender-supplied time as truth**, in an app, in a host op you compute, or in
anything you report to the user. A date the host wrote from its own clock is
the only trustworthy time a surface has.

---

## 8. Vocabulary: use the words the user's domain uses

Every v0 constraint invites you to hit a wall, describe it accurately, and
ship jargon. The first workout app shipped "lifts logged since the last
rollover" and "your own scratch entries" — both true, both meaningless to a
lifter, when "this session" was available and natural.

**No mechanism vocabulary in anything a member can read.** The lint catches a
fixed denylist; it cannot tell whether your copy makes sense. You are the
only control.

| never say                                                | say                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| "since the last rollover"                                | "this session"                                               |
| "your own scratch entries"                               | "your own entries for this session"                          |
| "Archived sessions appear here after the first rollover" | "Your past sessions will appear here"                        |
| "No rollover has happened yet"                           | "No sessions saved yet"                                      |
| "invoke", "action", "trigger"                            | the verb of the domain: "vote", "log", "sign up"             |
| "spec", "revision", "republish"                          | say nothing — this is invisible to members                   |
| "state", "fold", "reduce", "event"                       | the noun of the domain: "the sheet", "the board", "an entry" |
| "host", "sandbox", "bundle"                              | say nothing                                                  |
| "$actor", "~zod's entry" in prose                        | "your entry"                                                 |

The register rule: write the words the group would use talking to each other
about this thing. A potluck sheet says "bringing"; a gym board says "session"
and "missed"; an RSVP says "coming". If a sentence explains how the app
works rather than what it shows, delete it.

Empty states are where jargon leaks most. "No sessions saved yet" beats "No
rollover has happened yet"; "Nobody has signed up yet" beats "State is
empty".

You catch the rest by reading every word in the preview screenshots —
`RUBRIC.md` check 6. Nothing else can: the lint has a fixed denylist, and a
denylist cannot tell whether a sentence means anything to a member.

---

## 9. Charts go through the chart primitive

`primitives.Chart` is the only chart path. Pass `type`, `data`, `options`,
and a named `size` — never dimensions.

The reason is measured, not stylistic: given the raw Chart.js constructor,
two independent bundles both wrote `responsive: false` with a hardcoded
pixel canvas, and both overflowed every phone viewport. The primitive owns
the container, applies the responsive settings _after_ your options so the
broken path is unreachable, and colors series from the theme tokens.

`surface.Chart` (the raw constructor) still exists as an escape hatch. Do not
use it. Besides the sizing bug, it carries a live trap: **Chart.js degrades
cleanly on construction only — `chart.update()` with no 2D context throws.**
A throw inside render replaces the entire app with the error box. The
primitive guards this by falling back to destroy-and-rebuild; hand-rolled
chart code does not.

The publish gate checks this behaviorally: it renders your bundle, presses
its controls, and reads `responsive: true` / `maintainAspectRatio: false`
off every **live chart instance** — not off the config the chart was built
with, so constructing responsively and then reassigning `chart.options` is
caught too, including from a click handler.

It also rejects a `<canvas>` carrying `width`/`height` in the rendered
output. Read that one narrowly: the gate substitutes a recording stand-in
for Chart.js, so an attribute there was put there by your bundle. **Real
Chart.js sets `width`/`height` on the canvas itself** — that is what the
backing store is — so "a real render has no such attributes" was never true
and is not what the gate measures.

---

## 10. The sigil avatar

Pass a ship name; the primitive draws the real sigil, colored from the theme
tokens: `<${Avatar} ship=${'~zod'} />`. Apps never touch sigil rendering,
never pick colors, and never set a size.

A name the library cannot draw (a moon, a comet, a malformed string) falls
back to initials rather than throwing — `ship` arrives from app state, so a
bad one is ordinary input, not a bug. Pass `initials` alongside `ship` when
you have a better fallback than the first two characters of the name.

Because apps render the whole crew (§4), a dashboard that shows people
without sigils looks nothing like Tlon. Use it in every member list.

---

## 11. When render throws

The harness catches it and renders a labeled error box in place of your app,
then reports a truncated error over the bridge. It never white-screens and
never takes the harness down.

But: **state is shared, so a throw is a throw for everyone.** One member's
entry with an unexpected shape breaks the app for the whole group until the
state changes again. Write render as if state is hostile:

- default every read: `const votes = state.votes || {}`
- guard every array: `Array.isArray(x) ? x : []`
- never index blindly: `(state.lifts || {})[id] || {}`
- never assume a member key exists because you just saw its action fire

The error is edge-triggered — one report per failure streak — so a
persistently broken app reports once, not once per render.

---

## 12. Caps

Three different failures: a spec over cap is an **invalid definition** and
the surface refuses to render at all; an event or snapshot over cap degrades
to an unknown entry and is skipped **whole**; and a single op that is refused
for any reason at all — malformed on its face, or turned down by state (the
live-state cap, the depth cap, a shape with no such path) — takes the rest of
its entry with it.

| thing                           | cap                          |
| ------------------------------- | ---------------------------- |
| bundle                          | 256 KB                       |
| whole spec                      | 32 KB                        |
| `initialState`                  | 8 KB                         |
| `recipe`                        | 8 KB (inside the spec total) |
| actions per spec                | 64                           |
| ops per action / per host event | 20                           |
| single op value                 | 4 KB                         |
| event entry                     | 8 KB                         |
| snapshot state                  | 128 KB                       |
| **reduced state (live)**        | **128 KB**                   |
| JSON depth                      | 16                           |
| path                            | 200 chars, 12 segments       |
| action id                       | ≤ 64 chars, `/^[a-z0-9-]+$/` |

The live-state cap is the one you will actually hit: any op whose result
would exceed 128 KB is **refused** — state is unchanged, the surface shows
"dashboard full", and **the rest of that entry does not apply either**. Every
other refusal aborts the entry the same way and for the same reason (see
"Host-is-the-clock" above), but none of them shows "dashboard full": that
banner means the one failure a host repairs by pruning, and pruning neither
makes a path shallower, nor turns a scalar into an object, nor puts a leading
`/` on a mistyped path. A later entry that only shrinks state still applies,
since a `del` can never be refused for size. The repair is a host snapshot
plus a prune, not a bigger cap.

Design for it: keep state to the log and derive the rest. A `history` keyed
by date with a bounded number of members is fine; one entry per tap forever
is not.

---

## 13. Revising a live surface

**State changes are events. UI and action changes are revisions.** Never
publish a new spec to change data; never post events to change the UI.

**The trap: adding a thing is usually both.** `initialState` is the state a
revision starts from — and a live channel with data does not start over. With
`--preserve-state` the carried state wins and the new `initialState` is never
read; without it, state resets to the new `initialState` and the existing data
is gone. Neither of those is "add one item to the existing list".

So **data that lives in state changes by host event, not by revision.** "Add a
poll choice" is two mechanisms:

1. a **revision** — the new action in `spec.json`, the new line in the handler
   table, and `--preserve-state` so the votes already cast survive it;
2. a **host event** — `tlon surface event <channel>` with the op that appends
   the choice to `/options`.

Publish the revision alone and the user is told the choice was added, opens
the channel, and sees the old three. Read the state back with
`tlon surface state <channel>` before you claim a change landed.

`surface publish` enforces this: a `--preserve-state` revision whose
`initialState` differs from the one the channel holds is refused as
`initial-state-changed`, with every path the carried state will not have named
in the message. The refusal is cleared by `--allow-initial-state-change`, which
is an acknowledgment that the host event is still to come — not a substitute
for it.

- **Any content change bumps the revision** — including a bundle-bytes-only
  change. `surface publish` does this; a byte-identical republish is reported
  as an explicit no-op, never a silent bump.
- **`preserveState: false` (the default)** resets: the new revision folds
  from `initialState`, and prior-revision events are never replayed. Correct
  when the user wants a fresh start, or when the shape of state changed
  incompatibly.
- **`preserveState: true`** requires a host migration snapshot at _exactly_
  the new revision. Until it lands the surface renders "migration pending" —
  a defined state, not an error. `surface publish --preserve-state` posts
  both in one command, so the pending window is one command wide. Never
  publish a preserving revision and plan to snapshot later.
- **Stale invokes.** An invoke tagged with an older revision is dropped,
  unless the current spec's action of the same id sets `acceptStale: true`,
  in which case it applies using the **current** action's ops. Set it on
  actions whose meaning is unchanged across the revision (a vote is still a
  vote); leave it off when the ops now mean something different. Host events
  have no stale exception.
- **Keep action ids stable across revisions.** A renamed id drops every
  in-flight invoke and every stale one.
- Edited surface posts are treated as retractions; deleting a post above the
  newest snapshot refolds convergently on every client. That is the repair
  path for bad data — not a spec revision.

---

## 14. `recipe` is member-visible

`recipe` rides in the channel description, which every member of the group
can read. It is regeneration context for the next revision, not a log of the
conversation.

- Write what the app is for and what shaped its design: the domain, the
  options, the rules, the deliberate omissions.
- Keep the user's framing out of it — how they described their group, why
  they wanted it, anything they said in confidence, anything about a person
  who is not in the room.
- No transcript, no quotes, no names beyond what the app itself displays.
- 8 KB cap, inside the spec's 32 KB.

Assume it will be read by the people the app is about.
