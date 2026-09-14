# Desk compatibility: the N-1 policy

Every app release N must **start, sync, receive updates, and post** against the
previous %groups desk release, N-1. Feature parity is not required.

We satisfy that by **release ordering**, not runtime fallbacks: a desk change
the client will depend on ships one desk release *before* any client release
depends on it. A fallback is the exception, and an untested fallback is worse
than none.

## Rules

**(a) `MIN_GROUPS_VERSION` records the floor; it does not set it.**
`packages/shared/src/logic/deskPolicy.ts` holds the oldest %groups desk
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

## Running the checker

```
pnpm check:desk-compat --client-ref <ref> --desk-ref <ref> [--base-ref <ref>]
                       [--json|--markdown]
pnpm check:desk-compat --list
```

Exit `0` = nothing `MISSING`; `1` = at least one, or a protocol difference; `2`
= internal error. `--list` prints every request extracted from the client and
reads no desk at all, which is the fastest way to see what the client asks for.

At release time it runs over **three** ref pairs:

| run | client ref       | desk ref       | what it catches                                     |
| --- | ---------------- | -------------- | --------------------------------------------------- |
| 1   | candidate client | N-1 desk tag   | rule (b): the candidate needs something N-1 lacks   |
| 2   | candidate client | candidate desk | candidate self-consistency                          |
| 3   | released client  | candidate desk | rule (c): the candidate desk removed something live |

Pair 1 runs on every PR in `ci.yml`. The `--markdown` report goes to the job
summary always, and to one sticky PR comment edited in place on each push —
except on a fork or Dependabot PR, whose token cannot write comments, where the
job summary is the only copy.

## The five verdicts

**The checker never says a request is served.** It reads arm *patterns* and
file names; it does not read arm bodies, and it cannot know whether the code
behind a matching pattern answers. Every verdict is a statement about the
dispatcher, not about the agent.

- **`MISSING`** — a known agent's dispatcher has no arm whose pattern can take
  this pole under any completion; or a repo-owned mar file, an agent file, or a
  `desk.bill` entry that *another desk had* is absent here. Absence alone is
  never enough: an agent may sit in `desk/app` unbilled on purpose — `%notes`
  does, and `channels.hoon` reins it on through `%hood` — so "not in
  `desk.bill`" does not mean "not running". Only the comparison tells a
  removal from something that was never started this way, which is why a
  self-check needs `--base-ref` to see one at all. **This is the only verdict
  that fails a run.**
- **`MATCHED`** — an arm's pattern consumes every segment of the request
  through literals, typed atoms (`@`, `@p`, `@ud`) and `?()` members, or the
  mar file exists. It says an arm is there for this shape. It does not say the
  agent answers, that the JSON parses, or that the response has the shape the
  client expects.
- **`WILDCARD`** — the only arm that matches does so by swallowing the tail
  with `*`/`rest=*`, or by consuming a segment as a named mold this reader
  cannot resolve (`=kind:c` is `?(%diary %heap %chat)`, not "any knot"). The
  pole is accepted; almost nothing follows from that.
- **`UNVERIFIED`** — the checker could not decide. Each entry names why: an
  unresolved request, an app outside this desk, a thread or an eyre endpoint,
  an interpolated tail that is what decides, an arm pattern that would not
  parse, or a dispatcher whose subject is rewritten before it runs.
- **`GUARDED`** — `MISSING`, but extracted from behind a capability guard, so
  the client may never send it to a desk that lacks it. Reported for review,
  never blocking. See below.

An interpolation does not stop at a slash: a `groupId` is `~ship/name` and
spans two segments, so `` `/v3/ui/groups/${id}` `` is decided by its known
prefix or not at all.

A request's identity is the literal text around its interpolations, with every
interpolation written `{}` whatever is inside it. Literal braces are escaped,
so no literal can spell a hole — but a suffix folded *into* an expression
shares a key with the shorter path: `` `/chan/${id + '/new'}` `` and
`` `/chan/${id}` `` are both `/chan/{}`. They cannot be exempted separately in
`known-gaps.json`, so write the suffix outside the interpolation where it
matters.

## What the checker does not decide

Read this before treating a green run as a guarantee.

- **Whether a matching arm serves the request.** Arm bodies are not read. An
  arm may `?-` on something, re-dispatch into a sub-handler, or return `[~ ~]`.
- **Response shapes.** Nothing checks that the JSON the agent returns is what
  the client parses.
- **Whether an agent accepts a mark.** `MATCHED` for a poke means the mar file
  exists in `desk/mar`, which is desk-global; it says nothing about the agent.
