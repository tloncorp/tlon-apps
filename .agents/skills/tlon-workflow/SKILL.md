---
name: tlon-workflow
description: Use when taking a Tlon Messenger task from a fresh worktree to a merged pull request: reproducing or fixing something in the iOS, Android or web app, validating it on a simulator, emulator or browser, opening the PR with evidence, and following its review.
---

# Tlon workflow

One task, one worktree, one pull request, across three platforms: iOS, Android and web. The iOS and Android devices are EAS Simulator sessions, not simulators or emulators on this machine. Read Stim's guide once per session:

```bash
stim guide agent
```

Everything below is written from the **repository root**. `apps/tlon-mobile` is the app directory Stim wants, so every `stim` command runs from there -- including the ones for web and Cosmos ports. Give this skill's scripts an absolute path.

## Before anything

Unsandboxed (sandboxed, `gh auth status` cannot reach the keyring and reports a false `not authenticated`):

```bash
node .agents/skills/tlon-workflow-doctor/check.mjs
```

If any line says `fix`, use the tlon-workflow-doctor skill and come back. Do not work around a missing tool.

## The loop

### 1. A fresh worktree

First, what already exists for this ticket: `gh pr list --search <ticket id> --state all` and the links on the ticket itself. A closed pull request from an earlier run: note its branch name so yours differs, read its diagnosis only after you have reached your own, verify what you take from it, and do not cite it in your description.

```bash
git fetch --prune origin
git ls-remote --heads origin <handle>/<topic>       # empty, or pick another name
git worktree add -b <handle>/<topic> .worktrees/<name> origin/develop
cd .worktrees/<name>/apps/tlon-mobile
stim worktree warm --refresh
```

The default branch is `develop`; every branch starts there and every PR targets it. Branches are named `<handle>/<topic>`; take the handle from the existing branches (`git branch -r | grep -o '^  origin/[^/]*/' | sort | uniq -c`), not from your GitHub login. A name that already exists on origin cannot be pushed without force; pick another. `.worktrees/` is gitignored at any depth.

`git worktree add` needs an unsandboxed shell. Sandboxed it half-fails: no worktree, but the branch is created, so the retry stops with `a branch named '<...>' already exists`. Delete the branch before retrying.

`warm` carries `node_modules`, `ios/Pods`, both `.env.local` files, and `.claude/`, so the credentials in steps 2 and 3 are set once in the source checkout. Keep the source checkout clean and on `develop`; `--refresh` refuses a dirty or detached one and prints the git line that clears it. Clear it rather than dropping `--refresh`.

### 2. Run the app

Stim builds the app on this machine, installs it on an EAS Simulator session, and serves it JavaScript from this worktree's Metro through an Expo tunnel (`metro.tunnel` in `apps/tlon-mobile/.stim.json`). Nothing boots locally.

```bash
eas sim:availability                      # "available" for the tlon account
stim start --remote
stim ios --remote eas && node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs keepalive
stim logs --errors                        # exit 0 and "No matching log records" on stderr is the pass
```

Every `stim ios` and `stim android` in this skill takes `--remote eas`; without it Stim boots a local simulator or emulator. Plain `stim start` has no tunnel, and a running one cannot gain it (`STIM_REMOTE_START_REQUIRED`): `stim stop`, then `stim start --remote`.

**One platform at a time.** A worktree holds one EAS session, so `stim android --remote eas` beside a live iOS session refuses with `STIM_REMOTE_PLATFORM_MISMATCH`. Finish a platform, `stim stop`, then `stim start --remote` and the other one. Step 4 orders the captures to fit.

**A session bills from creation until it stops,** including while the local build runs and while you are thinking. Stim creates it before building, so a fingerprint miss (`fingerprint ... miss -- 1 source changed: ...`) compiles on the clock; `apps/tlon-mobile/.gitignore` is one of those sources. `stim stop` ends it (step 10) as soon as the platform's captures are done; do not leave one open across the review.

From the output keep the session ID (`device  EAS Simulator (<id>)`, or `udid` under `--json`) and the `Watch this device: <url>` line. Give the URL to the user: it is the only way to see the device. It carries a token, so it never goes in a pull request, ticket or comment.

For Android, the same line with `stim android --remote eas`. Keep the `&& ... keepalive` on every run, backgrounded or not: it has to start the moment Stim returns (see below).

