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
   - Branch off `develop`: `git checkout -b <user>/tlon-<NNNN>-<slug>`
     (the `tlon-<NNNN>` segment auto-links the PR to the Linear issue).
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

## Verifying on-device — why a rebuild is required

The installed preview app (`io.tlon.groups.preview`) is **debuggable but embeds
its JS bundle** and boots straight into the app (no dev-launcher screen). Because
of that:

- Starting Metro and reloading does **not** apply your change — the app never
  requests a bundle from Metro (confirmed by no bundling line in the Metro log),
  and the `expo-development-client` deep link is ignored when it's already running
  the embedded bundle.
- The only way to get the fix onto the device is a **native rebuild** that bundles
  the current source (which now includes your fix).

## The rebuild (non-destructive)

Prereqs present on a typical tlon-apps macOS dev box:

- JDK 17: `/opt/homebrew/opt/openjdk@17`
- Android SDK: `/opt/homebrew/share/android-commandlinetools` (platforms + build-tools)

Steps:

```bash
# 1. Point Gradle at the SDK (android/local.properties, git-ignored)
echo "sdk.dir=/opt/homebrew/share/android-commandlinetools" \
  > apps/tlon-mobile/android/local.properties

# 2. Build + install the preview debug variant (matches io.tlon.groups.preview).
#    Run in the BACKGROUND — a cold build is ~10-20 min.
cd apps/tlon-mobile/android
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
./gradlew :app:installPreviewDebug -x lint
```

Watch for `BUILD SUCCESSFUL` / `Installed on` (success) or `BUILD FAILED` /
`FAILURE:` (with an `adbx.sh stayon` set so the device screen stays awake).

### Data-safety rule: never uninstall

Reinstalling over the existing app is safe **as long as you do not uninstall it**.
If the debug signature matches the installed one, `adb install -r` preserves app
data and the user's login. If signatures differ, the install simply **fails**
(no data loss) — it does not silently wipe. So: never run `adb uninstall`. Worst
case is "couldn't install, report that", never "logged the user out of their real
account". If it fails on signature mismatch, tell the user rather than forcing it.

## Capture the proof

After it installs, reproduce the exact failing steps from the Linear repro,
screenshot the corrected behavior, and view the shot to confirm. The deliverable
is a before (the filed broken-state shot) and after (post-fix shot) of the same
repro. For TLON-6173 that's: Group → Channels → ⋮ → Channel info → edit pencil →
focus Name → dismiss keyboard → header back/**Save** stay on-screen and tappable.
