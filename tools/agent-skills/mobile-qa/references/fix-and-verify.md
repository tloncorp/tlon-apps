# Fixing the bug and verifying it on-device

## Fixing

1. **Find the screen** from a visible string:
   `grep -rn "Edit channel info" packages/` → the view component.

2. **Find a working sibling.** These mobile bugs are usually a component wired
   slightly differently than an equivalent screen that behaves correctly. Example
   from TLON-6173: `EditChannelMetaScreenView` wrapped its whole layout (header
   included) in `KeyboardAvoidingView`, while the working `MetaEditorScreenView`
   ("Edit group info") kept the `ScreenHeader` outside the KAV and wrapped only
   the `ScrollView`. The fix was to mirror the working structure. Diffing against
   the sibling gives you both the fix and the root-cause explanation for the PR.

3. **Hygiene before committing:**
   - Typecheck: `cd packages/<pkg> && npx tsc --noEmit` (or `pnpm -r tsc`).
   - Prettier: `npx prettier --write <changed files>`.
   - Branch off `develop` **explicitly** — don't rely on current HEAD:
     `git fetch origin && git switch -c <user>/tlon-<NNNN>-<slug> origin/develop`.
     (`git checkout -b <name>` with no start point branches from wherever you
     happen to be; on a stale feature branch that drags unrelated commits into the
     PR.) The `tlon-<NNNN>` segment auto-links the PR to the Linear issue.
   - Commit. If your agent uses a co-author trailer, add it (e.g.
     `Co-Authored-By: <agent> <email>`).
   - Push, then `gh pr create --base develop` with a body following the repo
     template (`.github/pull_request_template.md`): **Summary / Changes / How did
     I test? / Risks and impact / Rollback plan / Screenshots**. `gh` does not
     apply the template automatically — fill it in.
   - **Embed the before/after screenshots** — see *Embedding screenshots in the
     PR* below (it's easy to get this wrong and ship a PR with broken images).

## Embedding screenshots in the PR

GitHub only renders an image whose URL it can fetch **anonymously**. That rules
out Linear `assetUrl`s (they need a Linear login → broken image) and, for private
repos, `raw.githubusercontent.com` (needs a token). Prefer, in order:

1. **GitHub user-attachments — best; permanent, works for public *and* private
   repos, stays off the PR diff.** In the PR (or comment) composer on github.com,
   drag-drop or paste the image file. GitHub uploads it to its own CDN and inserts
   a `https://github.com/user-attachments/assets/<uuid>` URL. These URLs are
   signed-but-public, so they render for every viewer regardless of repo
   visibility. **There is no `gh` CLI or REST endpoint for this upload** — it only
   happens through the web composer. So the reliable flow is: create the PR with
   `gh`, then open it in the browser and drag the images into the description. If
   you (as an agent) can't drive a browser, hand the image files to the user and
   ask them to drop them in — or use the fallback below.
2. **Fallback for public repos — raw URL on a throwaway branch.** Push the PNGs to
   a small branch (not the PR head, to keep them off the diff) and reference
   `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`. Verify it
   returns `200 image/png` before relying on it. Caveat: the branch must live as
   long as the PR should show the images — delete it and they 404 — so this is
   less durable than user-attachments.

**Never** embed an `uploads.linear.app` URL in a PR; it needs auth and renders
broken. (Linear attachments are fine *on the Linear issue itself* — just not in
GitHub.)

## Verifying on-device — know your variant first

Whether you need a rebuild depends entirely on the build variant, and this is
easy to get wrong. In `apps/tlon-mobile/android/app/build.gradle`,
`previewDebug` (and the other `*Debug*` variants) are listed in
**`debuggableVariants`**, which — per the Expo config comment right above it —
**skips bundling the JS bundle and assets**. So:

- **`previewDebug` does NOT embed your JS.** It loads the bundle from **Metro** at
  runtime. `./gradlew :app:installPreviewDebug` therefore does *not* put your
  current source on the device by itself — without Metro it runs stale/last-cached
  JS, and Phase 5 can falsely pass or fail against the wrong code.
- Only a **bundling (release-style) variant** embeds the current JS into a
  standalone APK: **`previewRelease`** (`pnpm --filter tlon-mobile
  android:release:preview`).

### For a JS/TS-only fix (the common case) → use Metro, no rebuild needed

If a `previewDebug` build is already installed (the usual dev/preview state), you
don't need Gradle at all:

Use the `adbx.sh` wrapper (`A="$SKILL/scripts/adbx.sh"`) for the adb calls —
`adb` is usually not on PATH (Phase 1), and the wrapper's `adb` passthrough
resolves it.

```bash
# 1. Start Metro on the FIXED source. It runs in the FOREGROUND and blocks, so
#    background it (append & / separate session) and keep it running:
( cd apps/tlon-mobile && APP_VARIANT=preview npx expo start --dev-client --port 8081 ) &
# 2. Make the device reach it, then load it (via the wrapper, not bare adb):
"$A" adb reverse tcp:8081 tcp:8081
"$A" adb shell am start -a android.intent.action.VIEW \
  -d "io.tlon.groups.preview://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
# (or force-stop + relaunch and pick "localhost:8081" from the dev-launcher's
#  Recently Opened list)
```

**Confirm you're actually on your Metro bundle**, or you may verify stale code:
watch the Metro log for an `Android Bundling …` line when the app loads. If no
bundling request arrives, the app is running an embedded/cached bundle — your fix
is NOT live. (This is the trap that makes Phase 5 lie.)

### For a native change, or a standalone APK that embeds the fix → build a bundling variant

Prereqs on a typical macOS dev box: JDK 17 (`/opt/homebrew/opt/openjdk@17`) and
the Android SDK (`/opt/homebrew/share/android-commandlinetools`).

Simplest: use the package script, which sets the variant env for you:

```bash
# EMBEDS the JS as the preview variant. Cold build ~10-20 min; run in bg.
pnpm --filter tlon-mobile android:release:preview
```

If you invoke Gradle directly instead, you **must** set `APP_VARIANT=preview` —
`app.config.ts` derives the Expo scheme and `extra.appVariant` from it and
defaults to *production* when it's unset, so a bare `installPreviewRelease` embeds
production JS constants (Branch keys, deep-link scheme, etc.) under the preview
applicationId, making preview-only behavior unverifiable:

```bash
# Append sdk.dir only if absent — don't clobber an existing local.properties
# (it may hold machine-specific SDK/NDK paths from prior Android builds):
lp=apps/tlon-mobile/android/local.properties
grep -qs '^sdk.dir=' "$lp" || \
  echo "sdk.dir=/opt/homebrew/share/android-commandlinetools" >> "$lp"
cd apps/tlon-mobile/android
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
APP_VARIANT=preview ./gradlew :app:installPreviewRelease -x lint
```

Watch for `BUILD SUCCESSFUL` / `Installed on` vs `BUILD FAILED` / `FAILURE:`, and
set `adbx.sh stayon` so the screen stays awake during the long build.

### Data-safety rule: never uninstall

Reinstalling over the existing app is safe **as long as you do not uninstall it**.
If signatures match, `adb install -r` preserves app data and the user's login. If
signatures differ (e.g. a release-signed `previewRelease` over a debug-signed
`previewDebug`), the install simply **fails** — it does not silently wipe. So:
never run `adb uninstall`. Worst case is "couldn't install, report that", never
"logged the user out of their real account". If it fails on signature mismatch,
tell the user rather than forcing it — the Metro flow above avoids the mismatch
entirely for JS fixes.

## Capture the proof

Once the fix is live on the device (Metro-loaded for a JS fix, or installed for a
bundling build), reproduce the exact failing steps from the Linear repro,
screenshot the corrected behavior, and view the shot to confirm. The deliverable
is a before (the filed broken-state shot) and after (post-fix shot) of the same
repro. For TLON-6173 that's: Group → Channels → ⋮ → Channel info → edit pencil →
focus Name → dismiss keyboard → header back/**Save** stay on-screen and tappable.
