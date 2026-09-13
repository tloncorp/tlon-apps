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

Everything below is written from the **repository root**, and every `stim` command runs from `apps/tlon-mobile`: Stim resolves a workspace per directory, so from anywhere else it acts on a workspace that is not the app's. Give this skill's scripts an absolute path rather than a relative one from the wrong directory.

## Before anything

Unsandboxed:

```bash
node .agents/skills/tlon-workflow-doctor/check.mjs
```

If any line says `fix`, use the tlon-workflow-doctor skill and come back. Do not work around a missing tool.

It inspects the source checkout wherever it is run from. Run it unsandboxed because under a shell sandbox `gh auth status` cannot reach the keyring and reports a false `not authenticated`.

## The loop

### 1. A fresh worktree

First, what already exists for this ticket: `gh pr list --search <ticket id> --state all` and the links on the ticket itself. An open or closed pull request, or a remote branch, changes what you do next, and finding it after your own investigation is the expensive way. A closed one from an earlier run: note its branch name so yours differs, and read its diagnosis only after you have reached your own, for the same reason step 7 keeps your notes from the reviewer. Verify what you take from it, and do not cite it in your description (that is process, not diff).

```bash
git fetch --prune origin
git ls-remote --heads origin <handle>/<topic>       # empty, or pick another name
git worktree add -b <handle>/<topic> .worktrees/<name> origin/develop
cd .worktrees/<name>/apps/tlon-mobile
stim worktree warm --refresh
```

The default branch is `develop`; every branch starts there and every PR targets it. Branches are named `<handle>/<topic>`; take the handle from the existing branches (`git branch -r | grep -o '^  origin/[^/]*/' | sort | uniq -c`), not from your GitHub login. A name that already exists on origin, usually from an earlier run on the same ticket, cannot be pushed without force; pick another. `.worktrees/` is gitignored at any depth.

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

A cold `stim ios` takes 6 to 11 minutes here, longer than most tool timeouts. Run it in the background, or with the longest timeout your tools allow. If a call times out anyway, run the same command again: the build outlives the shell, and the retry waits for it and installs the result rather than compiling twice.

Android defaults to **`productionDebug`** (`io.tlon.groups`), committed as `android.variant` in `apps/tlon-mobile/.stim.json`, so plain `stim android` is right and `--variant` is not needed. For the preview flavor (`io.tlon.groups.preview`), ask for it:

```bash
APP_VARIANT=preview stim start
APP_VARIANT=preview stim ios --scheme Landscape-preview
APP_VARIANT=preview stim android --variant previewDebug
```

The preview app id is `io.tlon.groups.preview`; open that with agent-device. All three need `APP_VARIANT=preview`, as the repository's `ios:preview` and `android:preview` scripts do: `app.config.ts` reads it for the scheme and bundle id, and the Gradle variant alone leaves the app configured as production. The two debug variants are `productionDebug` and `previewDebug`. Without that committed setting `assembleDebug` produces an APK per flavor and nothing says which to install, so Stim refuses rather than guess.

Use `stim logs --errors`, not `--since 5m --level error`: the narrower form filters out the `hiddenapi ... AccessibilityNodeInfo` noise agent-device's own snapshots generate on Android.

`ready` describes the process, not the screen: this app needs roughly another minute to paint its first screen.

With several agents' devices up, a boot can miss its window: `stim android` reports `STIM_NO_DEVICE ... did not finish booting within 120s`, and its remedy talks about `JAVA_HOME` and system images. When other emulators are running, that is memory pressure, not configuration; `stim status` shows what is live, stop what you do not need, and run the same command again.

### 3. Sign in

Most reproductions need a signed-in app. Put a self-hosted dev ship's URL and `+code` in `apps/tlon-mobile/.env.local` **of the source checkout**, which is gitignored and travels into every worktree through `warm`; written into a worktree it leaves with the worktree:

```bash
DEFAULT_SHIP_LOGIN_URL=https://your-ship.tlon.network
DEFAULT_SHIP_LOGIN_ACCESS_CODE=xxxxxx-xxxxxx-xxxxxx-xxxxxx
```