A cold `stim ios` outlasts most tool timeouts: run it in the background or with the longest timeout you have, and rerun the same command if a call times out. A rerun reuses the session. So does `stim ios --remote eas` after a native change.

Android on EAS Simulator is marked in development by eas-cli, and this workflow has not been run against it: expect gaps and report them. The APK still builds here, so it needs the Android SDK. If Gradle fails with `java.lang.OutOfMemoryError: Java heap space`, the knob is `org.gradle.jvmargs=-Xmx2048m` in `android/gradle.properties`.

Android defaults to **`productionDebug`** (`io.tlon.groups`), committed as `android.variant` in `apps/tlon-mobile/.stim.json`, so plain `stim android --remote eas` is right. For the preview flavor (`io.tlon.groups.preview`, which you then pass to `--app` and `open`):

```bash
APP_VARIANT=preview stim start --remote
APP_VARIANT=preview stim ios --remote eas --scheme Landscape-preview
APP_VARIANT=preview stim android --remote eas --variant previewDebug
```

Every line needs `APP_VARIANT=preview`: the Gradle variant alone leaves the app configured as production. The two device lines take the same `&& ... keepalive` as above.

Use `stim logs --errors`, not `--since 5m --level error`: it filters the `hiddenapi ... AccessibilityNodeInfo` noise agent-device's snapshots generate on Android.

`ready` describes the process, not the screen: allow roughly another minute for the first screen.

**Drive the device through `eas-device.mjs`.** It is agent-device with this session's token and agent-device session added, so every agent-device command in this skill and its references goes through it:

```bash
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs snapshot -i
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs press 'text="Next"' --settle
```

Bare `agent-device` fails with `requires daemon authentication`: Stim keeps the connection but not the token.

**Nothing may leave the device idle for a minute.** An EAS device's lease lapses after about a minute without a command, and the next command then takes a new lease that the session refuses: from then on every call fails with `UNAUTHORIZED: Lease does not match session owner (leaseId)`, and nothing re-attaches, including `stim ios --remote eas`. A pause to think is enough to lose it. `eas-device.mjs` keeps a detached process pinging the device every 15 seconds for as long as Stim records the session: `keepalive` starts it, every other call restarts it if it died, and it stops by itself after `stim stop`. It cannot save a device that was already idle for a minute before it started, which is why it is chained onto `stim ios`. Pings that fail are logged to `agent-device.remote.keepalive.log` in the Stim workspace directory (`~/.stim/workspaces/<name>/`); a failure or two during a `stim ios` rerun or a long request is expected. If the session is lost anyway, `stim stop`, then this step and the sign-in again.

Stim gives every worktree's session the same agent-device name, `stim-tlon-mobile`, and agent-device keeps one connection per name. Run one worktree on EAS at a time: a second worktree's `stim ios --remote eas` takes the connection over, and `eas-device.mjs` in the first refuses rather than drive the other's device.

**Web** is a Vite server, no build. Take its port from stim:

```bash
cd <worktree>
pnpm --filter tlon-web exec vite \
  --port "$(cd <worktree>/apps/tlon-mobile && stim ports get web)" --strictPort
```

The subshell in `apps/tlon-mobile` matters: a port taken from anywhere else is one `stim ports stop` never visits, so the server outlives the run. Without `--strictPort` Vite moves to the next free port and serves you another worktree. The app is at `http://localhost:<port>/apps/groups/`. It needs `apps/tlon-web/.env.local` with `VITE_SHIP_URL` naming the ship the dev server proxies to (the same self-hosted dev ship as step 3); `VITE_DISABLE_SPLASH_MODAL=true` there skips the wayfinding modal on a fresh profile.

**Cosmos** renders a component in a chosen state without driving the app to it:

```bash
cd <worktree>/apps/tlon-web
npx cosmos --port "$(cd <worktree>/apps/tlon-mobile && stim ports get cosmos)"
```

`--port` is not in `cosmos --help` but works. Cosmos needs `packages/editor/dist`: run `pnpm run build:packages` if it is missing. Fixtures live in `packages/app/fixtures`, listed by file and named export, so `ChatMessage.fixture.tsx` appears as `ChatMessage / MessageStates`.

`stim ports` lists this worktree's labels and numbers, Metro included: open those and nothing else. Another port is another worktree's, and its page renders and its fixtures load with someone else's code. If you must open a port stim did not hand you, `lsof -a -p "$(lsof -nP -iTCP:<port> -sTCP:LISTEN -t | head -1)" -d cwd -Fn` prints the worktree being served.

