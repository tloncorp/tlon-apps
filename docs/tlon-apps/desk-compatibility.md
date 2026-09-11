# Desk compatibility: the N-1 policy

Every app release N must **start, sync, receive updates, and post** against the
previous %groups desk release, N-1. Feature parity is not required.

We satisfy that by **release ordering**, not runtime fallbacks: a desk change
the client will depend on ships one desk release *before* any client release
depends on it. A fallback is the exception, and an untested fallback is worse
than none.

## Rules

**(a) `MIN_GROUPS_VERSION` records the floor; it does not set it.**
`packages/shared/src/logic/deskCompatibility.ts` holds the oldest %groups desk
this client supports; by policy it equals the previous desk release. Raising it
is a *release* action taken once that desk has shipped.

**(b) A client PR that adds a dependency N-1 lacks is blocked** until the desk
change has shipped and become N-1, or the PR carries a fallback tested against
N-1. "Dependency" means a scry path, a subscription path, a poke mark, a
thread, or a response shape.

**(c) Desk removal is bounded by the support window** — the currently released
client plus the candidate client. The released client is taken to be
`origin/master`'s tip. Read that precisely: `sync.yml` merges `staging` into
`master` when a deployment workflow *completes*, and its trigger is
`types: [completed]`, which fires whatever the conclusion; it merges the staging
tip as it stands at that moment. So `master` is the last sync of staging after a
deployment run, not a verified deployed SHA. It is the best standing proxy we
have, and it is never force-pushed, but a failed deploy or a staging push landing
between deploy and sync can move it ahead of what users run. Recording the
deployed SHA is a follow-up.

**(d) Negotiation protocols are a hard floor beneath `MIN_GROUPS_VERSION`.**
Each agent declares a protocol version through `agent:neg`; %groups went
`~.groups^%2` at v12.1.0 to `~.groups^%3` at v12.2.0. When N and N-1 disagree,
`negotiate` blocks the pair outright — the invite picker greys the peer out and
channels render the mismatch notice — so no amount of path-and-mark
compatibility rescues it. A protocol bump must ship one release ahead of the
client that needs it, exactly like a new path. This is also why v12.1.0 is
unusable as a pinned N-1 pier and v12.2.0 is.

The bump PR is itself the change that creates the difference, so it would
otherwise never be able to merge. It adds an entry to `protocolBumps` in
`packages/scripts/src/check-desk-compat/known-gaps.json` naming the agent,
protocol, `from`/`to` versions and an issue. The checker still prints the
difference loudly — in its own `ALLOWED PROTOCOL BUMP` section — but stops
failing on that exact transition; any other mismatch still blocks. N-1 support
for the protocol is suspended until the bump becomes N-1, and the next release
removes the entry. While an entry matches no observed difference the checker
warns rather than failing, because the candidate-vs-candidate run legitimately
shows no differences at all.

## Running the checker

```
pnpm check:desk-compat --client-ref <ref> --desk-ref <ref> [--json]
```

Exit `0` = no `MISSING`; `1` = at least one (or a protocol difference); `2` =
internal error. `UNVERIFIED` never changes the exit code but is always printed:
it is the checker saying it could not decide, and it is layer 2's inbox.

At release time it runs over **three** ref pairs sharing one ownership set:

| run | client ref       | desk ref       | what it catches                                     |
| --- | ---------------- | -------------- | --------------------------------------------------- |
| 1   | candidate client | N-1 desk tag   | rule (b): the candidate needs something N-1 lacks   |
| 2   | candidate client | candidate desk | candidate self-consistency                          |
| 3   | released client  | candidate desk | rule (c): the candidate desk removed something live |

## How a verdict is reached

Rules are applied in this order; the first that fires decides.

- **P0 — pre-dispatch obstruction.** The agent guards or rewrites the pole
  before its `?+` (`channels.hoon` injects `%v0`; `steward.hoon` rejects remote
  scries), so the pole the dispatcher sees is not the one sent. No `MISSING`
  verdict is available for that surface. The only agent-wide taint.