They are read at build time by `app.config.ts`, and `warm` copies the file only when the worktree has none. Set them before step 1. If you are setting them now, copy the file into this worktree's `apps/tlon-mobile/` as well, then rebuild; a rebuild alone does not fetch it.

Open one agent-device session per platform first, on the devices `stim status` lists for this worktree:

```bash
stim status                                # this worktree's simulator udid and emulator serial
agent-device open io.tlon.groups --platform ios --udid <udid> --session <name>
agent-device open io.tlon.groups --platform android --serial <serial> --session <name>
```

With both set, a debug build fills the login form, so signing in is four presses and no typing. Each screen takes a moment to arrive, and `--settle` only waits for the current one to go quiet, so wait for the next screen's text before pressing on it:

```bash
agent-device press 'text="Have an account? Log in"' --session <name> --settle
agent-device wait text "Or configure self hosted" --session <name>
agent-device press 'text="Or configure self hosted"' --session <name> --settle
agent-device wait text "Ship URL" --session <name>
agent-device press 'text="Connect"' --session <name> --settle
agent-device wait text "Usage Statistics" --session <name>
agent-device press 'text="Next"' --session <name> --settle
agent-device alert dismiss --session <name>
```

Name sessions for this run (`ios-<ticket>-<hhmm>`), not the ticket alone, and `agent-device close` them before starting devices again after a `stim stop`: a session from an earlier run on the same ticket keeps its claim on a device after Stim has parked and re-adopted it, and `open` then fails with `DEVICE_IN_USE ... claimed by session <name>`. `agent-device session list` shows them; `agent-device close --session <name>` releases one whose device `stim status` says is yours.

On Android run these one at a time, not as one `&&` chain: a snapshot takes 3 to 10 seconds on an emulator, so a `wait` in a chain times out and the rest never runs; give `wait` a longer timeout (`wait text "..." 30000`). On iOS, "the iOS runner is still finishing a previous command that exceeded its execution watchdog" means the runner is crawling a large accessibility tree, usually Home's chat list; closing the session does not stop it. Wait it out (a few minutes), and do not `snapshot` Home again: leave it by `press 'text="Search"'` or `press 'text="Add a chat"'`, or by `screenshot` and coordinates.

That is the welcome screen, the bottom of the action sheet it opens, the Connect Ship header button (both fields already filled, already enabled), the Usage Statistics header, and the notifications prompt that follows. iOS also shows a keyboard tip ("Speed up your typing...", `Continue`) on the first text entry, which swallows the next tap. A "Stay in the loop" sheet appears later over Home on both platforms and blocks the bottom of the list; `press 'text="Not now"'` when it does. Both prompts come back after every full reload, not only the first. On Android the notifications prompt can arrive after `alert dismiss` has already returned; `wait 3000` before it, or `screenshot` and dismiss what is there. Use `press` with a `text="..."` selector, not `find ... click`: on Android this app's screens collapse into a few group nodes, so `find` matches nothing while the selector still resolves. On iOS a label that appears twice on screen (a `Back` button and its text, an action-sheet row) does not resolve by `text=`; snapshot and press the `[button]` ref. `--settle` is only accepted on `press`, `click`, `fill`, `longpress`, `scroll` and `back`.

The prefill itself is not `__DEV__`-gated, but the pre-validation that enables `Connect` without visiting each field is -- so in a release build the fields are filled and `Connect` stays disabled until each is touched. A `tlon.network` URL is rejected outside `__DEV__`.

This yields an `authType: 'self'` session. It gets you into the app; it does not exercise the hosting-account flows (node status, revival, bot config).

`DEFAULT_TLON_LOGIN_EMAIL` and `DEFAULT_TLON_LOGIN_PASSWORD` prefill the hosted path the same way, for a task that needs a hosting account. With neither pair set, sign-in needs a person: the phone and email paths send a 2FA code an unattended run cannot read. Ask rather than attempting them.