### 3. Sign in

Most reproductions need a signed-in app. Put a self-hosted dev ship's URL and `+code` in `apps/tlon-mobile/.env.local` **of the source checkout** (gitignored; reaches every worktree through `warm`):

```bash
DEFAULT_SHIP_LOGIN_URL=https://your-ship.tlon.network
DEFAULT_SHIP_LOGIN_ACCESS_CODE=xxxxxx-xxxxxx-xxxxxx-xxxxxx
```

They are read by `app.config.ts`, which the Metro that `stim start --remote` launched serves to the app, and `warm` copies the file only when the worktree has none. Set them before step 1. If you are setting them now, copy the file into this worktree's `apps/tlon-mobile/` as well, then `stim stop` and step 2 again: a running Metro keeps the environment it started with.

Sign in with the script, once per EAS session (a new session is a fresh device). It opens the app under the agent-device session Stim connected, runs the sequence, and leaves it open for the rest of the run:

```bash
node <worktree>/.agents/skills/tlon-workflow/mobile-login.mjs --platform ios --eas
node <worktree>/.agents/skills/tlon-workflow/mobile-login.mjs --platform android --eas
```

It prints `signed in`, or `already signed in` when Home is already up. On failure it says which step failed and leaves the session open to snapshot. Empty login fields mean Metro started without the variables above.

The agent-device session is always Stim's (`stim-tlon-mobile`): a name of your own does not reach the remote device, so there is no session to name or close per run. The script's `--udid` / `--serial` form is for a simulator on this machine; hosted QA uses it on its own Mac worker.

What this app does that the sequence above does not show:

- Both prompts come back after every full reload, not only the first launch.
- A "Stay in the loop" sheet appears later over Home on iOS and Android and covers the bottom of the list: `press 'text="Not now"'`.
- On Android the notifications prompt can arrive after `alert dismiss` has already returned; `wait 3000` before it, or `screenshot` and dismiss what is there.
- On Android this app's screens collapse into a few group nodes, so `find` matches nothing; a `text="..."` selector still resolves.
- iOS shows a keyboard tip ("Speed up your typing...", `Continue`) on the first text entry, which swallows the next tap. Only reached when the fields are not prefilled.

**Web** has no prefill, and the login page is the ship's own. Run the script, with the worktree path (from `apps/tlon-mobile` or `apps/tlon-web` the relative path does not resolve, and from the source checkout it writes the session outside your worktree):

```bash
node <worktree>/.agents/skills/tlon-workflow/web-login.mjs --url http://localhost:<port>
```

It takes the `+code` from `apps/tlon-mobile/.env.local`, signs in, and prints the path of a Playwright storageState file (`.evidence/web-auth.json` unless `--state` says otherwise). Hand that to a context -- `browser.newContext({ storageState })` -- and it starts signed in, for the rest of the run. Signing in by hand instead, the selectors are in `apps/tlon-web/e2e/auth.setup.ts`, with one difference: a ship offering eauth renders a second form with its own `Continue`, so scope the click to the form holding the `password` field.

The script fails loudly when the ship's cookie does not survive: the ship marks `urbauth-` as `Secure`, so on plain http the app returns to the login page however many times you sign in. Serve over https (`SSL=true`) for those.

This yields an `authType: 'self'` session; it does not exercise the hosting-account flows (node status, revival, bot config). `DEFAULT_TLON_LOGIN_EMAIL` and `DEFAULT_TLON_LOGIN_PASSWORD` prefill the hosted path the same way. With neither pair set, the phone and email paths send a 2FA code an unattended run cannot read: ask rather than attempting them.

### 4. Capture the current behavior

For a bug or a change to existing behavior, record what the app does now, before touching code. A screen recording is the default; a screenshot only when the state is static and one frame shows it.

**Which platforms.** Three exist: iOS, Android and web (which the desktop app wraps). Decide before touching code: once the fix is in, a "before" on a platform you skipped takes the file swap at the end of this step.

