# Build perf for agentic loops & dev iteration

Research notes on reducing the time-to-running-app for `apps/tlon-mobile` (Expo SDK 54, RN 0.81.5) — primarily to enable overnight autonomous agent loops (worktree → install → build → run → measure → repeat), with secondary benefits to normal developer iteration and CI.

## Goal

Minimize wall-clock per iteration in a loop like:

```
once per session:
  - boot a named simulator and leave it
  - long-lived Metro instance with shared cache

per iteration:
  1. git worktree add ../wt-<id>
  2. pnpm install --prefer-offline
  3. fingerprint = hash(project)
  4. if cached binary for $fingerprint exists:
       install cached .app/.apk on the booted sim
     else:
       full native build → install → cache artifact under $fingerprint
  5. point Metro at this worktree
  6. launch app, run measurement, collect logs
  7. (optional) git worktree remove
```

The core mechanism is "**compute a fingerprint of project state, look up a cached binary by that hash, skip the native build if hit**". Everything else is incremental wins on top.

## Loop phases & estimated time

| Phase | Cold (fresh worktree) | Warm (re-run same worktree) | With cache infra below |
|---|---|---|---|
| `git worktree add` | <5s | — | <5s |
| `pnpm install` | 30s–2min | 10–30s | 10–30s |
| `pnpm run build:packages` | 30–60s | 10–20s (TS incremental) | 5–10s (skipped, source imports) |
| `pod install` (iOS) | 60–120s | 10–20s | 0s (binary cached) |
| `xcodebuild` Debug → sim | **5–15 min** | 1–3 min | 0s (binary cached) |
| `gradle assembleDebug` | **4–10 min** | 30s–2min | 0s (binary cached) |
| Install + boot on sim | 10–20s | 5–10s | 5–10s |
| Metro start + first bundle | 30–90s | 5–15s | 5–15s (cache hit) |
| **Total** | **~15–25 min** | **~2–5 min** | **~30–60s** |

The win is concentrated in the native build: 70–90% of cold-loop time.

## Concrete CI numbers (last 50 EAS builds, May 2026)