### 4. Capture the current behavior

For a bug or a change to existing behavior, record what the app does now, before touching code. A screen recording is the default; a screenshot only when the state is static and one frame shows it.

**Which platforms.** One platform is enough, the one the ticket names or iOS, when the change is logic only, or UI built from components that behave the same everywhere (`View`, `Text`, layout, styling). Both platforms, before and after, when the change touches anything with platform quirks: `TextInput`, `Switch`, `ScrollView` and list behavior, keyboard, gestures, the WebView editor, permissions, notifications, a native module, `Platform.select`, or a `.ios.tsx` / `.android.tsx` file; or when the ticket reports a symptom on one platform only. When unsure, both. Decide before touching code: a "before" on a platform you skipped is not recoverable once the fix is in.

Record the behavior, not the journey. Navigate to the screen first, start recording, do the one action that triggers it, stop as soon as the result is on screen. A reviewer watches these; sign-in, navigation and dead time are not evidence. Aim for under 30 seconds.

```bash
agent-device record start <worktree>/.evidence/before-ios.mp4 --quality high --session <name>
agent-device press 'text="<label>"' --session <name> --settle
agent-device longpress '@<ref>' --session <name> --settle
agent-device record stop --session <name>
```

Use the sessions from step 3; identify a device by the udid or serial `stim status` prints for this worktree, never by name, since Stim re-adopts parked devices and the name can still be a previous task's. Prove the repro first, then record it: "the behavior, not the journey" is only possible once you know the trigger. A transient state (an indicator that shows for under a second) is recorded from before the trigger and proven afterwards with frames (`ffmpeg -ss <t> -i <clip> -frames:v 1 <png>`), since no end state will be there to wait for. Otherwise wait for the result's text before `record stop`, then check the duration and the last frame. Android capture stops about a second after the last input whatever you wait afterwards, so the result must be on screen within that second; a clip that missed it is recorded again with the wait moved before the last input. Read `record start`'s output before acting: a refused start prints only a `Diagnostics Log:` line and the run continues unrecorded. Before the first `record start` on an emulator, `adb -s <serial> shell rm -f /sdcard/agent-device-recording-active.json`: a re-adopted emulator carries a previous run's marker, and `record start` refuses with "native recovery evidence already exists".

To capture a "before" after the fix is already committed (a reviewer asks for another case), swap the file, not the branch: `git checkout origin/develop -- <path>`, record under Fast Refresh, then `git checkout HEAD -- <path>`.

`--quality high` records at device resolution; the default is 220x480, which loses anything smaller than a button. `press` and `longpress` are the interaction commands -- there is no `tap`. Dialogs, action sheets and long-press targets resolve by `[button]` ref from a fresh snapshot, not by `text=`; in a sequence too fast to re-snapshot, press coordinates from the last snapshot. The chat list does not respond to `scroll`; `swipe x1 y1 x2 y2` moves it, and the header Search is the reliable way to a group (tap the result twice: the first tap only dismisses the keyboard). Home's accessibility tree is heavy enough that `snapshot` or `press --settle` on it hangs the iOS runner; navigate off Home by `screenshot` and coordinates. On Android the list collapses into one label, and a ref has opened another agent's group: read the channel header before posting anything, and tap the list by screenshot coordinates.

Attachments: the emulator has no photos (`adb push` one, then `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://<path>`); on iOS grant photo access before opening the app (`xcrun simctl privacy <udid> grant photos io.tlon.groups`), because `alert dismiss` on the permission prompt denies it and the recovery relaunches the app; the composer's `+` has no label, so it takes coordinates.

Evidence goes in `.evidence/` at the root of your worktree: gitignored, so it cannot be committed, and removed with the worktree in step 10. Give it as an absolute path, because `$TMPDIR` differs between sandboxed and unsandboxed shells. After `record stop`, check the file exists; on Android a second recording in the same session has been seen to produce nothing without an error.

