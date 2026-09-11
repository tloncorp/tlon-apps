---
name: tlon-workflow
description: Use when taking a Tlon Messenger mobile task from a fresh worktree to a merged pull request: reproducing or fixing something in the iOS or Android app, validating it on a simulator or emulator, opening the PR with evidence, and following its review.
---

# Tlon mobile workflow

One task, one worktree, one pull request. Stim owns the Metro port, the device, and the build caches; agent-device drives the screen; `gh` carries the evidence; a watcher tells you when a reviewer spoke.

Stim's own guide is the reference for its commands and refusals. Read it once per session:

```bash
stim guide agent
```

Everything below is written from the **repository root**. Steps 2 onward run from `apps/tlon-mobile`, so give this skill's scripts an absolute path rather than a relative one from the wrong directory.

## Before anything

From the **source checkout**, not a worktree, and unsandboxed:

```bash
node .agents/skills/tlon-workflow-doctor/check.mjs
```

If any line says `fix`, use the tlon-workflow-doctor skill and come back. Do not work around a missing tool.

Run it in the source checkout because it reads `apps/tlon-mobile/.env.local`, which a worktree does not have until `warm`. Run it unsandboxed because under a shell sandbox `gh auth status` cannot reach the keyring and reports a false `not authenticated`.

## The loop

### 1. A fresh worktree

```bash
git fetch --prune origin
git worktree add -b <handle>/<topic> .worktrees/<name> origin/develop
cd .worktrees/<name>/apps/tlon-mobile
stim worktree warm --refresh
```

The default branch is `develop`; every branch starts there and every PR targets it. Branches are named `<handle>/<topic>` (`gh api user --jq .login` is your handle). `.worktrees/` is gitignored at any depth.

`git worktree add` writes `.git/config`, so it needs an unsandboxed shell. Sandboxed it half-fails: no worktree, but the branch is created, so the retry stops with `a branch named '<...>' already exists`. Delete the branch before retrying.

`warm` copies the ignored state from the source checkout into this worktree: `node_modules`, `ios/Pods`, `.env.local`, and `.claude/` with whatever settings it holds. `--refresh` first brings that checkout up to date under a lock -- it fetches, fast-forwards its branch, and installs dependencies and pods only when their lockfiles moved. Wait for it to exit 0 before running anything else here.

In this workflow the source checkout is a seed, not a workspace: every worktree is a copy of it, so keeping it clean and on `develop` is what makes it worth copying. `--refresh` refuses a dirty or detached one and prints the git line that clears it. Clear it rather than dropping `--refresh`; a stale seed hands its staleness to every worktree made from it.

### 2. Run the app

**One build at a time.** Both are memory-hungry, and running `xcodebuild` and Gradle together makes D8 fail with `java.lang.OutOfMemoryError: Java heap space` (`org.gradle.jvmargs=-Xmx2048m` in `android/gradle.properties`). Overlapping them costs more than serialising them does.

```bash
stim start
stim ios
stim android                              # only after ios has finished
stim logs --errors                        # exit 0 and "No matching log records" on stderr is the pass
```

Android defaults to **`productionDebug`** (`io.tlon.groups`), committed as `android.variant` in `apps/tlon-mobile/.stim.json`, so plain `stim android` is right and `--variant` is not needed. For the preview flavor (`io.tlon.groups.preview`), ask for it:

```bash
stim android --variant previewDebug
```

The two debug variants are `productionDebug` and `previewDebug`. Without that committed setting `assembleDebug` produces an APK per flavor and nothing says which to install, so Stim refuses rather than guess.

Use `stim logs --errors`, not `--since <n> --level error`: the narrower form filters out the `hiddenapi ... AccessibilityNodeInfo` noise agent-device's own snapshots generate on Android.

`ready` describes the process, not the screen: this app needs roughly another minute to paint its first screen.

### 3. Sign in

Most reproductions need a signed-in app. Put a self-hosted dev ship's URL and `+code` in `apps/tlon-mobile/.env.local`, which is gitignored and travels into every worktree through `warm`:

```bash
DEFAULT_SHIP_LOGIN_URL=https://your-ship.tlon.network
DEFAULT_SHIP_LOGIN_ACCESS_CODE=xxxxxx-xxxxxx-xxxxxx-xxxxxx
```

They are read at build time by `app.config.ts`, so a build made before you set them will not have them: set them first, or rebuild.

With both set, a debug build fills the login form, so signing in is four presses and no typing:

```bash
agent-device find "Have an account? Log in" click --session <name> --settle
agent-device find "Or configure self hosted" click --session <name> --settle
agent-device find "Connect" click --session <name> --first --settle
agent-device find "Next" click --session <name> --settle
```

That is the welcome screen, the bottom of the action sheet it opens, the Connect Ship header button (both fields already filled, already enabled), and the Usage Statistics header. A notifications prompt follows; dismiss it.

The prefill itself is not `__DEV__`-gated, but the pre-validation that enables `Connect` without visiting each field is -- so in a release build the fields are filled and `Connect` stays disabled until each is touched. A `tlon.network` URL is rejected outside `__DEV__`.

This yields an `authType: 'self'` session. It gets you into the app; it does not exercise the hosting-account flows (node status, revival, bot config).

`DEFAULT_TLON_LOGIN_EMAIL` and `DEFAULT_TLON_LOGIN_PASSWORD` prefill the hosted path the same way, for a task that needs a hosting account. With neither pair set, sign-in needs a person: the phone and email paths send a 2FA code an unattended run cannot read. Ask rather than attempting them.

### 4. Capture the current behavior

For a bug or a change to existing behavior, record what the app does now, before touching code. A screen recording is the default; a screenshot only when the state is static and one frame shows it.

