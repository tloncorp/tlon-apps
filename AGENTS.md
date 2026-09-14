# AGENTS.md

# Tlon Messenger frontend
The TypeScript/React client is documented in `CLAUDE.md` at the repo root.

Before reasoning about local database reads, caching, or whether a component
sees fresh data, read `docs/tlon-apps/db-react-query.md`. React Query here runs
with a global `staleTime: Infinity` and refreshes only through explicit
table-dependency invalidation, so its cache behavior does not match React Query
defaults and should not be inferred from memory.

## Reviewing the desk-compatibility report

Every PR gets one sticky comment headed "Desk compatibility", from
`pnpm check:desk-compat` (policy: `docs/tlon-apps/desk-compatibility.md`). It
answers one question: can this client still start, sync, receive updates and
post against the **previous** %groups desk release?

Read it as a worklist, not a verdict. Only `MISSING` fails CI; the three
sections that do not fail are exactly the ones that need a human:

- **`GUARDED`** — the desk cannot take this request, and the client only sends
  it behind a capability guard. The checker does **not** verify the guard is
  correct or that the other branch is served. Check that the guard resolves
  false on N-1, and that the branch it falls back to is one N-1 has an arm for.
- **`WILDCARD`** — an arm matched only by swallowing the tail with `*` or by
  consuming a named mold the reader could not resolve. Open the arm the report
  links and confirm it really takes this pole.
- **`UNVERIFIED`** — the checker could not decide, and says why on each entry.
  Decide it by hand against N-1's arms, or say why it does not matter.

**`MATCHED` is the weakest word in the report.** It means an agent has an arm
whose *pattern* accepts the pole, or that a mar file exists. It does not mean
the request is served: arm bodies are never read, response shapes are never
checked, and a mar file is desk-global rather than per-agent. Do not treat a
report of all-`MATCHED` as evidence a feature works against N-1.

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