Reproduce in a throwaway group named after the task and the time (`TLON-1234 repro 1435`), not the default "Untitled group": other agents make those too, earlier runs of the same ticket leave theirs behind, and on Android the group list collapses into one label, so same-named groups are indistinguishable. Making one: Home `Add a chat` → `New group` → `Basic group` (a chat, a gallery and a notebook channel) → name → `Next` → `Create group`; on iOS the group-type cards and those two buttons are `[other]` nodes that a ref does not press, so use coordinates from a screenshot. Refs come back from a `--settle` diff as `@eN~sNNN`; use that full form, a bare `@eN` is refused after the tree changed.

Backgrounding, when the ticket or the variation calls for it: `agent-device home --session <name>` on either platform; back with `xcrun simctl launch <udid> io.tlon.groups` on iOS and `adb -s <serial> shell am start -n io.tlon.groups/io.tlon.landscape.MainActivity` on Android. A system activity over the app is `adb shell am start -a android.settings.INPUT_METHOD_SETTINGS`.

When a label is too long for the screen, read the text (`agent-device snapshot`) rather than trusting the picture.

If the steps do not reproduce as written, vary them before concluding anything: leave the channel and re-enter it, act from the other platform's client, background and foreground the app. Then check whether the fix already landed before doubting the ticket: `git log -S '<suspect expression>' --oneline -- <path>` on the code the ticket points at, and the merged pull requests since it was filed. A ticket filed weeks ago is often fixed. If it is, check the other platform before stopping: a fix that landed for the reported platform has left the other one broken. If both are fixed, stop: comment on the ticket naming the pull request that fixed it and the platforms you checked (text and links; the clips stay on disk), and report the same to the user. No pull request.

### 5. Fix

The ticket's diagnosis is a lead, not the cause: confirm the mechanism in code before changing it, and say so in the pull request when the two differ. Then the smallest change that fixes it -- no refactor, no cleanup of what sits next to it.

An edit to application JavaScript or TypeScript needs no rebuild; Fast Refresh applies it, and `stim logs --errors` shows what it broke. Configuration is not application code: after `babel.config.js`, `metro.config.js`, or `app.config.ts` changes, restart with `stim stop` and `stim start`, and run `stim ios` or `stim android` again after a native input changes. Format with `pnpm format` at the repository root (oxfmt); running prettier over a file rewrites it wholesale.

Before running `packages/shared` tests, `npm rebuild better-sqlite3` from the worktree root: the desktop app's postinstall builds the hoisted copy for Electron, and the repository's own `test` script starts with that rebuild for the same reason.

Commit as you go. Everything after this step reads the branch, not the working tree: the review diff in step 7 and the pull request in step 8 both carry only what is committed. Never force-push, and never `git stash`: the stash is shared with every other worktree of this checkout.

### 6. Validate with the same repro

Repeat step 4 into `after-<platform>.mp4` on the platform(s) you recorded before, then `stim logs --errors` again. Evidence is the repro you already recorded, not a new scenario. Say in the pull request which platform(s) you tested and why one was enough, when it was.

**Re-snapshot first.** Fast Refresh remounts the tree, so a ref captured before the edit now points at a different element -- reusing one silently drives the wrong screen. An edit under `packages/` may be a full reload rather than a refresh: navigation resets to Home and the sign-in prompts return on both platforms (`alert dismiss`, `Not now`). After any `packages/` edit, `stim reload ios` and `stim reload android` before capturing, and confirm `stim logs --errors` is clean: an edit that adds an export in one module and imports it in another has left both apps throwing `ReferenceError: Property '<name>' doesn't exist` until reloaded, with Metro's bundle already correct. On iOS the reload itself can crash the app natively (`EXC_BAD_ACCESS` in `EXPermissionsService registerRequesters`, an expo-modules-core race, expo/expo#45314): `stim ios` relaunches from cache in seconds. If the reload leaves the iOS runner hung (every command `COMMAND_FAILED`, "main thread execution timed out"), `agent-device close` and `open` the session.

`stim logs` from the wrong directory is the costly case of that rule: from the worktree root it queries a workspace that does not exist and passes with "No matching log records". Keep `--since` windows short.

