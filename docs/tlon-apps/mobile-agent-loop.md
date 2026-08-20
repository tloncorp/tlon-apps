# Local Mobile Agent Loop

How an AI agent takes a Linear ticket (or inline instructions) to a validated PR on this repo, entirely on a local machine, with minimal isolation and minimal resource waste. This doc also records the build-cache architecture the loop depends on.

## Principles

-   **Shared global caches do the heavy lifting.** The pnpm store, the EAS remote build cache, and Gradle's build cache are keyed by content, shared across worktrees, and never need per-worktree cleanup. (ccache is machine-global too, but its hits only materialize within one worktree — see the measurements below.)
-   **Per-worktree state must be cleaned up when the PR merges.** The worktree itself (node_modules, Pods, ios/build), its DerivedData, its owned simulator, and its Metro process are all per-worktree. `rn-iso worktree remove` takes all of them down together.
-   **One worktree per task, one simulator per worktree.** `rn-iso` owns the sim/Metro assignment so concurrent agents never fight over devices or ports.

## Build caches (what makes the loop fast)

| Cache              | Scope              | What it saves                                           | Setup                                                                               |
| ------------------ | ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| EAS build cache    | remote, whole team | the entire native build when the fingerprint matches    | `buildCacheProvider: 'eas'` in app.config.ts (already on); must be logged in to EAS |
| ccache             | per-worktree       | C/C++/ObjC compilation on rebuilds in the same worktree | `apple.ccacheEnabled` in Podfile.properties.json + `brew install ccache`            |
| pnpm store         | machine-global     | package downloads + install work                        | default pnpm behavior                                                               |
| Gradle build cache | machine-global     | Android task outputs across builds/worktrees            | `org.gradle.caching=true` (in gradle.properties)                                    |

Run `pnpm --filter tlon-mobile doctor` to verify all of these are healthy on your machine. The big silent footgun: **if eas-cli is logged out, the build cache is skipped without any error** and every build compiles from source.

The EAS cache is symmetric: `expo run:ios` downloads a matching build when one exists, and uploads the build it just made when there was a miss. The first machine to build a new fingerprint pays the cost; everyone else (and every fresh worktree) downloads it in seconds.

The fingerprint hashes native inputs — including the installed contents of `node_modules` (autolinking config), the `ios/` and `android/` trees, and Podfile.properties.json. JS-only changes do not change it. **Trap:** the fingerprint reads `node_modules`, not package.json, so after adding a native dependency let `pnpm install` fully finish before `expo run:ios`, or the fingerprint will match a stale build that lacks your module.

The fingerprint is only useful if it is identical across checkouts. `patches/react-native@0.86.0.patch` exists for exactly this: hermes-engine.podspec resolves `hermesc` to an absolute path, which lands in the evaluated podspec and therefore in the Podfile.lock `SPEC CHECKSUMS`. Without the patch every worktree and every machine computes a different fingerprint and the EAS cache never hits across checkouts.