- **Guards before the dispatcher.** `?>`, `?<` and `?.` can reject a request
  the arms would have taken. They are ignored, because a guard can only weaken
  a match — it can never invent an absence.
- **Anything about a rewritten pole.** Where an agent rebinds its subject
  before the `?+` (`%lanyard` strips the care and the version), the whole
  surface is `UNVERIFIED`. The one rewrite that *is* modelled is the `%v0`
  injection `%channels` and `%reel` write, because the arms are written against
  the injected pole.
- **Desks older than N-1**; web-glob versus desk skew; native store versions;
  agents outside `desk/app/`; `tlon-skill` / `openclaw` / `hermes-tlon-adapter`
  / `tlon-bot-e2e`.

Layers 2 (agent review at release time) and 3 (a pinned N-1 `~bus` in the E2E
suite) cover those.

## How to write a fallback the checker recognises

A request the desk cannot take is blocking unless the client only sends it to a
desk that *can*. The checker recognises exactly one spelling of that: a branch
whose guard names a **capability**.

```ts
path: getActivitySupportsNotes() ? '/v6/volume-settings' : '/volume-settings';
```

The guard must mention one of `getActivitySupportsNotes`,
`activityVersionSupportsNotes`, `groupsVersionSupportsNotesSearch`,
`groupsVersion`, or a `…MIN_GROUPS_VERSION` constant — something that asks what
the desk supports, so the two branches are the same request written for two
desk versions. A branch on `whomIsDm(whom)` or `type === 'channel'` picks
between two requests the client makes in different *situations*; its sibling
being served says nothing about N-1, and the `MISSING` one still blocks.

That test is a **regex over the guard's text**, with all the credulity that
implies: `type === 'groupsVersion'` matches, a guard written in a trailing
comment matches, and polarity is not read at all — `supportsNotes` and
`!supportsNotes` are the same string to it. It is a filter for a reviewer's
attention, not a proof of anything, which is why every `GUARDED` entry has to
be read rather than counted.

A request is `GUARDED` only when **every** call site that makes it is guarded.
One unguarded occurrence means the client sends it to N-1 regardless, so the
request stays `MISSING` and the report names which sites are guarded and which
are blocking.

A guarded branch is reported as `GUARDED` and does not fail the run. That is
deliberately weaker than it sounds: **the checker does not verify the other
branch is served, or that the guard is correct.** It is saying "a human wrote a
desk-version branch here, go and look". An earlier version of this tool tried
to prove the complement was served at the same call site; the analysis cost
more than the signal was worth, and a reviewer reading one `GUARDED` line
against N-1's arms does the job better.

## Adding a known gap

`packages/scripts/src/check-desk-compat/known-gaps.json` lists requests that
are `MISSING` today and knowingly do not fail the gate. Every entry is debt: it
records a client call the desk does not serve, so the feature behind it is
already broken. An entry must name the commit that broke it and the issue
tracking it, and matches one exact request key. Adding one to turn a red gate
green is the one thing the file is not for — a *new* `MISSING` means the change
under review needs its desk change to ship first.

The checker **warns when an entry excuses nothing** in a full scan. Delete it:
the gap it names has been fixed, and leaving it is standing permission for a
regression nobody is tracking. The same warning covers a stale `protocolBumps`
entry.

`known-gaps.json` is read from the candidate checkout, which on its own would
let one change add an unsupported request *and* the entry excusing it. So an
entry only applies to a request the base already made and the same desk already
could not take: pass `--base-ref`, and an entry that does not clear that bar
leaves its request `MISSING`, with the reason on the entry.

`ci.yml` passes the PR's base commit; the staging workflow passes
`origin/master` on run 1. Runs 2 and 3 pass none, and neither needs one: run 2
checks the candidate against its own desk, where a request the desk cannot take
is the candidate's problem whether or not it is new, and run 3 already has
`origin/master` as its *client*, so it would be comparing that ref with itself.

A local run without `--base-ref` applies entries as written and says so in a
`NOTICE` — convenient for reading a report, not a gate.

## Shipping a protocol bump

The bump PR is itself the change that creates the difference rule (d) forbids,
so it would otherwise never be able to merge. It adds an entry to
`protocolBumps` in `known-gaps.json` naming the agent, protocol, `from`/`to`
versions and an issue. `from`/`to` name the transition, and an entry matches it
in either orientation: the gate run reads the candidate against N-1 and sees
new/old, while a released-client run reads the other way. Only that one pair of
versions is excused. The checker still prints the difference loudly — in its own
`ALLOWED PROTOCOL BUMP` section — but stops failing on that exact transition;
any other mismatch still blocks. N-1 support for the protocol is suspended until
the bump becomes N-1, and the next release removes the entry.
