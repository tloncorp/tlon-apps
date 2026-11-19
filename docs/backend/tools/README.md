# Backend developer tools

The following tools are available to aid development on Urbit:

- `scripts/backend/run-tests.sh` — run the backend unit and Aqua test suites on a fake `~zod` in a container. It needs a container runtime, `just`, `yq`, `rsync` and `python3`.
- `scripts/backend/update-pill.sh` — generate a pill containing specified `%base` and `%groups` desks.
- `scripts/backend/gen-moon.sh` — generate a moon.
- `just build` — assemble a complete `%groups` desk into `desk-out/` by layering `desk-deps/` and `desk/`.
- `just install <pier>/groups` — build, then replace a mounted `%groups` desk with the result.
- `just install-dev <pier>/groups` — build, then copy the result into a mounted `%groups` desk, keeping the files there that the build did not produce.

## Fake ship image

`scripts/backend/container/` builds the image `fakeship:<N>`, where the number
N stands for the checkout, so that checkouts with different pills can run at
once. It is the image that
`scripts/backend/run-tests.sh` and the Harness test and development ships
(`packages/harness`) run. It holds bash and socat, which `click` needs, the
vere binary pinned by `ARG VERE_VERSION` (`v4.6`) and the boot pill pinned by
`ARG PILL` (`groups-5a187fe-a93c6c1`: base 408k-2 with groups v12.5.0), both
from `bootstrap.urbit.org`. Its entrypoint runs one ship, named as its argument,
as the container's main process, with its pier at `/piers/<ship>`: it resumes
an existing pier and otherwise boots the ship from the pill.

The scripts use podman when it is usable and docker otherwise;
`CONTAINER_RUNTIME` overrides the choice (`scripts/backend/container/runtime.sh`).

The containers read the checkout through a bind mount. A host that enforces
SELinux denies that, and the first copy of a desk fails with "Permission
denied". Turning labelling off for podman's containers avoids it, in
`~/.config/containers/containers.conf`:

```toml
[containers]
label = false
```

The scripts rebuild the image each run, so a change to either `ARG` default in
the `Dockerfile` takes effect on the next one, and they remove the image the
change replaced. A checkout's image stays until it is removed, with
`just distclean` in `packages/harness` or the runtime's `rmi`.
`update-pill.sh BASE-REF GROUPS-REF` builds a pill named
`groups-<base>-<groups>` from the short hashes of those commits, adding
`/mar/spider/start.hoon` (`spider-start.patch`) and the Aqua patch
(`aqua.patch`) to `%base`; `-u` uploads it to `bootstrap.urbit.org` with
`gcloud`, where `ARG PILL` can then name it.

## Validating repository Hoon on a running ship

Use the complete assembled desk whenever repository changes are tested on a
running ship. If the ship's pier is at `<pier>`, synchronize the Unix mount with:

```sh
just install-dev <pier>/groups
```

The recipe fetches the pinned dependencies, layers repository sources over
them, stamps `commit.txt`, and copies the result into the mount. Files there
that the build did not produce are kept, including ones the repository has
since removed. `just install <pier>/groups` deletes those instead, replacing
the mount with the result; run it only when that cleanup is intended. Point
either only at the intended `%groups` Unix mount.

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
