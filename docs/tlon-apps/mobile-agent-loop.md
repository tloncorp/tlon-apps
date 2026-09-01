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

## Before the first worktree

Run `stim doctor` from `apps/tlon-mobile`. It inspects the **main checkout**
even when it runs from a linked worktree, because a warm worktree is a copy of
that checkout, and it prints the exact command for each finding. Fix everything
it labels `costs time` before creating one.

## The loop

```bash
cd apps/tlon-mobile
stim worktree create <name> --carry-ignored   # prints the new absolute path
cd <printed-path>/apps/tlon-mobile

stim start
stim ios
stim logs --errors                            # exit code 0 is the pass condition
```

`--carry-ignored` clones every gitignored path, which is what makes the
worktree usable: `.env.local`, `node_modules`, `packages/editor/dist`, and
`ios/Pods` all come across, so there is no install step and no package to build
by hand. Without it you get a cold worktree and pay for all of them.

A JavaScript or TypeScript edit needs no rebuild. Fast Refresh applies it, and
`stim logs --since 30s --level error` shows what it broke. Run `stim ios` again
only after a native input changes.

Finish with `stim stop`. Ask before `stim worktree remove`: it deletes the
worktree and its simulator.

## Android

`ANDROID_HOME` must be exported (`stim doctor` checks it):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

The app builds two product flavors, `production` (`io.tlon.groups`) and
`preview` (`io.tlon.groups.preview`), so `assembleDebug` leaves two APKs and
nothing says which to install. Stim refuses rather than guess. Name the variant
the repo's own `pnpm android` uses:

```bash
stim android --variant productionDebug
```

Pass it on every `stim android` call.

After a run with the wrong variant, gradle reports `BUILD SUCCESSFUL` while
leaving the APK from the earlier run in place, and Stim refuses to install an
artifact the build did not produce. Clear the output directory and build again:

```bash
rm -rf apps/tlon-mobile/android/app/build/outputs/apk
```

A phone plugged into the machine is a second adb target, and a bare `adb`
command fails or, worse, reaches the phone. Name the emulator for every adb
call in a loop that also has hardware attached:

```bash
export ANDROID_SERIAL=emulator-5556   # `stim android` prints the serial it used
```

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

`app.config.ts` copies these variables into `extra` for any build, so keep a
real access code out of release builds.

A `+code` sign-in produces an `authType: 'self'` session. It gets an agent into
the app; it does not exercise the hosting-account flows such as node status,
revival, or bot config.

## Repository facts worth knowing

- **Node comes from `.nvmrc`** (22.22.0). Other versions fail to build
  `better-sqlite3`.
- **pnpm runs scripts through `${TLON_SHELL-/bin/bash}`** (`pnpm-workspace.yaml`),
  so several scripts need `bash`. On Windows, point `TLON_SHELL` at Git bash.
- **This app configures no build cache of its own.** Stim keys its cache on the
  native fingerprint, shares artifacts across worktrees, appends its own Metro
  store, and ignores the paths a native build never reads, so there is no
  `buildCacheProvider`, no shared Metro store and no `.fingerprintignore` here.
  `stim doctor` reports what it applies.
- **`tailwind.json` and `tailwind.css`** in `apps/tlon-mobile` are stale
  leftovers. Nothing in the app reads them, and a worktree without them builds.
- **Expo modules ship as prebuilt Android artifacts.** `./gradlew projects`
  marks them `[📦]`. Editing or patching the Kotlin under
  `node_modules/expo-*/android` changes nothing, and the build stays green, so
  the edit looks applied until you unzip the APK and find it absent. To change
  one, name it in `expo.autolinking.buildFromSource` in
  `apps/tlon-mobile/package.json` first, which makes gradle compile that module
  from source.

## What the loop costs

Measured on an M-series MBP with Xcode 26.5, in a warm worktree branched from
`develop`:

| Step | Time |
| --- | --- |
| `stim worktree create --carry-ignored` | seconds (APFS copy-on-write clone, 59 paths) |
| `stim start` | 3s |
| `stim ios`, native build required | 5m16s, with 81% compilation-cache hits |
| `stim ios`, native inputs unchanged | 9s, from the build cache |
| `stim android`, cold gradle build | 4m15s to compile, then install and launch |

The compilation cache is shared across worktrees, which is why a first build in
a brand-new worktree still reused most of its objects.
