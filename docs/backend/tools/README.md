# Backend developer tools

The following tools are available to aid development on Urbit:

- `backend/run-tests.sh` — run the backend unit and Aqua test suites.
- `backend/update-pill.sh` — generate a pill containing specified `%base` and `%groups` desks.
- `backend/gen-moon.sh` — generate a moon.
- `scripts/assemble-desk.sh <target-dir>` — assemble a complete `%groups` desk by layering `desk-deps/` and `desk/` into the target.

## Validating repository Hoon on a running ship

Use the complete assembled desk whenever repository changes are tested on a
running ship. If the ship's pier is at `<pier>`, synchronize the Unix mount with:

```sh
./scripts/assemble-desk.sh <pier>/groups
```

The script synchronizes vendored dependencies, clears stale files from the
target, overlays repository sources, and stamps `commit.txt`. Point it only at
the intended `%groups` Unix mount.

Without switching to the ship's tmux session, send:

```text
|commit %groups
```

Wait for any `sync` spinner to finish and inspect the captured output. A
successful desk commit is required before a backend change is considered
validated.

A desk commit only builds files reachable from live dependencies. New files and
files not yet imported by an app or mark therefore require an explicit manual
build. For each such changed Hoon file, run `-build-file` against its mounted
path, for example:

```text
=aut -build-file /=groups=/sur/steward/automation/hoon
```

Use a distinct Dojo face when building more than one file. Confirm that each
command returns a value without a build error. Compiling an equivalent inline
expression does not validate the repository file and is not a substitute for
this step.
