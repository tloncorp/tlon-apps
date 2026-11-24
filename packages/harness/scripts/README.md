# Scripts

This directory contains scripts useful for development.

## Conn thread interface

`click` and `click-format` are bash scripts that expose urbit ship conn socket interface.
`click` communicates with a running urbit ship over the socket interface and uses `click-format` is used to submit formatted commands (hoon snippets or threads). See the repository's `scripts/backend/run-tests.sh` for examples of usage.

`ship-click` runs `click` inside the container of a fake ship that `ship-lib.sh` runs, with the ship, as `~zod`, in place of its pier.

## Running tests

