# Scripts

This directory contains scripts useful for development.

## Conn thread interface

`click` and `click-format` are bash scripts that expose urbit ship conn socket interface.
`click` communicates with a running urbit ship over the socket interface and uses `click-format` is used to submit formatted commands (hoon snippets or threads). See `run-tests.sh` script for examples of usage.

## Running tests

