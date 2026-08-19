# Local Mobile Agent Loop

How an AI agent takes a Linear ticket (or inline instructions) to a validated PR on this repo, entirely on a local machine, with minimal isolation and minimal resource waste. This doc also records the build-cache architecture the loop depends on.

## Principles

-   **Shared global caches do the heavy lifting.** The pnpm store, the EAS remote build cache, and Gradle's build cache are keyed by content, shared across worktrees, and never need per-worktree cleanup. (ccache is machine-global too, but its hits only materialize within one worktree — see the measurements below.)
-   **Per-worktree state must be cleaned up when the PR merges.** The worktree itself (node_modules, Pods, ios/build), its DerivedData, its simulator claim, and its Metro process are all per-worktree.
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

## The loop

### 1. Intake

Read the Linear ticket (linear skill / MCP) or the inline instructions. Produce a short task brief: expected behavior, affected surface, how to validate (what to look at on the simulator, which tests).

### 2. Provision a worktree

```bash
git -C "$MAIN" fetch origin develop
git -C "$MAIN" worktree add "$MAIN/.claude/worktrees/<slug>" -b <branch> origin/develop
cp "$MAIN/apps/tlon-mobile/.env.local" "$WT/apps/tlon-mobile/.env.local"
cp "$MAIN/apps/tlon-web/.env.local"    "$WT/apps/tlon-web/.env.local"
cd "$WT" && CI=true pnpm install
pnpm --filter @tloncorp/editor build
```

Measured on a warm pnpm store: install ≈ 20–60s, editor build ≈ 2s.

### 3. Devices and Metro (rn-iso)

```bash
cd "$WT/apps/tlon-mobile"
npx rn-iso ios --auto --managed-metro --label <slug>
```

This allocates a dedicated simulator and a detached Metro on a per-project port, then runs the native build. Requirements: `npm_config_script_shell=/bin/bash` (the repo's `.npmrc` script-shell breaks bare npx), UTF-8 locale for CocoaPods, Node 22 on PATH.

### 4. Native build

`expo run:ios` inside step 3 resolves one of two ways:

-   **Warm (fingerprint hit):** downloads the cached build and installs it. Measured: ~16 seconds, no CocoaPods, no Xcode, no DerivedData on disk.
-   **Cold (fingerprint miss):** pod install + full Xcode build, then uploads the result so the next agent/worktree is warm. Measured: ~3m15s from wiped Pods + DerivedData (M-series laptop; RN core is prebuilt, so only third-party pods compile).

ccache measurements (Xcode 26, static frameworks):

-   Rebuild in the **same worktree** after wiping Pods + DerivedData: 100% hit rate, 3m16s → 1m42s. This is the branch-switch / pod-bump case.
-   Build in a **different worktree**: 0% hit rate, even with `CCACHE_BASEDIR`. Compile commands reference headers inside DerivedData (static frameworks put pod headers there), and the DerivedData path embeds a per-workspace hash, so the manifests never match across worktrees. The EAS cache is what covers the cross-worktree case.

JS-only tickets stay on the warm path for their entire life: after the first install, edits hot-reload through Metro and no further native builds happen.

### 5. Implement and validate

-   Edit code; workspace packages are consumed as source, so Metro picks up changes in packages/\* without any build step.
-   Drive the app with agent-device (screenshots, recordings as PR evidence).
-   Run the gates: scoped `tsc`, lint, unit tests for touched packages.

### 6. PR

Push to a clean branch name, open a draft PR per the repo template, attach the validation recordings.

### 7. Cleanup (after the PR merges)

```bash
npx rn-iso stop <slug>          # kill the worktree's Metro
npx rn-iso release <slug>       # free the simulator claim
git -C "$MAIN" worktree remove "$MAIN/.claude/worktrees/<slug>"
git -C "$MAIN" branch -D <branch>
npx rn-iso prune                # sweep assignments for deleted worktrees
```

DerivedData is keyed by workspace path, so a cold-built worktree leaves an orphaned `~/Library/Developer/Xcode/DerivedData/Landscape-<hash>` behind. Worktrees that stayed on the warm path never create one. Periodically clear stale entries (the doctor warns when disk is low):

```bash
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name 'Landscape-*' -mtime +14 -exec rm -rf {} +
```

## Resource budget (one machine, N concurrent agents)

-   **Simulator:** ~1–2GB RAM each while booted. `rn-iso release` frees the claim; leave the sim booted only while its loop is active.
-   **Worktree disk:** node_modules is hardlinked from the pnpm store (cheap); Pods + ios/build only exist after a cold build; DerivedData (~3–5GB) only after a cold build. Warm-path worktrees cost very little.
-   **Metro:** one node process per worktree, on its own port, managed by rn-iso.

Practical ceiling: disk and RAM, not CPU — keep 2–3 concurrent loops on a laptop, release sims promptly, and let the EAS cache keep worktrees on the warm path.

## Deliberately not adopted (for now)

-   **rnrepo (prebuilt third-party libraries):** public beta. Would only help cold builds, which ccache + the EAS cache already cover. Conflicts to manage: we patch react-native-screens' Android native code (needs per-lib opt-out), and debug builds with react-native-worklets fall back to source on Expo SDK 55+, which excludes reanimated/worklets — the biggest single compile chunk. Revisit if cold builds are still painful after ccache.
-   **Building RN from source:** we don't. RN 0.85 defaults to prebuilt React Native core on iOS (`RCT_USE_PREBUILT_RNCORE=1`) and prebuilt Maven artifacts on Android.