```bash
agent-device devices                       # names, not udids
agent-device open io.tlon.groups --platform ios --device "stim-<label> (<model> <runtime>)" --session <name>
agent-device record start /absolute/path/before-ios.mp4 --session <name>
agent-device press "<selector>" --session <name> --settle
agent-device record stop --session <name>
```

`--device` takes the **name** agent-device lists, not the udid Stim prints; a udid gives `DEVICE_NOT_FOUND`. `press` is the interaction command -- there is no `tap`. Keep one session per platform: this repository usually has both a simulator and an emulator booted.

Write recordings to an absolute path. `$TMPDIR` differs between sandboxed and unsandboxed shells, so a file written in one is invisible from the other.

When a label is too long for the screen, read the text (`agent-device snapshot`) rather than trusting the picture.

### 5. Fix

A JavaScript or TypeScript edit needs no rebuild; Fast Refresh applies it, and `stim logs --errors` shows what it broke. Run `stim ios` or `stim android` again only after a native input changes. Format with `pnpm format` at the repository root (oxfmt); running prettier over a file rewrites it wholesale.

Commit as you go. Everything after this step reads the branch, not the working tree: the review diff in step 7 and the pull request in step 8 both carry only what is committed.

### 6. Validate with the same repro

Repeat step 4 into `after-ios.mp4` and `after-android.mp4`, on every platform the change touches, then `stim logs --errors` again. Evidence is the repro you already recorded, not a new scenario.

**Re-snapshot first.** Fast Refresh remounts the tree, so a ref captured before the edit now points at a different element -- reusing one silently drives the wrong screen.

### 7. Get an independent review

Before opening the pull request, put the diff in front of a fresh agent -- one that has not seen your reasoning. That is the whole point of it: it cannot rationalise a choice it did not make, and it reads what you wrote rather than what you meant.

Give it three things: the task as it was originally stated, the diff (`git diff origin/develop...HEAD`), and what to be adversarial about. Do not give it your notes, your reasoning, or the alternatives you rejected -- that primes it to agree with you.

Ask for correctness first, with concrete inputs and the resulting wrong behavior, then whether the change actually does what the task asked, then what is untested.

Fix what is real. Push back, with reasons, on what is not: a fresh agent is confidently wrong often enough that applying a finding you cannot verify is worse than ignoring it. If a fix changes visible behavior, re-capture the evidence from step 4 before continuing.

This is cheap and it is not the same as the review the pull request gets later. This one catches your own mistakes before anyone else spends attention on them.

### 8. Open the pull request

Read `pr-description.md` in this skill's directory, then fill `.github/pull_request_template.md` section by section.

```bash
gh pr create --draft --base develop --title "<title>" --body-file /absolute/path/pr.md \
  --attach /absolute/path/before-ios.mp4 --attach /absolute/path/after-ios.mp4
```

**Video takes no alt text.** `--attach '<file>#<label>'` is image-only and fails outright with `cannot set alt text on video`, creating no pull request. `gh` also does not rewrite a body reference to a video, so `![](./before-ios.mp4)` stays a broken relative link while the uploaded URLs are appended unlabeled at the end. To label them, attach bare paths and then splice the returned `user-attachments` URLs into the body:

```bash
gh pr view <number> --json body -q .body > /absolute/path/body.md   # edit, then:
gh pr edit <number> --body-file /absolute/path/body.md
gh pr ready <number>
```

Mark it ready once the evidence is in: the Codex reviewer only reviews ready pull requests.

### 9. Follow the review

```bash
node /absolute/path/to/repo/.agents/skills/tlon-workflow/pr-watch.mjs <number>
```

It blocks until the pull request gets a review, review comment, or comment from the Codex reviewer (`chatgpt-codex-connector[bot]`) or from someone with write access, prints each as one JSON line (`kind`, `author`, `path`, `line`, `url`, `body`), and exits. It checks each commenter's actual repository permission, because on a public repository anyone can comment and `author_association` does not imply access. Your own comments are ignored. Run it in the background so it wakes you; run it again after you respond. When it prints `{"kind":"closed","merged":true}`, go to step 10.

For each item: fix what is real, push, reply in that thread with what changed (`gh api repos/{owner}/{repo}/pulls/<number>/comments/<id>/replies -f body=...` for a review comment, `gh pr comment` otherwise), and re-capture evidence if the visible behavior changed. Push back, with reasons, on what is not real.

### 10. Clean up

After the pull request is merged or closed, and after asking the user. **Order matters**: remove the worktree before the branch goes, or `remove` refuses because its commits are no longer on any remote. And leave the worktree before removing it: once it is gone, git cannot run from inside it.

```bash
cd <worktree>/apps/tlon-mobile
stim stop
cd <source checkout>
stim worktree remove .worktrees/<name>   # then, if the branch should go too:
git branch -d <handle>/<topic>
```

`remove` deletes the worktree and parks the simulator or emulator it owned. Never reach for `--force`: it discards uncommitted and untracked files permanently. If it refuses because a commit exists nowhere else, push the branch rather than forcing.

## Under a sandbox

Stim writes to `~/.stim`, talks to the simulator service, and binds the adb port -- all outside a typical shell sandbox. `stim doctor` names this and offers `stim doctor --fix`, which writes an allowance into `.claude/settings.local.json`. That file is your own permission configuration: do not change it because a tool told you to. Run the Stim, agent-device and `gh` calls unsandboxed instead, or ask the user to apply the allowance themselves.

## Two things Stim prints that look wrong and are not

`waited 6m51s for .../<other>'s build -> installed from cache` on an Android build: two worktrees on the same commit share one compile. And `launch err` inside a run that ends `OK`: read the summary line, not the phase transcript.