- **One platform, the one the ticket names**, when the change is logic only, or UI built from components that behave the same everywhere (`View`, `Text`, layout, styling). No named platform: iOS.
- **Both iOS and Android**, before and after, when the change touches anything with native quirks: `TextInput`, `Switch`, `ScrollView` and list behavior, keyboard, gestures, the WebView editor, permissions, notifications, a native module, `Platform.select`, or a `.ios.tsx` / `.android.tsx` file; or when the ticket reports a symptom on one platform only.
- **Web as well**, whenever the change is under `packages/app`, `packages/ui` or `packages/shared` and is layout or shared-component behavior: those ship to web and desktop too, and the desktop navigation is a different tree from the mobile one. A change confined to `apps/tlon-mobile`, or to a `.ios.tsx` / `.android.tsx` file, does not reach web.
- **Cosmos as well as web**, not instead of it, for any UI change to a component that has a fixture in `packages/app/fixtures`. Grep the fixtures for the component before assuming none exists. See step 6.

When unsure, more platforms rather than fewer.

With one EAS session at a time (step 2), take both native platforms in turn rather than side by side: all of iOS (before, fix, after), `stim stop`, then Android, capturing its "before" with the file swap at the end of this step and its "after" on the branch.

Record the behavior, not the journey: navigate to the screen first, start recording, do the one action that triggers it, stop once the result is on screen. Under 30 seconds. Prove the repro first, then record it.

```bash
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs record start <worktree>/.evidence/before-ios.mp4 --quality high --hide-touches
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs press 'text="<label>"' --settle
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs longpress '@<ref>' --settle
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs wait 5000
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs record stop
```

`--hide-touches` is not optional on EAS: with the touch overlay the remote export outlasts agent-device's 90-second request limit, and `record stop` fails with `Daemon request timed out` and no clip. Without the overlay it returns in seconds, and the clip is written to the local path you gave. Wait for the result's text, then `wait 5000` before `record stop`: the remote recording runs about two seconds behind, so a stop right after the text produced a clip that ended before it, and 3 seconds left the result in the last frame only. The recorder also writes a frame only when the screen changes, so even a good clip ends the moment the result settles and shows it for an instant; hold it before attaching (step 8). Check that `record start` succeeded and, after `record stop`, that the file exists (on Android a second recording in the same session has produced nothing without an error) and its duration and last frame are right. Evidence goes in `.evidence/` at the root of your worktree (gitignored, removed with the worktree in step 10), as an absolute path: `$TMPDIR` differs between sandboxed and unsandboxed shells.

EAS also records the whole session and attaches it once the session stops (`eas sim:get --id <session id> --json`, the `screen-recording` artifact). It is a backup to check a clip against, not a clip source: its timeline drifts from the wall clock, so a cut by timestamp lands on the wrong moment.

**Web** is driven by whatever browser automation you have (this repository sets up the Playwright MCP server, see `CLAUDE.md`; a browser pane works too). Same names: `before-web.png` for a static state, a recording for motion. Use the desktop window size a person would, not a phone-width viewport, which shows the mobile navigation you already tested.

**Two cases need stills as well as the clip.** A state that lasts under about a second (a delivery indicator between send and server echo): record from before the trigger, then prove it with frames (`ffmpeg -ss <t> -i <clip> -frames:v 1 <png>`). A difference between two discrete states (with the indicator and without, empty and populated, collapsed and expanded): a still of each. Attach the stills and the clip. For a difference that lives in one component rather than a flow, a pair of Cosmos specimens differing only in the prop under test is better still (step 6).

Reproduce in a throwaway group named after the task and the time (`TLON-1234 repro 1435`), not the default "Untitled group": other agents and earlier runs leave those behind, and on Android same-named groups are indistinguishable in the list.

Read `references/driving-the-app.md` before the first capture on a device: recording quality, which commands resolve which targets, the chat list, attachments, backgrounding, making the throwaway group.

If the steps do not reproduce as written, vary them before concluding anything: leave the channel and re-enter it, act from the other platform's client, background and foreground the app. Then check whether the fix already landed: `git log -S '<suspect expression>' --oneline -- <path>` on the code the ticket points at, and the merged pull requests since it was filed. If it did, check the other platform before stopping: a fix for the reported platform may have left the other one broken. If both are fixed, stop: comment on the ticket naming the pull request that fixed it and the platforms you checked (text and links; the clips stay on disk), report the same to the user, and still do step 10.

