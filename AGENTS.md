# AGENTS.md

# Tlon Messenger frontend
The TypeScript/React client is documented in `CLAUDE.md` at the repo root.

Before reasoning about local database reads, caching, or whether a component
sees fresh data, read `docs/tlon-apps/db-react-query.md`. React Query here runs
with a global `staleTime: Infinity` and refreshes only through explicit
table-dependency invalidation, so its cache behavior does not match React Query
defaults and should not be inferred from memory.

## Reviewing the desk requests comment

A PR touching `packages/api` or `packages/shared` gets one sticky comment headed
"Desk requests", from `pnpm check:desk-requests <merge-base> --markdown`. It is
an inventory diff: the scries, subscriptions, pokes and threads this branch
**adds, changes or drops**, grouped by kind and agent, each with its call sites.
It reads no desk, decides nothing, and never fails CI. The review is the check.

For every **added** and **changed** entry, confirm the N-1 desk serves it. N-1
is the tag `v<MIN_GROUPS_VERSION>` from
`packages/shared/src/logic/deskPolicy.ts` (policy:
`docs/tlon-apps/desk-compatibility.md`). Read that tag's
`desk/app/<agent>.hoon`:

- **The arm exists.** A scry needs a `++peek` pole under the right care, a
  subscription a `++watch` pole, a poke an arm for that mark in `++poke` — and
  the desk needs a `mar/` file for the mark.
- **Version injection is accounted for.** An agent rewrites an unversioned pole
  to its oldest version before matching — `%channels`' `peek` and `watch`
  prepend `%v0` — so `/channels` and `/v0/channels` are one request there,
  while `/v3/channels` is another. Match the pole the agent actually sees.
- **`agent:neg` matches.** Each agent declares a protocol version, and when N
  and N-1 disagree `negotiate` blocks the pair outright, which no path-or-mark
  compatibility rescues. %groups went `~.groups^%2` at v12.1.0 to `~.groups^%3`
  at v12.2.0.

Then say so in the review:

- Flag every entry you **cannot confirm** — an arm you could not find, a pole
  swallowed by a mold you did not resolve, an entry the report itself marks
  `unresolved`. "Could not confirm" is a finding, not a pass.
- Flag every entry that works **only on the current desk**, unless each of its
  call sites sits behind a capability guard whose other branch N-1 does serve.
  Otherwise it waits for that desk to become N-1 (rule (b)).

A **removed** entry is not a compatibility problem for this client; it bears
only on desk removal (rule (c)).

# Tlon Messenger backend
The backend of the Tlon Messenger app is hosted on the Urbit platform.

All the backend code is located in the desk/ directory, which
is deployed to an urbit ship.

## Development
Interface with a running urbit ship through a tmux session
running an urbit ship. Do not switch to that session, but interface
with it using tmux input and capture commands.
A typical command to verify connection is working is `%`, which will
display current identity, desk and time.

## Backend documentation
Comprehensive backend documentation can be found in `/docs/backend`.
For system components, the directory structure mirrors that of a desk
and is located under `/docs/backend/desk`.
The documentation on the groups agent would thus be found at
`/docs/backend/desk/app/groups.md`.

Always be sure to read documentation before answering any queries
relevant to the backend or to backend tests.

## Backend tests
There are two kinds of backend tests in groups. The first kind uses the
`/lib/test-agent.hoon` library, which provides a monadic framework for
implementing gall agent tests. It works by simulating rudimentary gall
functionality, which allows testing of the agent core (which is a pure function of
agent state) under the variety of circumstances.

test-agent tests are located in `/tests` directory, under the
corresponding desk entry. For example, tests for `/app/groups.hoon`
agent would be located at `/tests/app/groups.hoon`.

The second kind of tests uses aqua-based ship virtualization.
Using aqua, a virtual fleet of ships can be run directly on a 
ship with little resource cost. While these ships are not
fully-featured and do not support every urbit runtime event, they
nonetheless allow testing of gall agents running on virtualized ship.

Aqua tests are located in `/tests/ph` in the desk directory.

For details on how to work with aqua tests see documentation in
`/docs/backend/aqua`.
