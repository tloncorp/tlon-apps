# Mobile Ticket Loop — ticket in, merged PR out

The end-to-end loop an agent runs to take one ticket against `apps/tlon-mobile` and
deliver a merged PR, unattended. It covers the environment (`rn-iso`), on-device
evidence (`agent-device`), and delivery (the `pr-workflow` and `github-upload` skills).

Scope: mobile changes whose effect is **observable on a device** — UI, navigation,
gestures, sync-visible state. A ticket with no on-device symptom (Hoon in `desk/`,
CI config, docs) uses steps 1, 6 and 7 only; say so in the PR instead of faking
screenshots.

## Prerequisites, checked once per session

```bash
npx rn-iso --version        # must be >= 1.0.0; if lower: npx rn-iso@latest
agent-device --version      # must be >= 0.19.1
gh auth status              # write access to tloncorp/tlon-apps
node --version              # 22.x
```

-   **Node 22.23.2.** Root `engines` says `>=22.12.0` and `.nvmrc` says `22.22.0`;
    22.23.2 satisfies both plus `better-sqlite3` prebuilds, React Native's floor,
    and `posthog-react-native`. On branches older than ~March 2026 `.nvmrc` still
    says `20.11.0` — **that pin is wrong**, nothing in the tree builds on it.
    Node 24+ has no `better-sqlite3@11.x` prebuild and falls back to node-gyp.
-   `rn-iso` never runs your build and never starts Metro on its own. Read
    `npx rn-iso guide lifecycle`, `guide logs`, `guide errors` instead of
    duplicating them here — the installed binary's own docs cannot be stale.
-   `agent-device` is a router: read `agent-device help manual-qa` before the
    first device command, and `help react-native` — this app is a dev client.
-   Architecture and platform-specific navigation live in `CLAUDE.md`. This
    document is the loop, not the codebase.

## 1. Ticket intake — write the acceptance criterion first

Fetch the ticket from Linear if the connector is available; otherwise work from the
ticket text pasted into the prompt. Either way, **before touching code**, restate it
as one sentence an agent could falsify with a screenshot:

> On `<screen>`, when `<action>`, the app currently `<observed>`. After the fix it
> must `<expected>`, visible in a screenshot of `<screen>` taken the same way.

If you cannot write that sentence, the ticket is underspecified — stop and ask,
don't guess. Name the screen precisely: mobile renders `packages/app/features/…`,
not the desktop tree (see `CLAUDE.md`, "Platform-Specific Navigation Architecture").

Branch name follows the repo's merged PRs: `<handle>/<slug>`, with the Linear id in
the slug when there is one — `patrick/tlon-6224-heartbeat-races-the-nudge`,
`claude/android-ime-input-fixes`, `db/hide-delete-markers`.

## 2. Workspace

From the main checkout:

```bash
cd "$(npx rn-iso worktree create tlon-6224-thread-scroll --base origin/develop --carry-ignored)"
```

**Read what `--carry-ignored` prints.** "No node_modules among them" means the clone
carried nothing buildable. "Carried Pods do not match Podfile.lock" is expected and
`rn-iso ios` fixes it by running `pod install` itself.

The clone matches the *source worktree*, not `--base`. If the main checkout is far
behind `origin/develop`, the carried `node_modules` are wrong and `pnpm install`
will do real work — that is correct, not a failure.

```bash
nvm use 22.23.2
pnpm install
pnpm build:packages          # apps import built dist, not src
```

-   If `apps/tlon-mobile/package.json` still has a `generate:tailwind` script, run
    it — on those branches `index.js` imports the generated `tailwind.json` and
    Metro fails to resolve it otherwise. Current `develop` dropped `tailwind-rn`;
    the step is gone there.
-   `.env` is gitignored (`apps/tlon-mobile/.gitignore`), so `--carry-ignored`
    clones it. Verify with `ls -l apps/tlon-mobile/.env`; if it is missing, copy it
    from the main checkout. Never commit it and never print its contents.

```bash
npx rn-iso start             # blocks until the dev server verifies as this workspace's
```

Metro on this graph is slow cold: `npx rn-iso start --wait 180` if it times out.
`npx rn-iso status` shows every workspace on the machine — a booted sim is 1–2 GB,
so stop something before you become the fourth.

## 3. BEFORE evidence — capture the bug before you edit anything

```bash
npx rn-iso ios --json
```

On an unchanged tree expect `cacheHit: "local"` or `"remote"` (the repo configures
`buildCacheProvider: 'eas'` in `app.config.ts`, which rn-iso consults on a local
miss). Read `udid`, `bundleId`, `metroPort`, `launched` from the payload — **never
hardcode them, and never assume a `booted` simulator is yours.**

