# AGENTS.md — Harness

Harness runs AI agents on an Urbit ship: a Hoon desk (`desk/`, agents `%harness`,
`%harness-tlon` and `%acp`) plus an ACP stdio adapter (`acp/`) and JavaScript
tests (`tests-js/`). Its Tlon hand talks to the ship's Groups agents through
their versioned marks. Start with `README.md`; architecture, protocols and the
development guide live in `docs-refs/` (`docs-refs/development.md` for builds
and tests).

## Build and test

Run these from `packages/harness`. They need `just`, `yq`, `git`,
`rsync` and, for fake ships, `tmux`, `socat`, `jq` and `curl`.

- `just fetch`: the repository justfile's `fetch` copies the files listed in
  `desk-deps.yaml` into `desk-deps/`, and git checks the %mcp repository out
  into `mcp/` at the commit the root `desk-deps.yaml` pins.
- `just build`: fetch, then the repository justfile's `assemble` lays
  `desk-deps/` and `desk/` into `desk-out/`. `just heavy=true build` keeps
  `tests-integration/`.
- `node --test tests-js/distribution.test.mjs`: artifact checks on `desk-out/`.
- `just test-hoon` and `just test-js`: the native and JavaScript suites on fake
  ships, as `.github/workflows/harness-ci.yml` runs them.

## Dependencies

The Tlon `sur/` and `lib/` files the desk compiles against are not pinned.
The `tlon` entry of `desk-deps.yaml` lists them, and `just fetch` copies them
from the root `desk/`, so a change to one of those files there changes what
Harness compiles against.
