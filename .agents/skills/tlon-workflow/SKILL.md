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

Name sessions for this run (`ios-<ticket>-<hhmm>`), and `agent-device close` them when you stop their devices.

Run these one at a time, so a failed step is seen rather than skipped.

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

Use the sessions from step 3, on the udid and serial `stim status` prints for this worktree. Prove the repro first, then record it: "the behavior, not the journey" is only possible once you know the trigger. Otherwise wait for the result's text before `record stop`, then check that `record start` succeeded and, after `record stop`, the clip's duration and last frame.

**A clip is the default, but two cases need stills as well, and attaching only the clip fails them.** A state that lasts under about a second -- a delivery indicator between send and server echo -- is recorded from before the trigger and then proven with frames (`ffmpeg -ss <t> -i <clip> -frames:v 1 <png>`), since no end state will be there to wait for and a reviewer scrubbing the clip will miss it. A difference between two discrete states -- with the indicator and without it, empty and populated, collapsed and expanded -- is proven by a still of each, because the claim is a comparison and a recording forces the reviewer to hold one side in their head. Attach both the stills and the clip: the stills carry the claim, the clip shows it is real motion and not two staged screenshots.

For a difference that lives in one component rather than in a flow, a pair of Cosmos specimens beats both (see step 6). Two adjacent specimens differing only in the prop under test stay checkable by anyone who opens Cosmos, and fail visibly when someone later reintroduces the bug -- which no screenshot in a merged pull request can do.

To capture a "before" after the fix is already committed (a reviewer asks for another case), swap the file, not the branch: `git checkout origin/develop -- <path>`, record under Fast Refresh, then `git checkout HEAD -- <path>`.

`--quality high` records at device resolution; the default is 220x480, which loses anything smaller than a button. `press` and `longpress` are the interaction commands -- there is no `tap`. Dialogs, action sheets and long-press targets resolve by `[button]` ref from a fresh snapshot, not by `text=`; in a sequence too fast to re-snapshot, press coordinates from the last snapshot. The chat list does not respond to `scroll`; `swipe x1 y1 x2 y2` moves it, and the header Search is the reliable way to a group (tap the result twice: the first tap only dismisses the keyboard). On Android the list collapses into one label, and a ref has opened another agent's group: read the channel header before posting anything, and tap the list by screenshot coordinates.

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

**Re-snapshot first.** Fast Refresh remounts the tree, so a ref captured before the edit now points at a different element -- reusing one silently drives the wrong screen. An edit under `packages/` may be a full reload rather than a refresh: navigation resets to Home and the sign-in prompts return on both platforms (`alert dismiss`, `Not now`). After any `packages/` edit, `stim reload ios` and `stim reload android` before capturing, and confirm `stim logs --errors` is clean: an edit that adds an export in one module and imports it in another has left both apps throwing `ReferenceError: Property '<name>' doesn't exist` until reloaded, with Metro's bundle already correct. On iOS the reload itself can crash the app natively (`EXC_BAD_ACCESS` in `EXPermissionsService registerRequesters`, an expo-modules-core race, expo/expo#45314): `stim ios` relaunches from cache in seconds.

Keep `stim logs --since` windows short.

**Web and Cosmos.** `packages/app`, `packages/ui` and `packages/shared` ship to web and desktop as well as to the app, so a change under any of them that is layout or shared-component behavior needs looking at there too -- and the desktop navigation is a different tree from the mobile one, so "it works in the app" says nothing about it. A change confined to `apps/tlon-mobile`, or to a `.ios.tsx` / `.android.tsx` file, does not.

Cosmos is the fastest way in for a component-level change, and the only one that renders a state without driving the app to it:

```bash
cd <worktree> && pnpm run cosmos:web     # UI on 5555, renderer on 5050
```

It needs `packages/editor/dist` built (`pnpm run build:packages` if it is missing). Fixtures live in `packages/app/fixtures`; the UI lists a file's named exports, so `ChatMessage.fixture.tsx` appears as `ChatMessage / MessageStates` and the like.

**Give it a port, or you will read another worktree's code as your own.** `cosmos.config.json` pins 5555, so every worktree wants the same one. Pass `--port` instead:

```bash
cd <worktree>/apps/tlon-web && npx cosmos --port <n>
```

`cosmos --help` lists only `--help` and `--version`, which is misleading -- react-cosmos parses argv with yargs and `getPort` prefers `--port` over the config file. The flag works; it is just undocumented. The renderer is a second server, based at 5050, and it needs no flag: it retries upward when its port is taken (`portRetries`, default 10), so a second worktree lands on 5051 by itself and says so.

Same for the full web app, where the flag is documented:

```bash
pnpm --filter tlon-web exec vite --port <n> --strictPort
```

