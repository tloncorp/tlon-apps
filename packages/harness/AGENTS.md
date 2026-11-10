# AGENTS.md — Harness

Harness runs AI agents on an Urbit ship: a Hoon desk (`desk/`, agents `%harness`,
`%harness-tlon` and `%acp`) plus an ACP stdio adapter (`acp/`) and JavaScript
tests (`tests-js/`). Its Tlon hand talks to the ship's Groups agents through
their versioned marks. Start with `README.md`; architecture, protocols and the
development guide live in `docs-refs/` (`docs-refs/development.md` for builds
and tests).

## Build and test

Run these from `packages/harness`. They need `just`, `peru`, `rsync` and, for
fake ships, `tmux`, `socat`, `jq`, `curl` and mikefarah `yq` (for `mcp/`'s own
build).

- `just fetch`: `peru sync` from the root `peru.yaml`, which vendors the %base
  files into `desk-deps/` and the %mcp repository into `mcp/`.
- `just build`: assemble `desk-out/` with `../../scripts/assemble-desk.sh
  <dir> harness`. `just heavy=true build` keeps `tests-integration/`.
- `node --test tests-js/distribution.test.mjs`: artifact checks on `desk-out/`.
- `just test-hoon` and `just test-js`: the native and JavaScript suites on fake
  ships, as `.github/workflows/harness-ci.yml` runs them.

## Dependencies

The Tlon `sur/` and `lib/` files the desk compiles against are not vendored.
`tlon-files.txt` lists them, and assembly copies them from the root `desk/`, so
a change to one of those files there changes what Harness compiles against.