`launched: true` is required. `launched: "unverified"` means the app started but no
bundle request reached *this* workspace's Metro — see troubleshooting.

Then drive the device to the screen in the acceptance criterion and capture it:

```bash
PROOF=/tmp/tlon-6224-proof && mkdir -p "$PROOF"
# UDID / BUNDLE / PORT come from the rn-iso ios --json payload, never from memory
agent-device open "$BUNDLE" --platform ios --device "$UDID" --session tlon-6224 \
  --metro-host 127.0.0.1 --metro-port "$PORT" --relaunch
agent-device snapshot -i
agent-device press '<ref-or-selector>' --settle          # navigate; repeat as needed
agent-device screenshot "$PROOF/before-thread.png"
agent-device close
```

Binding `--device` and `--metro-port` explicitly is what keeps a parallel agent's
simulator and a parallel agent's bundle out of your evidence. Keep artifacts in
`/tmp`, **not in the worktree** — untracked files make `worktree remove` refuse.

-   **Screenshots always.** Record only when the ticket is about motion or
    interaction (a gesture, an animation, a transition) — a still frame proves a
    layout fix just as well and costs nothing to review.
-   Recording goes through `agent-device record start "$PROOF/before.mp4"` /
    `agent-device record stop`, and through nothing else. **Never call
    `xcrun simctl recordVideo`**: it takes a global host lock that wedges this Mac
    and survives the process you killed.
-   Note the exact steps. Step 5 repeats them identically or the pair proves
    nothing.

## 4. Implement

Edit, and let Fast Refresh apply it — no rn-iso command is involved in a JS-only
change. If the app does not pick it up, `agent-device metro reload`.

```bash
npx rn-iso logs --errors            # empty output + exit 0 IS the pass condition
npx rn-iso logs --since 2m --level error
npx rn-iso logs --source device --level error    # native crash that never reached JS
```

-   A React Native LogBox/RedBox overlay blocks interaction: run
    `agent-device react-native dismiss-overlay`, never press the warning text.
-   **Rerun `npx rn-iso ios` when a native input changes** — a dependency added or
    bumped, `app.config.ts`, a config plugin, anything under `ios/` or `android/`.
    The fingerprint misses and it compiles for real. A JS/TS edit needs nothing.
-   Follow `CLAUDE.md`'s pre-PR cleanup rules as you go: no leftover `console.log`,
    no branch-only compat shims, no comments describing an approach you abandoned.

## 5. AFTER evidence — same screens, same route

Repeat step 3 exactly: same session name, same navigation path, same capture
command, writing `after-*.png` beside the `before-*.png`.

If the ticket is cross-platform, do both. Android gets its own emulator in the same
workspace and the dev server is already up:

```bash
npx rn-iso android --json     # read serial, bundleId (the PACKAGE name), metroPort
agent-device open "$PACKAGE" --platform android --device "$SERIAL" \
  --session tlon-6224-android --metro-port "$PORT" --relaunch
```

## 6. Validate

The repo's own gates, which are what CI runs (`.github/workflows/ci.yml`):

```bash
pnpm format:check                       # oxfmt; `pnpm format` fixes
pnpm -r lint                            # oxlint
pnpm build:editor && pnpm -r tsc
pnpm --filter 'tlon-mobile' test-ui     # jest, mobile unit tests
pnpm check:native-navigation-icons      # only if you touched navigation icons
```

`pnpm test:ci` runs the whole monorepo suite and is worth it before a non-trivial
PR; scope to the affected package otherwise. On older branches these are eslint and
prettier (`pnpm lint:all`, `pnpm lint:format`) — read `package.json`, don't assume.

Finish with `npx rn-iso logs --errors` clean. Never claim a check passed without
having run it.

## 7. PR

**Invoke the `pr-workflow` skill before any `gh pr` command.** It owns template
discovery, title convention, the description rules, and the fresh-eyes review pass.
Two things it will need from this repo:

-   `.github/pull_request_template.md` is mandatory and `gh pr create` does not
    apply it — fill in every section explicitly: Summary / Changes / How did I
    test? / Risks and impact / Rollback plan / Screenshots or videos.
-   Draft by default unless the user asked for ready-for-review.

Media goes up with the `github-upload` skill. Write the body pointing at local
paths and let `--attach` rewrite them in place:

```bash
gh pr comment --help | grep -q -- '--attach' && echo native || echo "use gh image"
gh pr create --draft --title "…" --body-file "$PROOF/pr-body.md" \
  --attach "$PROOF/before-thread.png" --attach "$PROOF/after-thread.png"
```

A video only renders as a player when written as `![label](./clip.mp4)` alone in a
paragraph; link syntax gives a dead link. If `--attach` is unavailable, upload with
`gh image` and embed the returned `user-attachments` URL.