`--strictPort` is the point of that one. Without it Vite silently moves to the next free port, so you get a server that works and serves the wrong worktree. Web also needs `.env.local` in `apps/tlon-web` with `VITE_SHIP_URL`; `stim worktree warm` carries it over with the rest of the ignored files.

When you open a port you did not just start -- reusing a server from earlier, or reaching for 5555 out of habit -- check whose it is first:

```bash
lsof -a -p "$(lsof -nP -iTCP:<port> -sTCP:LISTEN -t | head -1)" -d cwd -Fn
```

The path it prints is the worktree being served. A wrong answer here looks exactly like a right one: the page renders, the fixtures load, and the code is someone else's.

Two things that shape how you can verify: the Cosmos UI (5555) and its renderer (5050) are **different origins**, so page-level JavaScript cannot reach into the fixture's DOM to measure it -- screenshots and accessibility reads work, `document.querySelector` across the frame does not. And headless Chrome renders the Cosmos page blank however long you give it, so a browser you can see is the only way to capture one.

### 7. Get an independent review

Before opening the pull request, put the diff in front of a fresh agent -- one that has not seen your reasoning. That is the whole point of it: it cannot rationalise a choice it did not make, and it reads what you wrote rather than what you meant.

Give it three things: the task as it was originally stated, the diff (`git diff origin/develop...HEAD`), and what to be adversarial about. Do not give it your notes, your reasoning, or the alternatives you rejected -- that primes it to agree with you -- and tell it to ignore `.evidence/` and the commit messages, which carry the same notes in another form.

Ask for correctness first, with concrete inputs and the resulting wrong behavior, then whether the change actually does what the task asked, then what is untested. Tell it the size of the diff and to spend accordingly; a ten-line change does not need ten minutes.

Fix what is real. Push back, with reasons, on what is not: a fresh agent is confidently wrong often enough that applying a finding you cannot verify is worse than ignoring it. If a fix changes visible behavior, re-capture the evidence from step 4 before continuing.

This is cheap and it is not the same as the review the pull request gets later. This one catches your own mistakes before anyone else spends attention on them.

### 8. Open the pull request

Read `pr-description.md` in this skill's directory, then fill `.github/pull_request_template.md` section by section, and run the fresh-eyes pass it describes before posting.

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

**Then ask for a human.** Once CI is green and every Codex thread has an answer, the pull request still needs someone with write access to look at it, and nobody is watching for it. Request a reviewer yourself at that point -- also on `{"kind":"timeout"}`, where nothing has happened for the whole budget: a quiet pull request is the one most in need of a name on it. Say in your report who you tagged and why.

This repository has no `CODEOWNERS`, so the signal is who actually maintains the files you touched:

```bash
git log --since='12 months ago' --format='%an' -- <changed path> | grep -v '\[bot\]' | sort | uniq -c | sort -rn
gh api "repos/tloncorp/tlon-apps/commits/<sha>" --jq '.author.login'   # name -> login
gh api "repos/tloncorp/tlon-apps/collaborators/<login>/permission" --jq '.permission'
gh pr edit <number> --add-reviewer <login>
```

Weight by the file the change actually lives in, not by file count: the component you edited matters more than the fixture you added a specimen to. Take the top one or two, not everyone who ever touched it.

**Check each candidate still has access before tagging.** People leave, and `git log` remembers them forever -- tagging a former colleague is noise that never gets answered and quietly delays the review.

Read the endpoint's answer carefully, because the obvious reading of it is wrong. On a public repository it does **not** 404 for someone who has left: everyone can read a public repository, so a real account that is no longer a collaborator comes back `read`. A 404 means only that the login is not a GitHub user at all. So the departure signal is the value, not the status:

| answer | means |
| --- | --- |
| `admin`, `maintain`, `write` | current collaborator -- tag them |
| `read` | a real account with no access here: left, or never had it |
| 404 `is not a user` | the login does not exist; you mis-mapped the name |

Accept only `admin`, `maintain` or `write`, and move to the next candidate on anything else. `gh pr edit --add-reviewer` fails on a non-collaborator anyway, but by then you have already lost the round. This is the same check `pr-watch.mjs` makes before it wakes you for a comment, and for the same reason: on a public repository, having once written the file implies nothing about being able to approve it now.

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

`xcrun simctl` needs the same treatment, and it fails in a way that reads like a broken Xcode rather than a blocked call: every device disappears. `simctl list devices` returns an empty list, with `Operation not permitted` on its CoreSimulator log and a refused connection to `CoreSimulatorService` above it. Nothing is wrong with the toolchain -- rerun it unsandboxed and the devices are all there. Do not go diagnosing Xcode on the strength of an empty list.
