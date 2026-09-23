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
latest `vX.Y.Z` release tag: the tag is cut by hand on the release commit and
dispatched to livenet, so it names what users run. `origin/master`'s tip is not
that — the same branch also carries the plugin release, which sometimes
leapfrogs the desk and leaves master ahead of the last deployed desk.

**(d) Negotiation protocols are a hard floor beneath `MIN_GROUPS_VERSION`.**
Each agent declares a protocol version through `agent:neg`; %groups went
`~.groups^%2` at v12.1.0 to `~.groups^%3` at v12.2.0. When N and N-1 disagree,
`negotiate` blocks the pair outright — the invite picker greys the peer out and
channels render the mismatch notice — so no amount of path-and-mark
compatibility rescues it. A protocol bump must ship one release ahead of the
client that needs it, exactly like a new path. This is also why v12.1.0 is
unusable as a pinned N-1 pier and v12.2.0 is.

## The pinned N-1 pier

The pier is the only part of this policy that runs real code against a real N-1
desk. `~bud` is a fifth E2E ship carrying the **N-1 desk**: a hand-built
fakeship pinned to `MIN_GROUPS_VERSION`, recorded as `deskVersion` in
`apps/tlon-web/e2e/shipManifest.json`. `.github/workflows/n1-e2e.yml` boots it
next to `~zod` and `~ten` on the candidate desk and runs
`apps/tlon-web/e2e/n1-desk.spec.ts`: group create, invite and join across the
version boundary, then chat posts, threads, reactions, edits, deletes, mentions
and quote replies each way; notebook and gallery channels with a post and a
comment each way; group administration by the host and by the N-1 member; DMs
each way; and the N-1 ship's activity feed. The spec's own header maps every
step to the agents and request families it exercises.

`~bud` is not `~bus`. `~bus` is deliberately far out of date, for
protocol-mismatch rendering, and is never re-pinned.

Three things keep the pier honest:

- It is `skipCommit: true`, so rube never builds a desk on it. Everything on it
  came from `rube/build-n1-pier.sh`.
- The job refuses to run when `deskVersion` and `MIN_GROUPS_VERSION` disagree,
  because every scenario would then be measuring the wrong boundary.
- The spec reads each ship's reported `%groups` version at runtime and asserts
  they differ. The manifest's label cannot prove the job crossed a boundary;
  the ships can.

A negotiation protocol bump strands the pier (rule (d)), and nothing predicts
that ahead of the run: the pair cannot negotiate, the scenarios fail where they
try, and the job reports it like any other failure.

It runs on pushes to `staging` and on `workflow_dispatch`, never on a PR: it
needs a pier that only exists once a release has shipped, and the four-shard PR
suite keeps its runtime. `~bud` is marked `n1` in the manifest, which means
`N1_SHIP=bud` is the *only* thing that selects it —
`INCLUDE_OPTIONAL_SHIPS=true` deliberately does not, because the archive
preparation run and the parallel Docker image both set that flag and neither
carries the N-1 pier.

**Rebuilding it** is part of raising `MIN_GROUPS_VERSION`
(`docs/release-checklist.md`): set the new `deskVersion` and the next
`rube-bud<n>.tgz` in the manifest, run `apps/tlon-web/rube/build-n1-pier.sh`,
upload the archive it leaves in `rube/dist/`, then dispatch `n1-e2e.yml`.
