# AGENTS.md — Harness

Harness runs AI agents on an Urbit ship: a Hoon desk (`desk/`, agents `%harness`,
`%harness-tlon` and `%acp`) plus an ACP stdio adapter (`acp/`) and JavaScript
tests (`tests-js/`). Its Tlon hand talks to the ship's Groups agents through
their versioned marks. Start with `README.md`; architecture, protocols and the
development guide live in `docs-refs/` (`docs-refs/development.md` for builds
and tests).

## Build and test

Run these from `packages/harness`. They need `just`, `yq`, `git`,
`rsync`, `python3` and, for fake ships, `tmux`, `socat`, `jq` and `curl`.
`just test-js`, and so `just test`, also needs `node` and `timeout`, which on
macOS comes from GNU coreutils.

- `just fetch`: the repository justfile's `fetch` copies the files listed in
  `desk-deps.yaml` into `desk-deps/`, and git checks the %mcp repository out
  into `mcp/` at the commit the root `desk-deps.yaml` pins.
- `just build`: fetch, then the repository justfile's `assemble` lays
  `desk-deps/` and `desk/` into `desk-out/`. `just heavy=true build` keeps
  `tests-integration/`.
- `node --test tests-js/distribution.test.mjs`: artifact checks on `desk-out/`.
- `just test-hoon` and `just test-js`: the native and JavaScript suites on fake
  ships, as `.github/workflows/harness-ci.yml` runs them.
- `pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:harness`: the shared bot
  E2E scenarios against Harness on Docker fake ships, as
  `.github/workflows/harness-bot-e2e.yml` runs them.

## Development loops

Desk work runs on native fake ships, on a Mac or a Linux machine:

- `just fake-dev SHIP` boots SHIP, `~zod` by default, with its pier at `zod/`
  and tmux session `fake-zod` (`<ship>/` and `fake-<ship>` for another ship),
  installs `%mcp` and `%harness` and sets Harness up. After an edit,
  `just commit zod/harness` rebuilds the desk and commits it to the running
  ship.
- During development, copy into a mount with `just install-dev DESK`, or
  `just commit DESK`, which runs it first; both keep the files already in the
  mount. The repository justfile's `install` deletes them, so run that only
  when explicitly instructed.
- `just test-hoon PATTERN` and `just test-js PATTERN` run the matching tests on
  ships they keep in `.test-run/piers/`, in sessions `fake-zod`, `fake-lux` and
  `fake-nec`. Either refuses to start while one of those sessions runs, unless
  it is given a PATTERN and the session's pier is its own, so stop a
  `just fake-dev` ship named `~zod`, `~lux` or `~nec` first, or boot
  `fake-dev` as another ship.
- On macOS, a deep checkout is too long for the test ships' sockets.

[`docs-refs/development.md`](docs-refs/development.md) has the recipes'
arguments, how to stop a ship and the socket workaround. Bot-level checks run
in Docker, as below.

## Test layers

- Hoon unit and agent tests (`desk/tests`, `desk/tests-integration`,
  `just test-hoon`): no model, one fake ship. They check the desk's own
  semantics.
- Harness conformance scripts (`tests-js/*-conformance.mjs`, `just test-js`):
  local stand-in model providers, native fake `~zod`, `~lux` and `~nec`. They
  check Harness's protocols and hands end to end.
- Shared bot E2E (`packages/tlon-bot-e2e`, Harness driver): a scripted fake
  model and Docker fake ships. It runs the shared scenarios Harness supports,
  from the suite `openclaw-ci.yml` and `hermes-ci.yml` run against OpenClaw
  and Hermes. A scenario Harness cannot run is skipped, and the run prints its
  reason.
- tlonbot E2E (`tests/` in `tloncorp/tlonbot`): a real model and Docker fake
  ships. It checks acceptance: does the bot do the right thing. In a tlonbot
  checkout, `pnpm harness:up` builds the desk from this package, found through
  `TLON_APPS_DIR`, and installs it; `pnpm test:harness` then runs the smoke
  fixtures. `pnpm nightly:local --runtime=harness` builds, installs and runs
  the full set. `pnpm workbench:harness` (the prompt workbench) runs the same
  fixtures from a browser, on drafts of `harness-prompts/`. Its
  `tests/README.md` has the options.

The first three run on every PR that touches the paths their workflow lists:
`harness-ci.yml` for the first two, `harness-bot-e2e.yml` for the third. The
tlonbot E2E runs locally.

## How agents work here

- The architect, Claude Fable, plans, writes the briefs, coordinates the
  workers and verifies what they return.
- Workers, Claude Opus, implement from a written brief and commit locally.
  Workers do not push.
- Before a branch is pushed, gpt-6.1-sol reviews it through Codex against the
  root `AGENTS.md` "Code Review Rules".
- A PR that changes the desk's behavior also changes the `docs-refs/` page
  that describes it, and adds or updates tests named for the invariant they
  enforce, as the existing ones are (`test-two-agents-cannot-claim-one-task`).
- A person decides every push, PR and merge.

## Verified

Before a PR goes up:

- The checks ran on the final commit.
- Every claim in the description was reproduced, not inferred.
- The description says what was not run.

## Dependencies

The Tlon `sur/` and `lib/` files the desk compiles against are not pinned.
The `tlon` entry of `desk-deps.yaml` lists them, and `just fetch` copies them
from the root `desk/`, so a change to one of those files there changes what
Harness compiles against.
