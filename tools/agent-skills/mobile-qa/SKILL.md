---
name: mobile-qa
description: >-
  Run a mobile QA checklist on a physical Android device over adb for tlon-apps,
  then triage what fails into fixes. Use this whenever the user hands over a list
  of QA tasks / test cases / a "QA pass" to run on-device, asks to drive the
  Android app (io.tlon.groups[.preview]) via adb, wants failures filed as Linear
  issues (with screenshots), or wants a found bug fixed, PR'd, and verified on the
  device. Covers the full loop: drive the UI → record pass/fail → file Linear
  issues → fix the code → rebuild and verify on-device. Reach for it even when the
  user only asks for one phase ("run these QA tasks on my phone", "file that as a
  Linear bug with a screenshot", "now fix it and verify on device").
---

# Mobile QA (Android, on-device) → triage → fix → verify

This skill drives the tlon-apps Android app on a **physical device over adb**,
runs a QA checklist, and turns failures into filed-and-fixed work. It exists
because the useful signal from mobile QA is spread across five phases that each
have their own traps; doing them from memory reliably loses time to the same
snags (adb not on PATH, RN swipes that snap back, taps that miss because
screenshot coordinates were guessed, a preview build that won't hot-reload).

The phases are independent — the user may ask for any subset. Read the phase you
need; each points to a reference file for the fiddly details.

1. **Setup & device control** — locate adb, drive taps/swipes/text, screenshot loop
2. **Run the QA pass** — work the checklist, record pass/fail with evidence
3. **File Linear issues** — one per real failure, screenshot attached
4. **Fix** — find the screen, mirror a working sibling, PR it
5. **Verify on-device** — rebuild with the fix, reproduce, capture proof shots

## Capabilities this skill assumes

This is a workflow recipe, not tied to any one agent. It works in any coding
agent that has:

- **A shell** to run `adb`, `git`, `gh`, `curl`, `pnpm`/`npx`, and Gradle.
- **Filesystem read/write** for the repo and a scratch directory.
- **Image input (vision)** — you drive the UI by taking screenshots and *looking*
  at them, so an agent that can't see images can't run Phase 2.
- **A Linear integration** for Phase 3 — either a Linear MCP server or the Linear
  REST/GraphQL API called directly with a token. `references/linear-filing.md` is
  written against MCP tool names, but each maps 1:1 to an API call.
- **GitHub access** for Phase 4 — the `gh` CLI (used here) or the GitHub API.

Where this skill says "view"/"look at" a screenshot, use your agent's
image-viewing capability. Paths like `scripts/adbx.sh` are relative to this
skill's install directory — resolve them there (shown as `$SKILL` below).

## Before you start: this is usually a real account

The app on the device is almost always the user's **real, logged-in account**
with real colleagues and groups — not a throwaway ship. That constraint shapes
the whole pass. Read `references/safety.md` first and keep it in mind: never send
messages to real people, route destructive/admin tests (kick/ban/leave/delete)
through a throwaway group you create and later delete, and confirm outward-facing
actions. When the plan involves genuinely destructive or person-affecting steps,
surface them and get a yes before doing them — a blanket "run the QA tasks" is not
consent to nuke a shared group.

Single device also means you can verify the *initiating* side of an action but
not "all members see the change" cross-ship effects, and you can't do
mismatched-agent-version tests. Mark those `NOT TESTABLE (single device)` rather
than guessing.

## Phase 1 — Setup & device control

`adb` is typically **not on PATH**. The helper script `scripts/adbx.sh` locates
it and wraps the common gestures; use it instead of re-deriving adb invocations.

```bash
# point screenshots at a scratch dir (default: a temp dir OUTSIDE the repo, so
# real-account captures never land in the worktree), then sanity-check
export QA_SHOT_DIR=/path/to/scratch
SKILL=/path/to/this/skill        # wherever your agent installed it
A="$SKILL/scripts/adbx.sh"
"$A" adb devices -l          # confirm a device is attached
"$A" focus                   # what app/activity is focused
"$A" shot s001               # capture; prints the PNG path
```

Then **view the PNG** (image input required) to see the screen. Screenshots are
the device's native resolution (e.g. 1080×2400). `input tap`/`swipe` take
**device-native coordinates**, so tap the raw pixel coordinates from the
screenshot — do not apply the viewer's display-scale factor to them.

The full gesture/quirk catalogue (slow-drag for RN rows, long-press, reading
element bounds when a tap misses, the `input text` space bug, keyboard-dismiss
traps, screen sleep/lock) lives in **`references/adb-driving.md`**. Skim it before
driving — several of these will bite on the first attempt otherwise.

## Phase 2 — Run the QA pass

Work the checklist top to bottom. For each row: perform the action, screenshot,
view the shot, and judge the result against the "Expected" column.

Keep a running results table in a scratch markdown file (one row per checklist
item) so nothing is lost and the final report is a copy-paste. Use these verdicts:

- **PASS** / **FAIL** — behaved / didn't behave as the Expected column says
- **PASS\*** — works but with a wording/path discrepancy worth noting (e.g. a
  button labeled "Edit group" where the checklist says "Customize"); record what
  actually appeared
- **NOT RUN** — skipped to avoid disruption (outward-facing/destructive on a real
  account, or a gesture that can't be driven via synthetic input); say why
- **NOT TESTABLE** — needs a second ship / mismatched version / cross-ship confirmation
- **N/A** — precondition doesn't hold (e.g. "if new account" on an existing one)

Be honest and specific in the notes — a FAIL should name the observed behavior,
and a PASS\* should quote the actual label/URL/path. When a failure looks real,
capture a clean screenshot of the broken state; you'll reuse it when filing.

Report failures first, then discrepancies, then not-run/not-testable, then "all
else passed". The user asked which ones fail — lead with that.

## Phase 3 — File Linear issues

One issue per genuine failure. The mechanics — team lookup, `save_issue` with the
`Bug` label, and the three-step screenshot attachment (prepare upload → `curl` PUT
with the signed headers → finalize) — are in **`references/linear-filing.md`**.

Before filing, confirm with the user which failures to file if there are several;
don't mass-create issues unprompted. Write issues someone can act on without this
conversation: summary, numbered repro steps, expected vs actual, environment
(device, `io.tlon.groups.preview`, build version from `dumpsys`), and any
measured detail that makes the bug concrete (e.g. an element's bounds). If the
user already has the broken state on their device, take a fresh screenshot rather
than reusing an older one.

## Phase 4 — Fix

Locate the screen from a string in the UI (`grep -rn "Edit channel info"
packages/`), then look for a **working sibling** — a near-identical screen that
doesn't have the bug — and mirror its structure. Most mobile-UI bugs here are a
component wired slightly differently than an equivalent that works; the diff
against the working version is the fix and the explanation.

Then the standard hygiene: `pnpm -r tsc` (or `npx tsc --noEmit` in the package),
Prettier on changed files, branch off `develop`, commit with the
`Co-Authored-By: Claude ...` trailer, push, and `gh pr create` using the repo PR
template (`.github/pull_request_template.md` — Summary / Changes / How did I
test? / Risks and impact / Rollback plan / Screenshots). Naming the branch
`<user>/tlon-<NNNN>-...` auto-links the PR to the Linear issue. Details and the
exact PR-body shape are in **`references/fix-and-verify.md`**.

## Phase 5 — Verify on-device

**Know your variant** — this is easy to get wrong. `previewDebug` is a
`debuggableVariant` in `apps/tlon-mobile/android/app/build.gradle`, so its JS
bundle is **not** embedded; that build loads JS from **Metro**. So:

- **JS/TS-only fix (common case): verify via Metro, no rebuild.** Start Metro on
  the fixed source (`APP_VARIANT=preview npx expo start --dev-client`), point the
  device at it, and confirm Metro logs an `Android Bundling` line when the app
  loads — otherwise you're looking at stale/cached JS and the check is a lie.
- **Native change, or a standalone APK that embeds the fix:** build the bundling
  variant `previewRelease` (with `APP_VARIANT=preview`) — **not**
  `installPreviewDebug`, which won't contain your source.

The full recipe (both paths, JDK/SDK env, the non-destructive "never uninstall"
rule, screen-sleep/unlock handling) is in **`references/fix-and-verify.md`**.

Once the fix is live: reproduce the original failing steps, screenshot the
now-correct behavior, and view the shot to confirm. Proof is the before
(filed screenshot) and after (post-fix screenshot) of the same repro.

## A note on pacing

Phases 4–5 involve a long Gradle build and a physical device that sleeps/locks.
Run the build in the background and watch for its terminal state; set
`adbx.sh stayon` so the screen doesn't sleep mid-pass; and if the device is on a
secure lockscreen, ask the user to unlock it — never attempt to bypass a PIN.