**"How did I test?" must name the device work**: which simulator/emulator, which
screens, which steps, and that the attached before/after were captured the same
way. "Tested locally" is not an answer.

## 8. Park, don't destroy

```bash
npx rn-iso stop
```

Frees ~1.5 GB: supervisor halted, log collectors reaped, owned device **shut down
but not deleted**, port freed. The workspace and its device assignment survive, so a
review round costs a boot instead of a rebuild.

Review rounds: `npx rn-iso start`, `npx rn-iso ios` (cache hit), fix, re-run step 6,
push. Re-capture the media if the visible behaviour changed, and refetch the body
with `gh pr view <n> --json body -q .body` before `gh pr edit --body` — the user may
have edited it.

## 9. Cleanup, on merge only

Poll when asked to finish, or act when the user says it merged:

```bash
gh pr view <n> --json state -q .state    # MERGED
npx rn-iso worktree remove /path/to/workspace
```

That destroys the worktree directory, **deletes** the owned simulator (not just
shuts it down), releases the port reservation, and drops the workspace's `.rn-iso`
logs. Nothing outside that workspace is touched.

It **refuses** on uncommitted changes, untracked files, or commits not on any
remote, and prints the offending paths. Commit and push first. An iOS build rewrites
tracked files, so this fires routinely:

```bash
git checkout -- apps/tlon-mobile/ios/Podfile.lock \
                apps/tlon-mobile/ios/Landscape.xcodeproj/project.pbxproj
```

Delete `$PROOF` yourself; it lives in `/tmp` and rn-iso does not know about it. The
workspace's own `.rn-iso/` never counts as dirt. **Do not reach for `--force`** — it
permanently discards work, and a refusal means something genuinely unexpected.

## Safety

-   **Never sign in with real credentials during validation.** Use a dev ship or a
    throwaway account. Do not paste `.env` values (PostHog keys, Sentry DSN, API
    auth) into a log, a PR body, or a commit.
-   **Never commit `.env`.** It is gitignored; check `git status` before committing
    anyway.
-   **Screenshots must not leak real user data** — no real contacts, DMs, group
    names, or ship names belonging to anyone. Re-capture on a fake ship rather than
    cropping.
-   `worktree remove --force`, `gc --delete`, and `stop --force` are destructive or
    unattributed. Ask the user before running any of them.

## Troubleshooting

| Symptom | What it means | Do this |
|---|---|---|
| `RN_ISO_NO_METRO` from `ios`/`android` | Nothing provable as this workspace's dev server holds the reserved port | `npx rn-iso start`. If the port is held by a foreign process, it names it — usually a bundler started from the repo root instead of `apps/tlon-mobile` |
| `launched: "unverified"` | App started, no bundle request reached this Metro — normally the expo-dev-client server picker awaiting a tap, or an iOS "Open in app?" alert | Drive it with `agent-device`: `snapshot -i`, then pick the row for **this workspace's `metroPort`** from the `--json` payload. Never tap a row you remember from a previous run — it lists every Metro on the machine |
| Fingerprint misses on every run | A native input keeps changing | `git status` on `ios/`, `android/`, `app.config.ts`, `package.json`. A setup script rewriting a tracked native file is the usual cause |
| `RN_ISO_NO_FINGERPRINT` | `@expo/fingerprint` not resolvable, so the shared cache is unaddressable | `pnpm install` completed? If it genuinely is absent, add it as a dev dependency — otherwise every workspace compiles from scratch forever |
| `RN_ISO_DEPS_FAILED` | `pod install` failed — carried `Pods` vs branch `Podfile.lock` | `pnpm deps:ios` from the repo root, then rerun `npx rn-iso ios` |
| `RN_ISO_METRO_TIMEOUT` | Supervisor alive, bundler not serving yet | `--wait 180`. `start` already printed the tail of `.rn-iso/logs/supervisor.log` — read it |
| `logs --errors` prints nothing | **That is the pass condition**, not a broken query | Nothing. If you started Metro yourself instead of via `rn-iso start`, the timeline is empty rather than clean — that is different |
| `logs --errors` full of noise | Device-source noise is excluded by default; if you added `--source device` you opted into Apple framework chatter | Drop back to the default scope; use `--grep` or `--since` to narrow |
| `worktree remove` refuses | Uncommitted, untracked, or unpushed work — pod churn is the common case | Restore exactly the paths it named, or commit and push. `.rn-iso/` is never the reason |
| `snapshot` sparse or "AX unavailable" | The screen's accessibility state is invalid | Use `screenshot` as visual truth, navigate away by coordinates, then `snapshot -i` again |
| Recording hangs / simulator wedges | `simctl recordVideo` was used somewhere | Only ever record via `agent-device record start` / `agent-device record stop` |