### 7. Get an independent review

Before opening the pull request, put the diff in front of a fresh agent -- one that has not seen your reasoning. That is the whole point of it: it cannot rationalise a choice it did not make, and it reads what you wrote rather than what you meant.

Give it three things: the task as it was originally stated, the diff (`git diff origin/develop...HEAD`), and what to be adversarial about. Do not give it your notes, your reasoning, or the alternatives you rejected -- that primes it to agree with you -- and tell it to ignore `.evidence/` and the commit messages, which carry the same notes in another form.

Ask for correctness first, with concrete inputs and the resulting wrong behavior, then whether the change actually does what the task asked, then what is untested. Tell it the size of the diff and to spend accordingly; a ten-line change does not need ten minutes.

Fix what is real. Push back, with reasons, on what is not: a fresh agent is confidently wrong often enough that applying a finding you cannot verify is worse than ignoring it. If a fix changes visible behavior, re-capture the evidence from step 4 before continuing.

This is cheap and it is not the same as the review the pull request gets later. This one catches your own mistakes before anyone else spends attention on them.

### 8. Open the pull request

Read `pr-description.md` in this skill's directory (it sends you to `pr-workflow.md` and its fresh-eyes pass), then fill `.github/pull_request_template.md` section by section.

```bash
git push -u origin <handle>/<topic>
gh pr create --draft --base develop --title "<title>" --body-file <worktree>/.evidence/pr.md \
  --attach <worktree>/.evidence/before-ios.mp4 --attach <worktree>/.evidence/after-ios.mp4 \
  --attach <worktree>/.evidence/before-android.mp4 --attach <worktree>/.evidence/after-android.mp4
```

One `--attach` per recording or screenshot from steps 4 and 6, for every platform you tested; `gh pr create` prompts for a remote when the branch is not pushed, and a prompt in an unattended shell is a hang. `gh` appends the uploaded URLs to the body in `--attach` order, and rewrites a body reference only when it matches the `--attach` string exactly.

**Video takes no alt text.** `--attach '<file>#<label>'` is image-only and fails outright with `cannot set alt text on video`, creating no pull request. `gh` also does not rewrite a body reference to a video, so `![](./before-ios.mp4)` stays a broken relative link while the uploaded URLs are appended unlabeled at the end. Attach bare paths, then move the returned `user-attachments` URLs into the per-platform before/after tables `pr-description.md` describes:

```bash
gh pr view <number> --json body -q .body > <worktree>/.evidence/body.md   # edit, then:
gh pr edit <number> --body-file <worktree>/.evidence/body.md
gh pr ready <number>
```

A change with nothing to show on screen (logic, sync, a script) has no recordings: no `--attach`, no evidence table, and "How did I test?" says what you ran instead.

**Check every clip before attaching it.** `ffprobe -v error -show_entries format=duration -of csv=p=0 <clip>` for the length, and a frame strip to see what is in it:

```bash
ffmpeg -v error -y -i <clip> -vf "fps=1/3,scale=270:-1,tile=6x3" -frames:v 1 -update 1 <worktree>/.evidence/<clip>-strip.png   # one image per clip
```

A clip longer than about 30 seconds, or one that opens on sign-in or navigation, gets cut to the part that shows the behavior. Re-encode; do not stream-copy. Simulator recordings are variable frame rate, and `-c copy` lands the cut on the wrong frame:

```bash
ffmpeg -v error -i <clip> -ss <start> -to <end> -c:v libx264 -preset veryfast -crf 23 -an <clip>.trimmed.mp4
```

Mark it ready once the evidence is in: the Codex reviewer only reviews ready pull requests.

### 9. Follow the review

```bash
node /absolute/path/to/repo/.agents/skills/tlon-workflow/pr-watch.mjs <number>
```

