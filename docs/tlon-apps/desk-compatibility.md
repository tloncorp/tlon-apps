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
thread, or a response shape. That judgment is made in review — the
desk-requests comment on the PR — and proven by the E2E job that runs the
candidate client against a pinned N-1 pier.

**(c) Desk removal is bounded by the support window** — the currently released
client plus the candidate client. The released desk and web client are the
latest `vX.Y.Z` tag *whose livenet deploy succeeded*: the tag is cut by hand on
the release commit and dispatched to livenet afterwards, so a tag that has been
cut but not deployed, or whose deploy failed, is not what users run.
`origin/master`'s tip is not it either — the same branch also carries the
plugin release, which sometimes leapfrogs the desk and leaves master ahead of
the last deployed desk.

Mobile widens that window. Builds are cut separately (`mobile-build.yml`), and
older binaries stay supported down to each platform's minimum version, which
lives in the invite service — `useRequiredUpdate` forces an update only below
that `minVersion`. So removal is bounded by the released web client, the
candidate, and each mobile platform's builds down to its configured minimum.
Before removing a desk endpoint that older mobile builds still call, raise
those minimums past the last build that made the request.

**(d) Negotiation protocols are a hard floor beneath `MIN_GROUPS_VERSION`.**
Each agent declares a protocol version through `agent:neg`; %groups went
`~.groups^%2` at v12.1.0 to `~.groups^%3` at v12.2.0. When N and N-1 disagree,
`negotiate` blocks the pair outright — the invite picker greys the peer out and
channels render the mismatch notice — so no amount of path-and-mark
compatibility rescues it. A protocol bump must ship one release ahead of the
client that needs it, exactly like a new path. This is also why v12.1.0 is
unusable as a pinned N-1 pier and v12.2.0 is.