To capture a "before" after the fix is already committed (the second platform, or a reviewer asks for another case), swap the file, not the branch: `git checkout origin/develop -- <path>`, wait for Fast Refresh to show the old behavior (relaunch if it does not, step 5), record, then `git checkout HEAD -- <path>` and check that the fix is back on screen. A swapped native file needs `stim ios --remote eas` / `stim android --remote eas` instead of a relaunch.

### 5. Fix

The ticket's diagnosis is a lead, not the cause: confirm the mechanism in code before changing it, and say so in the pull request when the two differ. Then the smallest change that fixes it -- no refactor, no cleanup of what sits next to it.

An edit to application JavaScript or TypeScript needs no rebuild; Fast Refresh applies it through the tunnel in a couple of seconds, and `stim logs --errors` shows what it broke. When you need a full reload, or an edit does not show up, relaunch the app, which fetches a fresh bundle from Metro in about 10 seconds, returns it to its first screen, and keeps the sign-in:

```bash
node <worktree>/.agents/skills/tlon-workflow/eas-device.mjs open io.tlon.groups --relaunch   # .preview on a preview build
```

`stim reload` refuses on a remote device (`STIM_RELOAD_STOPPED`), and `agent-device metro reload` either fails on the tunnel's socket or, pointed at local Metro, reports success without reaching the device; use the relaunch. After `babel.config.js`, `metro.config.js`, or `app.config.ts` changes, Metro has to restart, and `stim stop` also ends the session: `stim stop`, step 2, sign in again. After a native input changes, `stim ios --remote eas` or `stim android --remote eas` again, which keeps the session. Format with `pnpm format` at the repository root (oxfmt); prettier over a file rewrites it wholesale.

Before running `packages/shared` tests, `npm rebuild better-sqlite3` from the worktree root.

Commit as you go: steps 7 and 8 read the branch, not the working tree. Never force-push, and never `git stash`: the stash is shared with every other worktree of this checkout.

### 6. Validate with the same repro

Repeat step 4 into `after-<platform>.mp4` on the platform(s) you recorded before, then `stim logs --errors` again. Evidence is the repro you already recorded, not a new scenario. Say in the pull request which platform(s) you tested and why one was enough, when it was.

