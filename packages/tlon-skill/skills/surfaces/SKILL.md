---
name: surfaces
description: >
  Build and maintain live mini-apps ("surfaces") in Tlon groups: polls, RSVPs,
  signup sheets, trackers, leaderboards, countdowns, expense splits, kanban
  boards, workout logs. Use when the user asks to track, collect, vote on,
  count, schedule, or coordinate anything with the group — they will say
  "can we track who's bringing what," not "build me a dashboard." Also use for
  any change to an existing surface ("add a maybe option", "show who hasn't
  responded"). Do NOT use for ordinary messages, notes, or one-off questions a
  chat message answers.
---

# Building surfaces

A surface is a channel that renders an app instead of messages. You author it;
group members use it.

Two properties govern everything below. They matter more than doing every step.

**Success is observed, never assumed.** Every `surface` command that writes
reads the thing back before it reports, and says what it observed. A poke that
resolves is not a write that landed — `%channels` acks locally and
`%channels-server` can still have dropped it. So: **never tell the user
something worked before the command confirmed it.**

An error means the command did not finish — it never means "maybe it went
through". It does **not** always mean nothing happened. `surface publish` does
several things in order, and a failure part-way leaves the earlier ones
standing; when that happens the error's `details` carry
`definitionPublished: true`. **Read it before you speak.** Without it, say the
change did not happen. With it, the app definition IS live and only the
records after it are missing — say the update went out but the board needs
fixing, and go to `code` for what to do. Never say "nothing happened" over a
`definitionPublished`, and never respond to one by regenerating the app.

**The user never sees the machinery.** Not lint output, not violation lists,
not `--json` documents, not rule names, not screenshot filenames, not file
paths. Those exist for your repair loop. The user gets a sentence in their own
language: "I don't have permission to add channels here yet."

## The workflow

1. **Match intent to a template.** Run `tlon surface templates list`. Two are
   installed today — **poll** and **workout-tracker**. More are planned; the
   command is the authority, not this sentence, and an empty catalogue is
   reported as a plain fact rather than an error. Adapt the closest one — never
   invent from scratch; adapted templates are reliably good, invented apps
   reliably are not. `tlon surface templates show <name>` prints its declared
   actions and its `NOTES.md`: what to customize, what to leave alone.
2. **Ask at most one clarifying question**, and only if the template genuinely
   forks on the answer (e.g. poll options). Default everything else. The user
   asked for an outcome, not a requirements interview.
3. **Read `PARADIGM.md` before writing any code.** It is short and every rule
   in it exists because something broke without it. Read the relevant
   `PRIMITIVES.md` entries for the components you'll use.
4. **Adapt the bundle and `spec.json`.** The bundle is **JavaScript** — one
   plain script, no `import`/`export`, no markup, no build step. Call it
   `app.js`. An `.html` file containing markup would not run at all: the shell
   injects the source inside a `<script>` element. State shape and actions
   first, render second. Keep actions parameterless; key per-member state by
   `$actor`.
5. **Lint:** `tlon surface lint app.js spec.json --json`. The gate runs fourteen
   rules in a fixed order, and the order is the repair order — fix the earliest
   violation first, because later rules are usually downstream of it (a bundle
   with module syntax cannot be evaluated at all, so nothing behavioral can be
   said about it). Re-lint until it passes. `warnings` never block.
6. **Preview, and score the screenshots.**
   `tlon surface preview app.js spec.json --out surface-preview` renders the app
   the way production renders it and writes twelve PNGs plus a `manifest.json`:
   phone / phone-full / desktop, each in light and dark, each in the empty state
   and in a state produced by folding every declared action through the real
   reducer. **Open the images and score them against `RUBRIC.md`** — nothing
   here is automated, and this is the only check that sees what a member sees.
   Then repair and re-run. **Two repair rounds, at most.** If a finding survives
   both, publish anyway and tell the user plainly what is still rough ("the
   chart is a bit tight on a phone") — a third round on the same finding means
   the fix is not in the copy or the layout.
   Preview is an optional capability: where headless Chromium is not
   provisioned the command says so, and you publish on lint and fold alone. Do
   not retry it, and do not treat its absence as a failure of the app.
7. **Publish.** `tlon surface create <group-id> --title "…"` the first time,
   then `tlon surface publish <channel> --bundle app.js --spec spec.json`. The
   revision number is derived from content — you never supply it — so a changed
   bundle can never ship under an unchanged revision, and a byte-identical
   republish is reported as an explicit no-op rather than a silent skip. Only
   say the app is live once the command reports it observed the definition read
   back from the group.
8. **Announce in chat** — one short message in a real chat channel saying what
   the surface does and where it is. Surface channels are excluded from unread
   badges and activity summaries, so nothing else tells the group it exists.
9. **Revise on feedback.** "Show who hasn't responded" is a new revision:
   regenerate, lint, preview, `surface publish` again. Use `--preserve-state`
   whenever the data should survive the change — the command folds the current
   state and posts the migration snapshot in the same command, so on the
   success path the pending window is one command wide. If the command fails
   with `definitionPublished` in its details, that window is open: the board
   is waiting on its migration snapshot, and `tlon surface snapshot <channel>`
   posts it. Do that before anything else — do NOT republish, and above all do
   not republish without `--preserve-state`, which unsticks the board by
   throwing away everything in it. Without `--preserve-state`, state resets
   from `initialState`; that is only correct when the user wants a fresh
   start.

   **Adding data is not a revision.** A revision changes the app; it does not
   change what is already in state. `--preserve-state` carries the existing
   state forward and **never reads the new `initialState`**, so editing
   `initialState` to add a fourth poll choice changes nothing a member sees.
   Adding a choice is two steps: the revision (new action, new handler-table
   entry, `--preserve-state`) **and** a host event —
   `tlon surface event <channel>` with an op appending the choice to
   `/options`. Publish the revision alone and you will tell the user it was
   added while they look at the old three. Confirm with
   `tlon surface state <channel>` before you say it landed. See
   `PARADIGM.md` §13.

## Rules that are never optional

- **State changes are events; UI changes are revisions.** Never publish a new
  spec to change data; never post events to change the UI.
- **Actions are the complete list of what members can do.** If a button isn't
  backed by a declared action, it does nothing. Every `invoke` in the bundle
  must reference a declared actionId — the gate checks this.
- **`append` means "duplicates are acceptable."** Double-taps, retries, and two
  devices all produce real duplicate posts, and nothing downstream can tell
  them apart. For anything periodic or counted, use the host-is-the-clock
  pattern from `PARADIGM.md` instead. The gate folds every action twice and
  fails any whose second fold changes state.
- **`render` never reads the clock and never knows who is viewing.** Derive
  everything from state. Dates only exist where a host event wrote them.
- **Money, weights, scores: integers only** (cents, grams, tenths). Float
  arithmetic silently corrupts derived values.
- **Ship names never appear literally in op paths.** `$actor` is the only way
  identity enters a path. A bare `~` in a path segment is an invalid RFC 6901
  escape and silently invalidates the whole op; where a host op genuinely must
  name a ship the segment is `~0zod`, while the same ship inside a _value_ is
  plain `~zod`. Reading it back in `render`, the state key is plain.
- **Use the words the user's domain uses.** The gate's jargon rule is a
  six-word denylist; it cannot tell whether a sentence means anything to a
  member. The vocabulary table in `PARADIGM.md` has replacements, the templates
  model the register, and `RUBRIC.md` check 6 is where you actually catch it —
  by reading every word in the screenshots.
- **Charts go through the chart primitive.** Never construct a raw fixed-size
  canvas; it overflows phones, and the gate rejects it behaviorally.

## Maintaining a live surface

- `tlon surface state <channel>` — read the current folded state before
  reasoning about it; never reconstruct it from memory of past events. It
  refuses rather than printing a partial fold, because a partial fold is wrong
  state, not stale state. `migration-pending` is a defined answer, not a
  failure.
- `tlon surface event <channel> --set <path> <json> [--del <path>] …` —
  host-authored state changes (rollovers, corrections, closing a poll). Ops
  apply in the order written, values are JSON so a bare string needs its quotes
  (`--set /title '"Friday"'`), and a larger edit can go in as
  `--ops '<json array>'` or `--ops-file <path>`. Host ops may not use `$actor`;
  the command refuses rather than posting an event whose only op the reducer
  would silently skip. Small and boring; one entry per post.
- `tlon surface snapshot <channel>` — compacts the history into one post at the
  channel's current revision. You do not need one after a `--preserve-state`
  publish that succeeded; that command already posted it. Reach for it when the
  channel's history has grown long, or when state is approaching the 128 KB cap
  and you are about to prune.

  It is also **the repair** when a board is stuck on `migration-pending`: run
  it with no options and it reconstructs the missing migration snapshot from
  the state the previous revision was last folded to, which unsticks the board
  without discarding what members put in it. Only the channel's host can do
  this. It refuses rather than guess where the previous state is not
  recoverable — take that refusal at face value; there is no flag that makes it
  work, and republishing without `--preserve-state` "fixes" it only by
  deleting the data.

- **Bad data is repaired with a host event or a retraction**
  (`--retract <post-id>` on `event` or `snapshot`, which retracts by editing —
  the reducer skips edited surface posts), never by publishing a new spec.
  Spec revisions are for UI and action changes.
- The generation context you publish rides along in the spec (`recipe`). On
  revision requests, read it back instead of re-deriving intent. It is
  member-visible: `PARADIGM.md` §14 says what may go in it.

## When things fail

Every subcommand takes `--json`. Success prints `{ ok: true, … }` with what the
command observed; a failure prints `{ ok: false, code, message, details }`.
**Branch on `code`.** Exit status is 1 for every failure and cannot tell them
apart — and two commands are shaped differently on purpose: `surface lint
--json` prints the gate's verdict (`ok`, `violations`, `warnings`, `skipped`)
with no `code`, and `surface preview --json` prints the capture manifest.

Every failure also carries `details.errorClass`, which says **who can fix it**
and is the first thing to read:

- `author` — the files or arguments you handed the command are wrong. Change
  them and run again. This is the only class where regenerating anything is
  the right move.
- `environment` — the system refused, or the channel is in a state the command
  cannot act on. **Your files are fine.** Re-running them unchanged repeats
  the refusal, and rewriting the app is destructive noise that hides the real
  problem. Do the specific thing the row below names, or stop.

| `code`                                                                            | class       | what to do                                                                                                                  | what the user hears                                                    |
| --------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `admin-required`, `group-not-found`                                               | environment | stop; nothing to retry                                                                                                      | "I don't have permission to add channels in that group yet."           |
| `storage-unavailable`, `storage-no-bucket`                                        | environment | stop; the remedy belongs to whoever set the bot up                                                                          | "This node can't host app files yet — storage needs configuring."      |
| `name-burned`, `name-taken`                                                       | environment | pick another name, or omit `--name` for a random one                                                                        | nothing; just proceed                                                  |
| `lint-failed`                                                                     | author      | read `details.violations`, fix the earliest, re-lint                                                                        | nothing until it passes                                                |
| `spec-file-invalid`, `spec-invalid`, `invalid-ops`                                | author      | your own file or ops are wrong; fix and retry                                                                               | nothing                                                                |
| `surface-id-changed`                                                              | author      | almost always your bug — fix the spec, do not pass the override                                                             | nothing                                                                |
| `migration-pending`                                                               | environment | run `tlon surface snapshot <channel>` — that posts the missing snapshot; if it refuses too, stop and say the board is stuck | nothing, unless the repair also refuses                                |
| `state-too-large`                                                                 | environment | the board holds more than a snapshot can carry; prune it with a host event, then retry. **Do not touch the app files**      | "That board has more in it than I can save in one go — let's trim it." |
| `partial-hydration`                                                               | environment | do not report state or snapshot; retry, then report the channel unreadable                                                  | "I couldn't read the whole history of that board just now."            |
| `create-unconfirmed`, `publish-unconfirmed`, `post-unconfirmed`, `kind-tail-lost` | environment | the write is **not** confirmed — do not claim it landed                                                                     | "That didn't go through — let me try again."                           |

- **Never work around a gate rule.** They are load-bearing: a bundle that dodges
  the gate can still never gain capabilities, it just gets worse.
- **Never show the user violations, codes, or JSON.** Report the blocking
  condition in plain terms and stop there.
- If the folded state looks wrong, do not "fix" it by publishing a new spec.
  Read `surface state`, find which events produced it, and correct with a host
  event.

## Files in this skill

- `PARADIGM.md` — the contract and doctrine. Read before writing code.
- `PRIMITIVES.md` — the component catalog. Read entries for what you use.
- `RUBRIC.md` — the seven checks you score `surface preview`'s screenshots
  against, and the things that are preview's artifact rather than the app's.
- `templates/<name>/` — `app.js`, `spec.json`, `NOTES.md` per template. Load
  exactly the one you're adapting.
