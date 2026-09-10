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

## Before anything

```bash
node .agents/skills/tlon-workflow-doctor/check.mjs
```

If any line says `fix`, use the tlon-workflow-doctor skill and come back. Do not work around a missing tool.

## The loop

### 1. A fresh worktree

From the repository root:

```bash
git fetch --prune origin
git worktree add -b <handle>/<topic> .worktrees/<name> origin/develop
cd .worktrees/<name>/apps/tlon-mobile
stim worktree warm --refresh
```

The default branch is `develop`; every branch starts there and every PR targets it. Branches are named `<handle>/<topic>` (`gh api user --jq .login` is your handle). `.worktrees/` is gitignored at any depth.

`warm` copies the ignored state (`node_modules`, `ios/Pods`, `.env.local`) from the main checkout into this worktree. `--refresh` first brings that checkout up to date under a lock: it fetches, fast-forwards its branch, and installs dependencies and pods only when their lockfiles moved. Wait for it to exit 0 before running anything else here.

In this workflow the main checkout is a seed, not a workspace: every worktree is a copy of it, so keeping it clean and on `develop` is what makes it worth copying. `--refresh` refuses a dirty or detached one and prints the git line that clears it. Clear it rather than dropping `--refresh`; a stale seed hands its staleness to every worktree made from it.

### 2. Run the app

```bash
stim start
stim ios
stim android --variant productionDebug
stim logs --errors        # exit 0 and "No matching log records" on stderr is the pass
```

The Android app builds two flavors, `production` (`io.tlon.groups`) and `preview` (`io.tlon.groups.preview`), so the variant goes on every `stim android` call. Stim's summary names the device it used; use that exact id below. `ready` describes the process, not the screen: this app needs roughly another minute to paint its first screen.

### 3. Sign in

Most reproductions need a signed-in app. The phone and email paths send a 2FA code an unattended run cannot read, so use a self-hosted dev ship instead. Put its URL and `+code` in `apps/tlon-mobile/.env.local`, which is gitignored and travels into every worktree through `warm`:

```bash
DEFAULT_SHIP_LOGIN_URL=https://your-ship.tlon.network
DEFAULT_SHIP_LOGIN_ACCESS_CODE=xxxxxx-xxxxxx-xxxxxx-xxxxxx
```

They are read at build time by `app.config.ts`, so a build made before you set them will not have them: set them before `stim ios` / `stim android`, or rebuild.

With both set, a debug build fills the login form for you, so signing in is four taps and no typing:

```bash
agent-device replay .agents/skills/tlon-workflow/sign-in.ad --keep-session --session <name>
```

That script is a recording of these four, and holds taps only -- the credentials never appear in it, because the build already filled the fields:

1. "Have an account? Log in" on the welcome screen, which opens an action sheet.
2. "Or configure self hosted" at the bottom of that sheet.
3. "Connect", top right of the Connect Ship header. Both fields are already filled and the button is already enabled.
4. "Next", top right of the Usage Statistics screen.

If `replay` reports a divergence, the copy moved. It prints ranked selector suggestions; drive the four by hand and re-record rather than editing the script:

```bash
agent-device find "Have an account? Log in" click --session <name> --settle
agent-device find "Or configure self hosted" click --session <name> --settle
agent-device find "Connect" click --session <name> --first --settle
agent-device find "Next" click --session <name> --settle
```

Two things about that flow are worth knowing before you debug it. The prefill itself is not `__DEV__`-gated, but the pre-validation that enables `Connect` without visiting each field is -- so in a release build the fields are filled and `Connect` is disabled until each one is touched. And a `tlon.network` URL is rejected outside `__DEV__`, with a message telling you to use email and password.

This yields an `authType: 'self'` session. It gets you into the app; it does not exercise the hosting-account flows (node status, revival, bot config). If a task needs those, say so rather than faking it.

If the variables are not set, `check.mjs` reports it as a note and sign-in needs a person. Ask rather than attempting the phone or email path.

### 4. Capture the current behavior

For a bug or a change to existing behavior, record what the app does now, before touching code. A short screen recording is the default; a screenshot only when the state is static and one frame shows it.

```bash
agent-device open io.tlon.groups --platform ios --device <udid> --session <name>
agent-device record start $TMPDIR/<name>/before-ios.mp4 --session <name>
# reproduce
agent-device record stop --session <name>
```

Keep one agent-device session per platform, bound by `--device` to the device Stim reported; both a simulator and an emulator are usually booted here. Keep recordings outside the repository. When a label is too long for the screen, read the text (`agent-device snapshot`) rather than trusting the picture.

### 5. Fix

A JavaScript or TypeScript edit needs no rebuild; Fast Refresh applies it and `stim logs --since 30s --level error` shows what it broke. Run `stim ios` or `stim android` again only after a native input changes. Format with `pnpm format` at the repository root (oxfmt); running prettier over a file rewrites it wholesale.

### 6. Validate with the same repro

Repeat step 4 exactly, into `after-ios.mp4` and `after-android.mp4`, on every platform the change touches. Then `stim logs --errors` again. Evidence is the repro you already recorded, not a new scenario.

### 7. Open the pull request

Read `pr-description.md` in this skill's directory, then fill `.github/pull_request_template.md` section by section. `--attach` uploads the recordings and puts them in the body:

```bash
gh pr create --draft --base develop --title "<title>" --body-file $TMPDIR/<name>/pr.md \
  --attach "$TMPDIR/<name>/before-ios.mp4#Before, iOS" --attach "$TMPDIR/<name>/after-ios.mp4#After, iOS"
gh pr ready <number>
```

Open as a draft, then mark it ready once the evidence is attached and the loop above is done: the Codex reviewer only reviews ready pull requests.

### 8. Follow the review

```bash
node .agents/skills/tlon-workflow/pr-watch.mjs <number>
```

It blocks until the pull request gets a review, a review comment, or a comment from the Codex reviewer (`chatgpt-codex-connector[bot]`) or from a repository owner, member, or collaborator, prints each as one JSON line (`kind`, `author`, `path`, `line`, `url`, `body`), and exits. Anyone else on this public repository is ignored, and so are your own comments. Run it in the background so it wakes you; run it again after you respond. When it prints `{"kind":"closed","merged":true}`, go to step 9.

For each item: fix what is real, push, reply in that thread with what changed (`gh api repos/{owner}/{repo}/pulls/<number>/comments/<id>/replies -f body=...` for a review comment, `gh pr comment` otherwise), and re-capture evidence if the visible behavior changed. Push back, with reasons, on what is not real.

### 9. Clean up

From the worktree, after the pull request is merged or closed, and after asking the user:

```bash
stim stop
stim worktree remove
```

`remove` deletes the worktree and parks the simulator or emulator it owned. The git branch stays.

## Two things Stim prints that look wrong and are not

`waited 6m51s for .../<other>'s build -> installed from cache` on an Android build: two worktrees on the same commit share one compile. And `launch err` inside a run that ends `OK`: read the summary line, not the phase transcript.