The patch is a backport of [facebook/react-native#56994](https://github.com/facebook/react-native/pull/56994), which ships in `0.87-stable` but not in the `0.86-stable` line we are on — **delete the patch when we upgrade to 0.87**. It carries one addition over upstream: both paths are resolved through `realpath`, so the relative traversal is also correct when the checkout is reached through a symlink. To re-verify after any react-native upgrade, run `pod install` from two different checkout paths and confirm the `hermes-engine` checksum in Podfile.lock matches.

## The loop

### 1. Intake

Read the Linear ticket (linear skill / MCP) or the inline instructions. Produce a short task brief: expected behavior, affected surface, how to validate (what to look at on the simulator, which tests).

### 2. Provision a worktree

```bash
npx rn-iso worktree create <slug> --label <slug>   # prints the worktree path on stdout
cd <worktree> && CI=true pnpm install              # 19s on a warm pnpm store
pnpm --filter ./packages/editor build              # 2s — the bundle needs editorHtml
```

`worktree create` is instant: it branches from `origin/HEAD` and carries the gitignored `.env.local` files across (declared by `.rn-iso.json` at the repo root). Installing dependencies is deliberately **your** job — rn-iso is a broker and runs no commands for you.

Prefer it over a raw `git worktree add`, which skips the carry-over and the label, leaving a worktree with no env files and an `rn-iso` shortcut that collides with its siblings (every tlon worktree's app dir is named `tlon-mobile`, hence `--label`).

### 3. Devices and Metro (rn-iso)

rn-iso is only a broker: it gives this worktree an owned simulator and a reserved Metro port, and never starts Metro or runs a build.

```bash
cd "<worktree>/apps/tlon-mobile"
npx rn-iso up ios --json     # => {"udid":…,"metroPort":…,"metroHealthy":…,"metroConflict":…}

npx expo start --port <metroPort> > /tmp/metro-<slug>.log 2>&1 &   # you start Metro
npx rn-iso device --platform ios --json                            # poll until metroHealthy
```

Start Metro **from inside the worktree** and redirect it to a predictable path: teardown identifies your Metro by checking that the process on the port answers `/status` _and_ runs from inside the project, and rn-iso no longer captures the log itself. That log is the first thing to read on a blank screen or red box.

⚠️ **`up` can reserve a port that something else already holds.** It picks the next port above the highest in rn-iso's own registry and never checks for a live listener, so on a machine running other bundlers it hands out an occupied port — deterministically, since the same number comes back every time the registry max is unchanged. rn-iso ≥ 0.9 catches the consequence: it proves Metro's identity before reporting `metroHealthy`, so a foreign bundler yields `metroHealthy: false` plus a `metroConflict` string naming the intruding pid and its directory.

**Never build while `metroConflict` is non-null** — the build CLIs attach to whatever answers on that port, so the app would load another project's bundle. Either free the port, or point this project at a free one and use that for both `expo start` and `expo run:ios`.

Requirements: `npm_config_script_shell=/bin/bash` (the repo's `.npmrc` script-shell breaks bare npx), UTF-8 locale for CocoaPods, Node 22 on PATH.

### 4. Native build

`expo run:ios` inside step 3 resolves one of two ways:

-   **Warm (fingerprint hit):** downloads the cached build and installs it. Measured end-to-end in a fresh worktree: **58s**, of which most is CocoaPods — no Xcode compile, no DerivedData.
-   **Cold (fingerprint miss):** pod install + full Xcode build, then uploads the result so the next agent/worktree is warm. Measured in a fresh worktree: **250–255s**.

Measured on this repo across three fresh worktrees, which is also the evidence that the hermes patch works: a worktree off unpatched `develop` **missed** (250s) and left `Podfile.lock` and `project.pbxproj` dirty; a patched worktree missed once (255s) and uploaded; a second patched worktree **at a different path hit the cache** (58s) and finished with a completely clean tree. Without the patch every fresh worktree pays the full build; with it, only the first one does.

ccache measurements (Xcode 26, static frameworks):

-   Rebuild in the **same worktree** after wiping Pods + DerivedData: 100% hit rate, 3m16s → 1m42s. This is the branch-switch / pod-bump case.
-   Build in a **different worktree**: 0% hit rate, even with `CCACHE_BASEDIR`. Header and build-product paths resolve into `~/Library/Developer/Xcode/DerivedData/Landscape-<per-workspace-hash>/`, which is both outside the repo root and differently named per worktree. `CCACHE_BASEDIR` only rewrites paths _underneath_ it, and rewriting cannot reconcile two different directory names, so the `-I` flags never match.

Cross-worktree hits are therefore only reachable by putting build products **inside** the worktree (Xcode "Build Location: Relative to Workspace", or `xcodebuild -derivedDataPath ./…`) so every path falls under a common `CCACHE_BASEDIR`. That is not the default here, because the EAS cache already covers the cross-worktree case in ~16s versus ccache's ~1m42s. What is left for ccache is the narrow case EAS cannot serve: a **second** native build inside a worktree that already compiled once — native iteration, a pod bump, a branch switch.

Because a fresh worktree can never hit, every cold build an agent runs writes ~3850 new objects into the shared cache without ever reading one — which **evicts** the entries that make your own main-checkout rebuilds fast. Agent worktrees should therefore build with `CCACHE_DISABLE=1` exported: it forfeits nothing (their hit rate is 0% either way) and stops them from polluting the cache. Keep ccache itself enabled — it pays off in the main checkout, where the same build-product paths recur.

Watch the ceiling: ccache grows to `max_size` (`ccache -p`), and a ceiling above free disk lets a few cold builds fill the volume. `pnpm --filter tlon-mobile doctor` warns when that is the case.

JS-only tickets stay on the warm path for their entire life: after the first install, edits hot-reload through Metro and no further native builds happen.

### 5. Implement and validate

-   Edit code; workspace packages are consumed as source, so Metro picks up changes in packages/\* without any build step.
-   Drive the app with agent-device (screenshots, recordings as PR evidence).
-   Run the gates: scoped `tsc`, lint, unit tests for touched packages.

### 6. PR

Push to a clean branch name, open a draft PR per the repo template, attach the validation recordings.

### 7. Cleanup (after the PR merges)

```bash
npx rn-iso stop <slug>/tlon-mobile        # kill this worktree's Metro
npx rn-iso worktree remove <worktree>     # removes the worktree AND deletes its owned sim
```

**Target `stop` at `<slug>/tlon-mobile`, not `<slug>`.** In this monorepo `worktree create` registers the worktree root under the label while `up` registers the app dir that actually owns the port. `stop <slug>` therefore matches the root entry, prints "No Metro port assigned", exits 0, and leaves Metro running — a success-looking no-op that strands the port.

`worktree remove` tears the environment down whole: it reclaims the Metro port and shuts down and **deletes** the simulator rn-iso created for it. It refuses if the worktree holds uncommitted changes, untracked files, or commits on no remote — push the branch first. Never pass `--force` without asking; that discards the work the refusal is protecting. Teardown verifies identity before killing anything, so a Metro it cannot prove is yours is left alone (verified: an unrelated repo's Metro on the same port survived).

DerivedData is keyed by workspace path, so a cold-built worktree leaves an orphaned `~/Library/Developer/Xcode/DerivedData/Landscape-<hash>` behind. Worktrees that stayed on the warm path never create one. `gc` sweeps those, plus dead config entries and orphaned `rn-iso-*` devices:

```bash
npx rn-iso gc                   # reports only — always safe
npx rn-iso gc --delete          # destructive: ask the user first
```

## Resource budget (one machine, N concurrent agents)

-   **Simulator:** ~1–2GB RAM each while booted (Android emulators 2–3GB). Each worktree owns a disposable `rn-iso-<label>` sim that `worktree remove` deletes outright, so nothing accumulates between tasks.
-   **Worktree disk:** `du` badly overstates it. A worktree's `node_modules` reports ~4.3GB but consumes ~**80MB** of real disk (measured): pnpm imports from its store with APFS copy-on-write clones, so the blocks are shared even though each file shows a link count of 1. Switching `nodeLinker` away from `hoisted` would not reclaim meaningful space. The real per-worktree cost is `ios/Pods` (~1.1GB) plus build products — DerivedData (~3–5GB), which only a cold-built worktree creates at all.
-   **Metro:** one node process per worktree, started by the agent on the port rn-iso reserved.

Practical ceiling: disk and RAM, not CPU — keep 2–3 concurrent loops on a laptop, release sims promptly, and let the EAS cache keep worktrees on the warm path.

## Deliberately not adopted (for now)

-   **rnrepo (prebuilt third-party libraries):** public beta. Would only help cold builds, which ccache + the EAS cache already cover. Conflicts to manage: we patch react-native-screens' Android native code (needs per-lib opt-out), and debug builds with react-native-worklets fall back to source on Expo SDK 55+, which excludes reanimated/worklets — the biggest single compile chunk. Revisit if cold builds are still painful after ccache.
-   **Building RN from source:** we don't. RN 0.85 defaults to prebuilt React Native core on iOS (`RCT_USE_PREBUILT_RNCORE=1`) and prebuilt Maven artifacts on Android.
