# Mobile agent loop

How an agent, or a person, gets this app onto a simulator in an isolated
worktree. The loop runs on [Stim](https://github.com/appandflow/stim), which
owns the Metro port, the simulator, and the build caches.

Stim's own skill documents the commands, the launch states, and which actions
need your approval. Read this file for what the skill cannot know: the parts
that are specific to this repository.

## Install once

```bash
npm install --global stim-cli     # or call it as `npx stim-cli <command>`
npx skills add appandflow/stim    # installs to ~/.agents/skills, symlinked for Claude Code
```

The skill install is per machine. To give every contributor the same guidance
instead, commit the skill into `.claude/skills/` and skip the `skills add`.

`agent-device` is a separate tool, and the loop does not need it: `stim ios`
installs, launches, and verifies the app on its own. Install it only when a
task drives the UI — tapping, typing, reading the view hierarchy.

```bash
npm install --global agent-device
npx skills add callstack/agent-device
```

## The main checkout

The default branch is `develop`, not `main`. Every branch starts there and
every pull request targets it.

A warm worktree is a copy of the main checkout, so whatever is stale there is
stale in each worktree it seeds. Refresh it before starting a task, and branch
from the fetched remote tip rather than whatever the local branch happens to
be:

```bash
git -C <main-checkout> fetch --prune
stim worktree create <name> --carry-ignored --base origin/develop
```

`doctor` reports how far behind the main checkout is, because a later rebase
can change a native input and invalidate a build done from the older base.

Leave the main checkout clean and use it to seed worktrees. Its `node_modules`
and `ios/Pods` are what `--carry-ignored` clones, so a checkout whose install
is stale hands that staleness to every worktree; run `pnpm install` there after
a pull that moves dependencies.

## Before the first worktree

Run `stim doctor` from `apps/tlon-mobile`. It inspects the **main checkout**
even when it runs from a linked worktree, because a warm worktree is a copy of
that checkout, and it prints the exact command for each finding. Fix everything
it labels `costs time` before creating one.

## The loop

```bash
cd apps/tlon-mobile
stim worktree create <name> --carry-ignored --base origin/develop
cd <printed-path>/apps/tlon-mobile           # the path the command printed

git checkout -b <your-branch>                # Stim leaves you on worktree-<name>
stim start
stim ios
stim logs --errors                            # exit code 0 is the pass condition,
                                              # and "No matching log records" on
                                              # stderr is what a pass looks like
```

`stim worktree create` puts you on a branch called `worktree-<name>`. That branch
is Stim's, not a pull request branch, and it outlives the worktree: creating a
worktree of the same name later stops with `the branch worktree-<name> already
exists`, and `git branch -D worktree-<name>` clears it. A create that fails
partway can leave the branch behind too, so delete it before retrying, or the
retry attaches to it and `--base` is ignored.

`--carry-ignored` clones every gitignored path, which is what makes the
worktree usable: `.env.local`, `node_modules`, `packages/editor/dist`, and
`ios/Pods` all come across, so there is no install step and no package to build
by hand. Without it you get a cold worktree and pay for all of them.

A JavaScript or TypeScript edit needs no rebuild. Fast Refresh applies it, and
`stim logs --since 30s --level error` shows what it broke. Run `stim ios` again
only after a native input changes.

To prove a change reached the screen, take a screenshot of the device Stim
named in its summary:

```bash
xcrun simctl io <udid> screenshot ios.png
adb -s <serial> exec-out screencap -p > android.png
```

Wait first. Stim's `ready: bundle loaded, stable for 3s` describes the process,
not the first paint: a screenshot taken the moment `stim ios` returns `OK` shows
a spinner, and this app needs roughly another minute to render its first screen.
When a label is too long for the screen, read the text rather than trusting the
picture -- `adb shell uiautomator dump` on Android, or `agent-device snapshot`
on either platform.

Finish a session with `stim stop`, which shuts the dev server and the device
down but keeps the worktree.

This repository formats with `oxfmt`, through `pnpm format` at the root. Running
prettier over a file rewrites it wholesale and buries the change.

Run `stim worktree remove` once the pull request merges. It deletes the
worktree, the branch Stim created for it when that branch has no unique
commits, and the simulator or emulator it owns -- tens of gigabytes that
otherwise sit there until someone notices. Ask the user first, and never reach
for `--force`, which also discards uncommitted and untracked files.

## Android

The app builds two product flavors, `production` (`io.tlon.groups`) and
`preview` (`io.tlon.groups.preview`), so `assembleDebug` leaves two APKs and
nothing says which to install. Stim refuses rather than guess, and its refusals
carry the command that clears them. Name the variant the repo's own
`pnpm android` uses, on every call:

```bash
stim android --variant productionDebug
```

Two worktrees on the same commit have the same native fingerprint, so the second
one to ask does not compile: it waits for the first and installs that artifact.
Expect `waited 6m51s for .../looptest1's build -> installed from cache` on an
Android build that looks stuck. It is the cache working, not a hang.

## Driving the UI

`stim ios` and `stim android` install, launch and verify the app, so the loop
needs no device tool. A task that taps, types or reads the view hierarchy uses
`agent-device`, which picks a booted device on its own. This repository usually
has both an iOS simulator and an Android emulator booted, so name the target
and keep it in its own session, or the commands land on the wrong platform:

```bash
agent-device snapshot --platform android --device stim-<label>-tlon-mobile --session <name>
agent-device click @e12 --session <name>
```

A session stays bound to the device it first selected. `agent-device close
--session <name>` releases it.

## Signing in

Some flows need a signed-in app, and the phone or email paths send a 2FA code
that an unattended run cannot read. Sign in to a test ship instead. Put its URL
and access code in `apps/tlon-mobile/.env.local`:

```bash
DEFAULT_SHIP_LOGIN_URL=https://your-ship.tlon.network
DEFAULT_SHIP_LOGIN_ACCESS_CODE=<the ship's +code>
```

A dev build then opens "Have an account? Log in" -> "Or configure self hosted"
with both fields filled and `Connect` already enabled, so the sign-in is one
press. Both gates are dev-only: `__DEV__`, and both variables non-empty.

A `+code` sign-in produces an `authType: 'self'` session. It gets an agent into
the app; it does not exercise the hosting-account flows such as node status,
revival, or bot config.
