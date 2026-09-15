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

## The desk requests comment

A PR touching `packages/api` or `packages/shared` gets one sticky comment
headed "Desk requests" — an inventory diff between the PR's merge base and its
head, listing the scries, subscriptions, pokes and threads the branch adds,
changes or drops, grouped by kind and agent with their call sites. It comes
from `pnpm check:desk-requests <ref> [--markdown]`
(`packages/scripts/src/check-desk-compat/`), which extracts what the client
asks for at two refs and compares the two inventories. It reads no desk.

So the comment is a worklist, not a verdict: nothing in it fails CI, and rule
(b) is enforced by a person. For each added or changed entry a reviewer
confirms that N-1 has the arm, that version injection is accounted for, and
that `agent:neg` agrees; an entry that cannot be confirmed is flagged rather
than waved through. `AGENTS.md` carries that checklist, for human and agent
reviewers alike.
