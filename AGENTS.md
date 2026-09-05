# AGENTS.md

# Tlon Messenger frontend
The TypeScript/React client is documented in `CLAUDE.md` at the repo root.

Before reasoning about local database reads, caching, or whether a component
sees fresh data, read `docs/tlon-apps/db-react-query.md`. React Query here runs
with a global `staleTime: Infinity` and refreshes only through explicit
table-dependency invalidation, so its cache behavior does not match React Query
defaults and should not be inferred from memory.

# Tlon Messenger backend
The backend of the Tlon Messenger app is hosted on the Urbit platform.

All the backend code is located in the desk/ directory, which
is deployed to an urbit ship.

## Development with tmux

When explicitly instructed to interface with running ships with tmux, follow
the instructions in this section. If the user uses urbit MCP, use
dedicated workflows and documentation specific to urbit MCP.

Interface with a running urbit ship through a tmux session
running an urbit ship. Do not switch to that session, but interface
with it using tmux input and capture commands.
A typical command to verify connection is working is `%`, which will
display current identity, desk and time.

### Required backend validation

Before treating a backend change as compiled or complete:

1. Assemble the repository desk into the running ship's `%groups` Unix mount
   with `scripts/assemble-desk.sh <pier>/groups`. Do not validate against a
   hand-copied subset of `desk/`.
2. Send `|commit %groups` through the ship's tmux pane, wait for any `sync`
   spinner to finish, and verify that the commit succeeds without build errors.
3. Run `-build-file` explicitly for every changed or newly added Hoon file that
   might not yet be reachable from a live app or mark dependency. Use the
   mounted desk path, for example
   `=aut -build-file /=groups=/sur/steward/automation/hoon`.

An equivalent expression entered directly in Dojo is not a substitute for
building the assembled repository file. Report the `|commit` and `-build-file`
results when claiming validation.

## Backend documentation
Comprehensive backend documentation can be found in `/docs/backend`.
For system components, the directory structure mirrors that of a desk
and is located under `/docs/backend/desk`.
The documentation on the groups agent would thus be found at
`/docs/backend/desk/app/groups.md`.

Always be sure to read documentation before answering any queries
relevant to the backend or to backend tests.

## Backend developer tools
Tools useful for development are located under `/backend` directory.
Documentation can be found in `/docs/backend/tools`.

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

## Git workflow

For backend changes, strictly adhere to Linux Kernel commit commenting style of
`subsystem: imperative summary`.

When implementing an OpenSpec change:

- Ensure all relevant spec files have been committed.
- Commit each completed task separately after validation.
- Include the implementation and its task-checkbox update in the same commit.
- Use Linux kernel-style subjects, usually `subsystem: imperative summary`.
- Do not include unrelated working-tree changes.
- Do not mark or commit a task until its required validation passes.