- **P1 — known-prefix absence ⇒ `MISSING`.** Take the request's leading literal
  segments (the care first, for peeks). If no arm can match that prefix under
  any completion, the request is missing. Unknown segment counts do not rescue
  it, and `?(...)` unions are expanded rather than failed open.
- **P2 — prefix matches, suffix unknown ⇒ `UNVERIFIED`,** unless the matched
  arm's tail accepts any completion. A TypeScript interpolation does not stop at
  a slash: a `groupId` is `~ship/name` and spans two segments.
- **P3 — delegation.** A wildcard-tail arm does not terminate the walk. When the
  matched arm re-dispatches, the delegated path is rebuilt and P1-P3 re-applied
  against the sub-dispatcher. Only an arm that *serves* terminates. Where the
  sub-dispatcher or the rebuilt path cannot be resolved, the answer is
  `UNVERIFIED` — never an approved arbitrary suffix.
- **P4 — open value sets ⇒ `UNVERIFIED`.** `` `/${feedVersion()}/…` `` leaves no
  prefix to match against.

A **self-guard is treated as satisfied and ignored entirely**,
affecting neither `FOUND` nor `MISSING`. `?> from-self`, `?> =(src our)` and
`(team:title our.bowl src.bowl)` all assert that the caller is this ship, which
every frontend request is by construction: the client only ever scries and
subscribes to the ship it is logged into. Treating them as obstructions would
both drop real coverage and let a genuinely absent arm hide behind them. `?<`
asserts the negation, so a self-check there *rejects* the frontend and stays
conservative.

**Deleted agents**: an agent the client's own desk has and the desk under test
does not is `MISSING`, not "out of desk" — otherwise deleting an agent would
walk straight through the removal gate. An app in neither tree is out of desk.

**Marks**: ownership is decided by exclusion against `peru.yaml`'s pick lists —
read from the **desk under test**, since a mark dropped from its pick list
without a local mar file is a removal —
anything under `desk/mar` that is not vendored and not an out-of-desk app is
repo-owned, and its absence is a removal. The alternative ("ours if it resolves
at either ref") is self-defeating for exactly the removal case, because deleting
the mar file also erases the proof we owned the mark. `FOUND` for a mark claims
only that the file exists.

Conditional branches are reported **per branch, never unioned**, each carrying
its guard text — including the condition an early `return` inside an `if`
implicitly negates for the returns after it. A `MISSING` branch whose sibling at
the same call site is `FOUND` is the policy's fallback exception: it is reported
in its own *covered fallback* section with the guard, and does not fail the run.
A `MISSING` with no served sibling still blocks.

A guard is otherwise conservative in **both** directions — it may reject a
request the arms would have served, so a match proves no more than an absence
does — whether it sits before the dispatcher or inside the matched arm. The one
exception is the self-guard below.

## Reading `UNVERIFIED`

Each entry names the rule that could not decide it, the call site, and the
argument text. Entries under `coverage` are out of layer 1's reach by
construction: out-of-desk apps, agents absent from `desk.bill`, threads, and the
notes HTTP endpoints, which talk to eyre URLs directly. They are real desk
dependencies, recorded rather than dropped, and layer 2 reviews them.

## Adding a known gap

`packages/scripts/src/check-desk-compat/known-gaps.json` lists requests that are
`MISSING` today and knowingly do not fail the gate. Every entry is debt: it
records a client call the desk does not serve, so the feature behind it is
already broken. An entry must name the commit that broke it. Adding one to turn
a red gate green is the one thing the file is not for — a *new* `MISSING` means
the change under review needs its desk change to ship first.

## What the static check cannot see

Response shapes; `.^` fan-out beyond one level or inside helper arms; whether an
agent actually accepts a mark's JSON. Layers 2 (agent review at release time)
and 3 (a pinned N-1 `~bus` in the E2E suite) cover those.

**Out of scope:** desks older than N-1; web-glob versus desk skew; native store
versions; agents outside `desk/app/`; `tlon-skill` / `openclaw` / `tlon-bot-e2e`.