**Re-snapshot first.** Fast Refresh and a relaunch remount the tree with no agent-device action, so the refs stay live and a `press` replays the old coordinates onto whatever is there now: it reports `Tapped` and drives the wrong element, silently. After any edit that reaches the running app, snapshot again before touching anything. An edit under `packages/` may be a full reload: navigation resets to Home and the sign-in prompts return (`alert dismiss`, `Not now`). After any `packages/` edit, relaunch (step 5) before capturing, and confirm `stim logs --errors` is clean: an export added in one module and imported in another leaves the app throwing `ReferenceError: Property '<name>' doesn't exist` until the bundle is fresh. If the app dies on launch instead (on iOS, `EXC_BAD_ACCESS` in `EXPermissionsService registerRequesters`, expo/expo#45314), `stim ios --remote eas` reinstalls from cache in under a minute.

Keep `stim logs --since` windows short.

**Web.** Validate on it whenever step 4 called for it, on the server and Cosmos from step 2. The Cosmos UI (5555) and its renderer (5050) are **different origins**: screenshots and accessibility reads work, `document.querySelector` across the frame does not. Headless Chrome renders the Cosmos page blank however long you wait; capture it in a browser you can see.

### 7. Get an independent review

Before opening the pull request, put the diff in front of a fresh agent that has not seen your reasoning. Give it three things: the task as originally stated, the diff (`git diff origin/develop...HEAD`), and what to be adversarial about. Do not give it your notes, reasoning, or rejected alternatives, and tell it to ignore `.evidence/` and the commit messages. Ask for correctness first, with concrete inputs and the resulting wrong behavior, then whether the change does what the task asked, then what is untested. Tell it the size of the diff and to spend accordingly.

Fix what is real. Push back, with reasons, on what is not: applying a finding you cannot verify is worse than ignoring it. If a fix changes visible behavior, re-capture the evidence from step 4.

### 8. Open the pull request

Read `pr-description.md` in this skill's directory, then fill `.github/pull_request_template.md` section by section, and run the fresh-eyes pass it describes before posting.

```bash
git push -u origin <handle>/<topic>
gh pr create --draft --base develop --title "<title>" --body-file <worktree>/.evidence/pr.md \
  --attach <worktree>/.evidence/before-ios.mp4 --attach <worktree>/.evidence/after-ios.mp4 \
  --attach <worktree>/.evidence/before-android.mp4 --attach <worktree>/.evidence/after-android.mp4 \
  --attach '<worktree>/.evidence/before-web.png#before, web' --attach '<worktree>/.evidence/after-web.png#after, web'
```

One `--attach` per recording or screenshot from steps 4 and 6, for every platform you tested. Push first: on an unpushed branch `gh pr create` prompts for a remote, and a prompt in an unattended shell is a hang. `gh` appends the uploaded URLs to the body in `--attach` order, and rewrites a body reference only when it matches the `--attach` string exactly.

**Video takes no alt text.** `--attach '<file>#<label>'` is image-only and fails with `cannot set alt text on video`, creating no pull request. `gh` also does not rewrite a body reference to a video, so `![](./before-ios.mp4)` stays a broken relative link while the URLs are appended unlabeled at the end. Attach bare paths, then move the returned `user-attachments` URLs into the per-platform before/after tables `pr-description.md` describes:

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

A clip longer than about 30 seconds, or one that opens on sign-in or navigation, gets cut to the part that shows the behavior. Re-encode; `-c copy` lands the cut on the wrong frame (simulator recordings are variable frame rate):

```bash
ffmpeg -v error -i <clip> -ss <start> -to <end> -c:v libx264 -preset veryfast -crf 23 -an <clip>.trimmed.mp4
```

A clip from an EAS device ends the moment its result settles (step 4). Hold the last frame for two seconds so a reviewer can read it, after any trim:

```bash
ffmpeg -v error -i <clip> -vf tpad=stop_mode=clone:stop_duration=2 -c:v libx264 -preset veryfast -crf 23 -an <clip>.held.mp4
```

Mark it ready once the evidence is in: the Codex reviewer only reviews ready pull requests.

### Optional: hosted PR QA

For an independent cloud test after the PR is ready, use
[hosted QA](references/hosted-qa.md). It explores the implemented PR using
[reviewer guidance](references/pr-reviewer.md), a disposable backend, and one PR
comment with findings and video. It does not fix, push, request reviewers, or merge. It does not require base recordings or all-platform acceptance coverage.

### 9. Follow the review

```bash
node /absolute/path/to/repo/.agents/skills/tlon-workflow/pr-watch.mjs <number>
```

Unsandboxed (sandboxed it stops at once with `gh cannot reach this repository`), in the foreground, with the longest timeout your shell tool allows. If the call times out before it prints: a harness that moved it to the background is still running, so wait on that one rather than starting a second (two watchers share one seen-state file); one that killed it can be run again, since it keeps what it already reported.

It blocks until the pull request gets a review, review comment, or comment from the Codex reviewer (`chatgpt-codex-connector[bot]`) or someone with write access, keeps collecting until the round is complete (Codex's status for the head commit, then its CI result, up to twenty minutes later), prints each item as one JSON line (`kind`, `author`, `path`, `line`, `url`, `body`), and exits. Other lines: `{"kind":"codex-status","headSha":...,"findings":<n>}` once, when Codex's review completes, `findings` counting its inline comments on that commit; `{"kind":"ci","status":"failure","failed":[{name,url}]}` as soon as a check fails, or `{"kind":"ci","status":"success"}` once every check on the head commit has passed; `{"kind":"closed","merged":true}`, at which go to step 10; `{"kind":"timeout"}`, when nothing has happened on the pull request, by anyone, for `--timeout` seconds (default 1800; pass a shorter one for a quick run) -- any commit, comment, or review restarts that budget.

One run is one round. A failed check is an item like any other: `gh run view --job <job id> --log-failed` (the job id is the last path segment of its url), fix, and it re-runs on the push. A `qa-result` is an advisory hosted test report for its `headSha`, not a request
to restart the review loop. Read it once, check that it matches the current PR
commit, and address verified findings as part of the current round. Do not rerun
QA merely because it posted or edited its comment. Rerun only after a relevant
fix or at the user's request; incomplete platform coverage is not a code defect.
If you explicitly dispatched hosted QA, pass `--qa-run <EAS workflow UUID>` to
the same watcher before the human handoff. It waits for that run on the current
head within `--timeout`, or reports that the head changed. Without this option,
it only surfaces results already published. A completed review can contain
findings or unexplored paths; neither starts another run automatically.

For every review item: fix what is real, reply in that thread with what changed (`kind: review_comment` → `gh api repos/{owner}/{repo}/pulls/<number>/comments/<root>/replies -f body=...`, where `<root>` is the watcher's `replyTo` when set and its numeric `commentId` otherwise, since GitHub only accepts replies to a thread's first comment; `kind: comment` or `review` → `gh pr comment`), and push back, with reasons, on what is not. End every reply and comment you post with the line `<!-- tlon-workflow:agent -->`; it is how the watcher tells your replies from a reviewer's. Push once for the whole round, re-capture evidence if the visible behavior changed, then run the watcher again. Codex reviews each push.

Codex reports only what is new on each push, so `findings: 0` means nothing new, not clean. Keep your own list of every thread the watcher has printed and what you did with it. Stop when every thread on that list has a reply from you (a fix or a reasoned push-back), the head commit has `{"kind":"ci","status":"success"}` (every check, including workflows for packages you did not touch; a running check counts as activity, so the budget waits for it) and its `{"kind":"codex-status"}` has arrived with nothing unanswered; or when the pull request is merged or closed; or on `{"kind":"timeout"}`. Report what is still open.

**Then ask for a human.** Once CI is green and every Codex thread has an answer, and also on `{"kind":"timeout"}`, request a reviewer yourself. Say in your report who you tagged and why. There is no `CODEOWNERS`, so the signal is who maintains the files you touched:

```bash
git log --since='12 months ago' --format='%an' -- <changed path> | grep -v '\[bot\]' | sort | uniq -c | sort -rn
gh api "repos/tloncorp/tlon-apps/commits/<sha>" --jq '.author.login'   # name -> login
gh api "repos/tloncorp/tlon-apps/collaborators/<login>/permission" --jq '.permission'
gh pr edit <number> --add-reviewer <login>
```

Weight by the file the change actually lives in, not by file count: the component you edited over the fixture you added a specimen to. Take the top one or two. Check each candidate's permission before tagging; on a public repository the endpoint does **not** 404 for someone who has left, so the departure signal is the value:

| answer | means |
| --- | --- |
| `admin`, `maintain`, `write` | current collaborator -- tag them |
| `read` | a real account with no access here: left, or never had it |
| 404 `is not a user` | the login does not exist; you mis-mapped the name |

Accept only `admin`, `maintain` or `write`; move to the next candidate on anything else.

### 10. Clean up

After the pull request is merged or closed, and after asking the user. **Order matters**: remove the worktree before the branch goes, or `remove` refuses because its commits are no longer on any remote. And leave the worktree before removing it.

Delete the throwaway group on the ship first, while the app is still up and signed in; once the session is stopped, the device and the way in are gone.

```bash
cd <worktree>/apps/tlon-mobile
stim ports stop                            # kills web and Cosmos on this worktree's ports and releases them; leaves Metro alone
stim stop                                  # ends the EAS session (look for "stopped remote session <id>") and, within 15 seconds, its keepalive
eas sim:list --status new --status in-progress   # nothing of this run's left billing
cd <source checkout>/apps/tlon-mobile
stim worktree remove <source checkout>/.worktrees/<name>   # the path step 1 created; then, if the branch should go too:
git branch -d <handle>/<topic>
git push origin --delete <handle>/<topic>
```

Never `--force`: it discards uncommitted and untracked files permanently. If `remove` refuses because a commit exists nowhere else, push the branch instead.

`stim stop` can end with `Stopped with problems` over a local device record it could not shut down (`emulator: command not found` when the Android SDK is not on PATH); that is about this machine, not the session. The `stopped remote session` line is the one that matters. Without it, the remedy names `eas simulator:stop --id <id>` (`STIM_REMOTE_SESSION_CLEANUP`): run it, because a session that did not stop bills until its duration cap.

## Under a sandbox

Stim, agent-device, `eas`, `gh` and `xcrun simctl` all need an unsandboxed shell. `stim doctor --fix` offers to write an allowance into `.claude/settings.local.json`; that is your own permission configuration, so do not change it because a tool told you to. Run the calls unsandboxed, or ask the user to apply the allowance themselves.

Sandboxed, `simctl list devices` returns an empty list (`Operation not permitted` on its CoreSimulator log, a refused connection to `CoreSimulatorService`). Nothing is wrong with Xcode: rerun it unsandboxed.