CI delegates the actual native build to **EAS Build** (Expo's cloud) — GitHub Actions just calls `eas build`. Per-build durations from EAS:

| Profile | Platform | N | avg | min | max | queue avg |
|---|---|---|---|---|---|---|
| `local-testing` (E2E push-to-develop) | iOS sim | 14 | **18.9 min** | 17.3 | 28.6 | 53s |
| `local-testing` (E2E push-to-develop) | Android | 14 | **18.4 min** | 17.4 | 20.1 | 48s |
| `e2e` (nightly cron) | iOS sim | 10 | **17.1 min** | 16.4 | 18.4 | 36s |
| `production` (released) | iOS | 6 | **16.9 min** | 15.8 | 19.0 | 50s |
| `production` (released) | Android | 6 | **16.1 min** | 15.3 | 16.9 | 38s |

A push to `develop` triggers a ~37-min combined CI build (iOS sim + Android APK run in parallel on EAS at ~18 min each), with Maestro tests stacked on top.

### The killer stat: 70% of CI compute is redundant

EAS already computes a fingerprint per build (visible in `eas build:list --json`). Counting how often the *same* fingerprint is rebuilt across the last 50 runs:

```
Android local-testing  →  14 builds,  2 unique fingerprints  (13/14 = 93% cache-hittable)
iOS     local-testing  →  14 builds,  3 unique fingerprints  (11/14 = 79% cache-hittable)
Android production     →   6 builds,  1 unique fingerprint   (5/6  = 83%)
iOS     production     →   6 builds,  1 unique fingerprint   (5/6  = 83%)
iOS     e2e nightly    →  10 builds,  8 unique fingerprints  (2/10 = 20%)
```

**Total across 50 builds: 891 build-minutes of compute, ~620 min (70%) was rebuilding an identical native fingerprint.** Roughly 10 EAS-build-hours per ~3-week window, wasted.

The Android local-testing 93% number is the most striking — 13/14 push-to-develop runs on Android had the exact same native binary; only the JS bundle changed.

The iOS e2e nightly run is the exception (20% repetition): each daily run sees whatever native changes landed that day.

## Current-state audit (`apps/tlon-mobile`)

What's already in place:
- TS uses `composite: true` + `incremental` + project references → fast re-typecheck.
- Metro uses `unstable_enablePackageExports: true` + `unstable_conditionNames: ['tlon-source', 'source', 'require']` so workspace packages resolve to `src/` directly — no separate build step needed for `@tloncorp/shared`, `@tloncorp/api`.
- New arch + Hermes enabled (`apps/tlon-mobile/ios/Podfile.properties.json`, `android/gradle.properties`).
- Android `dependencyLocking` is on → reproducibility, important precondition for caching.

Gaps that affect build perf:
- **`apple.ccacheEnabled` is NOT enabled.** [apps/tlon-mobile/ios/Podfile:118](../apps/tlon-mobile/ios/Podfile#L118) wires the flag through, but [apps/tlon-mobile/ios/Podfile.properties.json](../apps/tlon-mobile/ios/Podfile.properties.json) doesn't set it. Flipping it on typically cuts incremental Pod compile by 30–60% once warm.
- **Gradle parallel + build cache + configuration cache all OFF.** [android/gradle.properties:18](../apps/tlon-mobile/android/gradle.properties#L18) has `org.gradle.parallel=true` commented; no `org.gradle.caching`, no `org.gradle.configuration-cache`, no `org.gradle.workers.max`. Easy 20–40% wins.
- **No fingerprinting / build cache.** `@expo/fingerprint` is not installed, no `buildCacheProvider` configured anywhere — every `expo run:ios|android` and every `eas build` rebuilds the native binary regardless of whether anything native changed.
- **No `.watchmanconfig`** at root or in `apps/tlon-mobile`. Watchman crawls the entire monorepo on cold start; an `ignore_dirs` list for `node_modules/.cache`, `ios/build`, `android/build`, `android/.gradle` would cut that.
- **Metro cache lives in `$TMPDIR/metro-cache`** per worktree. macOS clears `$TMPDIR` periodically; no sharing.
- **Multi-ABI Android builds in dev.** `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` builds all four architectures even for the dev simulator — single-ABI cuts ~75% off native Android build on cache miss.
- **`assetBundlePatterns: ['**/*']`** in [app.config.ts:18](../apps/tlon-mobile/app.config.ts#L18) — bundles everything. Narrow if there are large unused assets.

Existing local cache state on disk: `apps/tlon-mobile/ios/Pods` is 331 MB; `ios/build/` (DerivedData) exists from prior runs.

## The fingerprint mechanism (and why SDK 54 makes this easy)

`@expo/fingerprint` is a standalone, **fully local** npm package — no EAS required. It already ships with `expo` and `expo-updates`.

```bash
npx @expo/fingerprint .          # prints the SHA-1 hash for current project state
```

```ts
import { createFingerprintAsync, diffFingerprints } from '@expo/fingerprint';
const fp = await createFingerprintAsync('.');
// compare against a stored fingerprint to decide rebuild-or-not
```

It hashes by default: `package.json` deps, `app.config.ts` / `app.json`, native dirs (`ios/`, `android/`), Podfile.lock, expo plugins, build scripts. Customizable via `.fingerprintignore`, `fingerprint.config.js`, `sourceSkips`, `fileHookTransform`.

**SDK 54 graduated `buildCacheProvider` from experimental to stable.** With this set in `app.json`/`app.config.ts`, every `npx expo run:*` calls `calculateFingerprintHash()`, asks the provider's `resolveBuildCache()` for a binary matching that hash, and installs the cached binary if found. On miss, it builds and calls `uploadBuildCache()` to populate the cache.

Available providers:
- **`eas-local-cache`** — stores under `.expo/cache/` as `ios_<hash>.app` / `android_<hash>.apk`. Zero-config local cache. Best fit for the dev/agent loop.
- **`@slvssb/eas-github-cache`** — GitHub Releases as the cache backend; shared across machines.
- **`eas-build-cache-provider`** — EAS-hosted cache (works for both `eas build` and local `expo run`). Best fit for sharing CI builds with developer machines.
- Custom providers implement `resolveBuildCache()`, `uploadBuildCache()`, `calculateFingerprintHash()`.

### EAS-hosted shared cache (CI + local devs)

```json
// app.config.ts → ExpoConfig
{
  "expo": {
    "buildCacheProvider": "eas"
  }
}
```

Each push to develop generates one .app + one .apk on EAS, those become available via the cache, and subsequent local `npx expo run:ios` / agent iterations on the same fingerprint download them in seconds rather than rebuilding.

### Local-only cache (offline agent loop)

```json
{
  "expo": {
    "buildCacheProvider": { "plugin": "eas-local-cache" }
  }
}
```

Point the plugin's cache dir at `~/.expo/build-cache` so it's shared across worktrees on the same machine.

## Recommended changes, by ROI

### Tier 1 — biggest wins (do first)

1. **Configure `buildCacheProvider: "eas"`** in [app.config.ts](../apps/tlon-mobile/app.config.ts). One config line. Helps CI, local dev, *and* the agent loop. Investigate first: does `autoIncrement: true` in [eas.json](../apps/tlon-mobile/eas.json) bump fields that fingerprint includes? If so, add `sourceSkips` for them. Estimated impact: 50–60% of EAS-build-hours, ~8–12h/week saved at current cadence.

2. **Enable `apple.ccacheEnabled: "true"`** in [ios/Podfile.properties.json](../apps/tlon-mobile/ios/Podfile.properties.json) + `brew install ccache`. Speeds up the cache-miss path 30–60%.

3. **Android gradle properties** — in [android/gradle.properties](../apps/tlon-mobile/android/gradle.properties):
   ```properties
   org.gradle.parallel=true
   org.gradle.caching=true
   org.gradle.configuration-cache=true
   org.gradle.configuration-cache.parallel=true   # Gradle 8.11+
   org.gradle.workers.max=8                       # match cores
   org.gradle.jvmargs=-Xmx6g -XX:+UseG1GC
   reactNativeArchitectures=arm64-v8a             # single ABI in dev
   ```
   Single-ABI alone cuts Android native build by ~75% on cache miss. Configuration cache is the next-biggest repeat-build win.

### Tier 2 — substantial wins

4. **Shared Metro cache across worktrees** — point Metro's `cacheStores` at a `FileStore` rooted outside the worktree (e.g., `~/.cache/metro-shared`) so multiple worktrees with identical sources share transformer output. (Metro's cache keys are content-addressed, so this is safe — see Metro Caching section below.)

5. **`.watchmanconfig` with ignore globs** at the project root:
   ```json
   { "ignore_dirs": ["node_modules/.cache", "ios/build", "android/build", "android/.gradle", ".expo", "dist"] }
   ```
   Cuts 5–20s off Metro cold startup on each new worktree.

6. **Shared `GRADLE_USER_HOME`** at `~/.cache/tlon-gradle` so Gradle dep downloads + build cache survive worktree deletion.

7. **Shared Xcode DerivedData** — `xcodebuild -derivedDataPath ~/.cache/tlon-xc/<fingerprint>` (only safe when the worktree's native dirs are byte-identical, which the fingerprint already guarantees).

8. **Persistent simulator/emulator pool** — boot a named simulator once at session start, never shut it down; the agent loop targets that UUID. `agent-device` works with a specified target. Saves 5–15s per iteration plus reliability gains.

### Tier 3 — smaller / situational

- `pnpm install --frozen-lockfile --prefer-offline` in the loop (already fast, just explicit).
- Top-level `tsc --build` instead of per-package `tsc --noEmit` so refs cascade.
- Don't run `expo start -c` (cache clear) unless invalidation needed.
- Consider replacing `react-native-svg-transformer` as `babelTransformerPath` ([metro.config.js:20](../apps/tlon-mobile/metro.config.js#L20)) — it forces *every* file through its wrapper. Minor but measurable.
- Narrow `assetBundlePatterns` if there are unused large assets.
- Use Hermes precompiled dev bundles where appropriate.
- **Precompiled React Native for iOS** (`RCT_USE_RN_DEP=1 RCT_USE_PREBUILT_RNCORE=1 pod install`) — RN 0.81 ships RN core as `ReactNativeDependencies.xcframework`, ~10x clean-build speedup, **but incompatible with `use_frameworks!`** in older revisions and we currently use `use_frameworks! :linkage => :static`. Needs a PoC before adopting.

## Sample agent loop (after Tier 1 + Tier 2 are in place)

```bash
# once per session
SIM_UDID=$(xcrun simctl create "agent-loop" "iPhone 16 Pro" "iOS18.2")
xcrun simctl boot "$SIM_UDID"

# per iteration
WT=../wt-$ITER
git worktree add "$WT"
cd "$WT"

pnpm install --prefer-offline --frozen-lockfile

FP=$(npx @expo/fingerprint .)
CACHE=~/.expo/build-cache/ios_${FP}.app

if [ -d "$CACHE" ]; then
  xcrun simctl install "$SIM_UDID" "$CACHE"
else
  npx expo run:ios --device "$SIM_UDID"   # buildCacheProvider auto-populates cache
fi

# point existing Metro at this worktree (restart or use --reset-cache)
# launch app
xcrun simctl launch "$SIM_UDID" io.tlon.groups
# inspect via agent-device
agent-device --target "$SIM_UDID" snapshot -i
# collect logs, evaluate, decide next iteration
```

For pure JS changes (no fingerprint change), iterations reduce to: install cached binary (1–2s) + Metro `reload` over WS (1–2s).

## Things to validate before rollout

1. **Does `autoIncrement: true` break the cache?** Need to confirm whether the fingerprint includes the bumped `buildNumber` / `versionCode`. If yes, `sourceSkips` for those fields. (Likely fine for `runtimeVersion: '4.0.2'` since it's pinned.)
2. **Sharing a single Metro cache across worktrees** — confirmed safe in principle (keys use relative paths since [RN 2e0d5c8](https://github.com/facebook/react-native/commit/2e0d5c87e93bb970ef1c8864ca44b47b36d6ae2e); Expo's `_expoRelativeProjectRoot` is workspace-relative). One operational gotcha: `FileStore` isn't concurrency-safe for writes to the same key — bounded damage on macOS/Linux, can `EBUSY` on Windows. See Metro Caching section below.
3. **`pre-built dev clients across worktrees`** — installing a `.app` built in worktree A on the simulator while worktree B is the cwd. Debug-signed binaries should work fine across worktrees.
4. **`agent-device` capabilities** — confirmed: `snapshot -i` returns token-efficient accessibility tree with `@e1`-style refs (cheap for LLM-driven loops), supports targeting specific simulator UUIDs.

## Karpathy autoresearch loop (the conceptual model)

[github.com/karpathy/autoresearch](https://github.com/karpathy/autoresearch):
- Three files: `prepare.py` (frozen utilities), `train.py` (only file the agent edits), `program.md` (agent instructions).
- Fixed 5-minute time budget per experiment → ~12/hr, ~100 overnight.
- Loop: read → propose change → run → measure `val_bpb` → commit if better, rollback if worse.
- Bounded blast radius: only one file is mutable, only one metric is the signal.

Translation to RN: the "frozen toolchain" is Metro + Xcode + Gradle; the "mutable file" is `apps/tlon-mobile/src/**` and possibly `packages/app`; the "signal" is whatever the test harness emits (e2e pass/fail, render snapshot match, perf metric delta). The fingerprint hash itself is a natural rollback signal — if a change flipped the fingerprint, that experiment took disproportionately long; tag those.

## Other 2025-2026 levers worth knowing

- **Hermes V1 (RN 0.82, experimental)** — ~2.5% iOS / 7.6% Android TTI, ~9% iOS / 3% Android bundle load improvement. Future-tense; you're on 0.81.5.
- **React Compiler in default template (SDK 54)** — auto-memoization reduces re-render work.
- **Expo Atlas (stable in SDK 54)** — `EXPO_ATLAS=1 npx expo` for bundle inspection; useful for diagnosing heavy modules (Skia, Firebase, Sentry, posthog, audio-waveform are all large in the manifest).
- **`eas fingerprint:compare`** — diff two fingerprints to understand *why* a rebuild was triggered. Critical debugging tool when cache-hit rate drops.
- **Re.Pack + Module Federation** — for very large apps, lets you ship JS in chunks; possibly relevant if the JS bundle is heavy.
- **Tamagui static extraction** — `@tamagui/babel-plugin` runs `experimentalFlattenThemesOnNative: true` ([babel.config.js](../apps/tlon-mobile/babel.config.js)). Confirm extraction is disabled in dev to avoid build-time cost.
- **Hot vs full reload** — Fast Refresh preserves state and is much cheaper than a full reload. For agent loops that need a deterministic mount, the `mountId` trick (already documented in CLAUDE.md) is the right validation.
- **Hermes precompiled bytecode** — already on by default for release; not relevant for dev iteration.

## Rock (rockjs.dev) — alternative

Callstack's React Native build toolkit. Headline feature: **remote build cache** that "saves up to 96% of build time by reusing native artifacts (APK, AAB, APP, IPA) across machines and CI", with built-in S3/R2/GitHub backends. Conceptually the same recipe as `buildCacheProvider`, just productized into a different shell.

Tradeoff for us: Rock is designed to replace Community CLI workflows. Migration from a deeply-Expo project (config plugins, expo modules, etc.) is much more lift than adopting `buildCacheProvider` on top of Expo CLI. **Worth knowing about, not worth migrating to for this project.**

## Metro caching

Metro's cache is the second-biggest lever after native build caching. Sharing it across worktrees on a single machine — and optionally across machines via a tiny HTTP server — eliminates the 30–90s cold-bundle cost from each new worktree.

### What Metro actually caches

`metro-cache` is a **layered, content-addressed cache of transformed modules** — i.e., the output of `metro-transform-worker` (Babel-transformed JS, source maps, per-module dependency lists). It does not cache:
- The final bundle (only per-file transforms).
- The resolution graph (rebuilt each run, but cheaper than transformation).
- Watchman / HasteMap state (separate, lives under `$TMPDIR/.watchman-state-*`).

Cache key inputs ([metro-transform-worker source](https://github.com/facebook/metro/blob/main/packages/metro-transform-worker/src/index.js)):
1. Hash of transformer files (`__filename`, `babel-transformer`, `minifier`, asset plugin).
2. `stableHash(transformerConfig)` — MD5 over canonicalized JSON.
3. `babelTransformer.getCacheKey()` — typically a hash of `babel.config.js`.
4. **`cacheVersion`** (user-supplied string — bump to force-invalidate).
5. Per-file: file contents + **relative path** (not absolute path, since [RN commit 2e0d5c8](https://github.com/facebook/react-native/commit/2e0d5c87e93bb970ef1c8864ca44b47b36d6ae2e)).

Lookup is **sequential** across `cacheStores`. On a hit at store *N*, Metro back-populates stores 0..N-1 — this is what makes "fast local FileStore + slower remote HttpStore" work as a layered cache.

`FileStore` lays files out as `root/<first-byte-hex>/<rest-of-key-hex>` — 256 shard dirs.

### Expo-specific behaviour (SDK 54)

`getDefaultConfig` from `@expo/metro-config` ([source](https://github.com/expo/expo/blob/main/packages/%40expo/metro-config/src/ExpoMetroConfig.ts)):
- Installs a single `FileStore` at `$TMPDIR/metro-cache` (overrides Metro's default to roughly the same path).
- Adds extra cache-key transformer fields: `postcssHash`, `browserslistHash`, `sassVersion`, `reanimatedVersion`, `workletsVersion`, and importantly `_expoRelativeProjectRoot = path.relative(serverRoot, projectRoot)`.

The `_expoRelativeProjectRoot` field is the one subtle gotcha for worktree sharing: it's `"apps/tlon-mobile"` in this repo regardless of which worktree you're in (since the workspace layout is the same). So it's worktree-invariant **as long as Metro is always invoked from the workspace root or via the same relative path**. If anyone ever invokes Metro from a non-workspace directory, that field diverges and the cache misses.

SDK 54 (Metro 0.83) shipped no new dedicated cache features. Internal Metro imports moved from `metro/src/...` to `metro/private/...` — irrelevant for cache config.

### Shared `FileStore` across worktrees — the immediate win

For the agent loop's same-machine multi-worktree case, this is the entire change to [apps/tlon-mobile/metro.config.js](apps/tlon-mobile/metro.config.js):

```js
const path = require('node:path');
const os = require('node:os');
const { FileStore } = require('metro-cache');
const { mergeConfig } = require('@react-native/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const baseConfig = getSentryExpoConfig(__dirname);
const pkg = require('./package.json');
const rnVer = pkg.dependencies['react-native'] ?? 'unknown';
const expoVer = pkg.dependencies.expo ?? 'unknown';

const config = {
  // ...existing config...
  cacheStores: [
    new FileStore({
      root: path.join(
        os.homedir(),
        '.cache',
        'tlon-metro-shared',
        `rn-${rnVer}-expo-${expoVer}`,
      ),
    }),
  ],
};

module.exports = mergeConfig(baseConfig, config);
```

Why this is safe across worktrees:
- File contents hashed; only **relative** paths, not absolute. Identical sources → identical keys.
- Expo's `_expoRelativeProjectRoot` is workspace-relative → invariant across worktrees of this repo.
- Path partitioned by RN + Expo version → upgrades don't poison the cache.
- Survives `pnpm install` (the lockfile-derived hashes only shift when a transformer dep actually moves).

The one gotcha: `FileStore` is **not concurrency-safe for writes** to the same key — see [facebook/metro#331](https://github.com/facebook/metro/issues/331). If two worktrees transform the same file at the same moment, last writer wins (both wrote identical bytes, so the damage is bounded). On Windows you can hit `EBUSY`; on macOS/Linux it's effectively fine.

Expected impact: cold Metro bundle on a fresh worktree goes from ~30–90s to ~5–15s on the N-th worktree.

### Remote cache for cross-machine / CI sharing

Metro ships `HttpStore` (read+write) and `HttpGetStore` (read-only). Trivial protocol — gzipped buffer over GET/PUT keyed by hex digest ([andrei-calazans writeup](https://andrei-calazans.com/posts/metro-http-cache/)):

- `GET /{prefix}/{key-hex}` → gzipped body, or 404.
- `PUT /{prefix}/{key-hex}` → gzipped body.
- Supports TLS via `key`/`cert`/`ca`, custom `headers`, `HttpsProxyAgent`, configurable timeout, exponential-backoff retries.

Used as a layered cache — local `FileStore` first for speed, remote `HttpStore`/`HttpGetStore` second for cross-machine reach. CI writes (`HttpStore`); developers read (`HttpGetStore`):

```js
config.cacheStores = ({ FileStore, HttpStore, HttpGetStore }) => [
  new FileStore({ root: localRoot }),
  process.env.CI
    ? new HttpStore({
        endpoint: `${endpoint}/rn-${rnVer}-expo-${expoVer}`,
        headers: { 'x-api-key': process.env.METRO_CACHE_TOKEN },
      })
    : new HttpGetStore({
        endpoint: `${endpoint}/rn-${rnVer}-expo-${expoVer}`,
        headers: { 'x-api-key': process.env.METRO_CACHE_TOKEN },
      }),
];
```

There is **no published npm package** for an S3-backed Metro cache server — Microsoft (Office), Airbnb, and Meta all rolled their own ([rnx-kit discussion #983](https://github.com/microsoft/rnx-kit/discussions/983)). A minimal server is ~50 lines of Express that pipes `req → s3.putObject` and `s3.getObject → res`. Closest OSS reference: [EvanBacon/Metro-remote-cache](https://github.com/EvanBacon/Metro-remote-cache).

Even simpler: skip the server, use **S3 signed URLs** with a public-read bucket + IAM-write for CI, and put CloudFront in front for latency. You lose write access-control granularity but gain operational simplicity.

### `cacheVersion` partitioning — the upgrade-safety pattern

You almost never need to set `cacheVersion` manually for normal day-to-day work. Inputs that auto-invalidate:
- Files in `babel.config.js`'s resolved set (via `babelTransformer.getCacheKey()`).
- Transformer/minifier/asset-plugin files (mtime + content hashed).
- Any field in `transformer` config.
- Source file contents.

Inputs that **don't** auto-invalidate and bite you:
- A new Babel plugin pulled in by `pnpm install` whose behaviour depends on env vars not part of `transformer` config.
- Upgrading `react-native` itself often changes transformer files — usually auto-handled, but **cross-RN-version cache reuse is unsafe**. Partition the remote-cache URL prefix (and local FileStore root) by RN + Expo version, as shown above.

### What not to bother with

- **Re.Pack** — has more mature cache primitives (webpack `cache.type: 'filesystem'`, S3 plugins), but [does not officially support Expo](https://github.com/callstack/repack/discussions/1309). Replacing Metro with Re.Pack in an Expo SDK 54 project loses Expo Router integration, `expo export`, precompiled module resolution, and most `getDefaultConfig` behaviour. Not worth it for cache wins alone.
- **Rock's "remote build cache"** is for **native artifacts only** (APK/AAB/IPA/APP), keyed by `@expo/fingerprint`. It does not cache Metro JS transforms. Rock and a shared Metro `FileStore` are orthogonal; use Rock-style native caching via `buildCacheProvider` (already covered above) and shared `FileStore` for JS transforms.
- **Sharing Watchman state across worktrees** — neither needed nor recommended. Watchman is per-root, cold-start cost is ~1s of `watch-project`, not 30–90s. Just leave it.

### Pragmatic recommendation

Two-phase rollout:

1. **Same-machine, multi-worktree** (immediate, ~5-line change to `metro.config.js`) — shared `FileStore` at `~/.cache/tlon-metro-shared/rn-<v>-expo-<v>/`. Eliminates the cold Metro bundle cost on every new worktree. No server, no new dependency.

2. **Cross-machine / CI sharing** (later, if needed) — add an `HttpStore`/`HttpGetStore` layer on top, point at a tiny Express+S3 server (or signed-URL bucket). CI writes, devs read. Saves another 10–30s on cold starts and means new team members get a warm cache on day one.

Both pair cleanly with the native `buildCacheProvider` recommendation in §"Tier 1" — they cache different things (native binary vs JS transforms) at different layers, and we want both.

## References

- [`@expo/fingerprint` docs](https://docs.expo.dev/versions/latest/sdk/fingerprint/)
- [Expo build cache providers](https://docs.expo.dev/guides/cache-builds-remotely/)
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)
- [Expo local app development](https://docs.expo.dev/guides/local-app-development/)
- [React Native build-speed docs](https://reactnative.dev/docs/build-speed)
- [React Native 0.81 blog](https://reactnative.dev/blog/2025/08/12/react-native-0.81)
- [Precompiled RN for iOS](https://expo.dev/blog/precompiled-react-native-for-ios)
- [`eas-local-cache`](https://github.com/dennytosp/eas-local-cache)
- [`@slvssb/eas-github-cache`](https://www.npmjs.com/package/@slvssb/eas-github-cache)
- [Metro configuration docs](https://metrobundler.dev/docs/configuration/)
- [Gradle configuration cache](https://docs.gradle.org/current/userguide/configuration_cache.html)
- [Watchman config docs](https://facebook.github.io/watchman/docs/config.html)
- [`agent-device`](https://github.com/callstackincubator/agent-device)
- [`eas-agent-device` example](https://github.com/callstackincubator/eas-agent-device)
- [karpathy/autoresearch](https://github.com/karpathy/autoresearch)
- [Expo Atlas](https://github.com/expo/atlas)
- [Speed up iOS build 4x using cache Pods](https://dev.to/retyui/react-native-how-speed-up-ios-build-4x-using-cache-pods-597c)
- [Rock (rockjs.dev)](https://rockjs.dev/)
- [Metro Caching docs](https://metrobundler.dev/docs/caching/)
- [Metro Caching.md on GitHub](https://github.com/facebook/metro/blob/main/docs/Caching.md)
- [`metro-cache` package source](https://github.com/facebook/metro/tree/main/packages/metro-cache)
- [Andrei Calazans — Metro HTTP Cache implementation](https://andrei-calazans.com/posts/metro-http-cache/)
- [EvanBacon/Metro-remote-cache (proof of concept)](https://github.com/EvanBacon/Metro-remote-cache)
- [microsoft/rnx-kit discussion #983 — Metro Cache with S3](https://github.com/microsoft/rnx-kit/discussions/983)
- [facebook/metro#331 — concurrent build `/tmp/metro-cache` race](https://github.com/facebook/metro/issues/331)
- [Callstack — caching RN builds on S3/R2](https://www.callstack.com/blog/caching-react-native-builds-on-s3-and-r2)
- [Re.Pack Expo support discussion #1309](https://github.com/callstack/repack/discussions/1309)