Run it in the foreground, with the longest timeout your shell tool allows; a harness does not wake an agent for a background process. If the call times out before it prints, look at what your harness did with it: one that moved it to the background is still running, so wait on that one and read its output rather than starting a second (two watchers share one seen-state file); one that killed it can be run again, since it keeps what it already reported. It blocks until the pull request gets a review, review comment, or comment from the Codex reviewer (`chatgpt-codex-connector[bot]`) or from someone with write access, then keeps collecting until the round is complete (Codex's status for the head commit and its CI result, which can take twenty minutes after the status), prints everything as one JSON line each (`kind`, `author`, `path`, `line`, `url`, `body`), and exits. Codex's own status comment arrives once, when its review completes, as `{"kind":"codex-status","headSha":...,"findings":<n>}`, where `findings` counts its inline comments on that commit. CI arrives the same way: `{"kind":"ci","status":"failure","failed":[{name,url}]}` as soon as a check fails, or `{"kind":"ci","status":"success"}` once every check on the head commit has passed. It checks each commenter's actual repository permission, because on a public repository anyone can comment and `author_association` does not imply access. Your own replies are ignored by the marker below, not by account: the person reviewing you usually shares your GitHub login, and their comments must wake you. When it prints `{"kind":"closed","merged":true}`, go to step 10.

One run is one round. A failed check is an item like any other: `gh run view --job <job id> --log-failed` (the job id is the last path segment of its url), fix, and it re-runs on the push. For every item in it: fix what is real, reply in that thread with what changed (`kind: review_comment` → `gh api repos/{owner}/{repo}/pulls/<number>/comments/<root>/replies -f body=...`, where `<root>` is the watcher's `replyTo` when set and its numeric `commentId` otherwise, since GitHub only accepts replies to a thread's first comment; `kind: comment` or `review` → `gh pr comment`), and push back, with reasons, on what is not. End every reply and comment you post with the line `<!-- tlon-workflow:agent -->`; it is invisible on GitHub and it is how the watcher tells your replies from a reviewer's. Push once for the whole round, re-capture evidence if the visible behavior changed, then run the watcher again. Codex reviews each push.

Codex reports only what is new on each push; it never repeats an open finding, so `findings: 0` means nothing new, not clean. Keep your own list of every thread the watcher has printed and what you did with it. Stop when every thread on that list has a reply from you (a fix or a reasoned push-back), the head commit has `{"kind":"ci","status":"success"}` (every check, including workflows for packages you did not touch; a running check counts as activity, so the budget waits for it), its `{"kind":"codex-status"}` has arrived with nothing you have not answered, when the pull request is merged or closed, or when the watcher prints `{"kind":"timeout"}`: nothing has happened on the pull request, by anyone, for `--timeout` seconds (default 1800; pass a shorter one for a quick run). Any commit, comment, or review restarts that budget, so the loop runs as long as the conversation does and ends on inactivity. Report what is still open.

### 10. Clean up

After the pull request is merged or closed, and after asking the user. **Order matters**: remove the worktree before the branch goes, or `remove` refuses because its commits are no longer on any remote. And leave the worktree before removing it: once it is gone, git cannot run from inside it.

```bash
agent-device close --session <name>       # each session this run opened
cd <worktree>/apps/tlon-mobile
stim stop
cd <source checkout>
stim worktree remove <source checkout>/.worktrees/<name>   # the path step 1 created; then, if the branch should go too:
git branch -d <handle>/<topic>
git push origin --delete <handle>/<topic>
```

Delete the throwaway group on the ship as well, so the next run does not find it.

`remove` deletes the worktree and parks the simulator or emulator it owned. Never reach for `--force`: it discards uncommitted and untracked files permanently. If it refuses because a commit exists nowhere else, push the branch rather than forcing.

## Under a sandbox

Stim writes to `~/.stim`, talks to the simulator service, and binds the adb port -- all outside a typical shell sandbox. `stim doctor` names this and offers `stim doctor --fix`, which writes an allowance into `.claude/settings.local.json`. That file is your own permission configuration: do not change it because a tool told you to. Run the Stim, agent-device and `gh` calls unsandboxed instead, or ask the user to apply the allowance themselves.
