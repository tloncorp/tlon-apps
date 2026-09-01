---
name: surfaces
description: >
  Build and maintain live mini-apps ("surfaces") in Tlon groups: polls, votes,
  RSVPs, signup sheets, trackers, leaderboards, countdowns, expense splits and
  who-owes-what tallies, kanban boards, workout logs. Use when the user asks to
  poll, vote, track, collect, count, split, settle up, schedule, or coordinate
  anything with the group — they will say "poll for Friday movie night",
  "who owes what for the beach trip", "can we track who's bringing what", not
  "build me a dashboard". A surface is how Tlon does polls and splits: this
  channel has no native poll — the message tool's action enum contains no
  "poll" and its poll* parameters are rejected here — so a poll, a vote, a
  tally or a "who owes what" is a surface, including when the numbers still
  have to be worked out from what people report. Also use for any change to an
  existing surface ("add a maybe option", "show who hasn't responded"). Do NOT
  use for ordinary messages or notes, or for a one-off question that a single
  chat message answers and nobody needs kept up to date.
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
3. **Run `tlon surface doctrine` before writing any code.** It prints the
   paradigm — short, and every rule in it exists because something broke
   without it. `tlon surface primitives` prints the component catalog; read
   the entries for the components you'll use.
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
   reducer. **Open the images and score them against `tlon surface rubric`** —
   nothing here is automated, and this is the only check that sees what a
   member sees.

   **How to open them:** the command prints absolute paths; read each one with
   your file-reading tool, which recognizes a PNG and returns the picture
   itself rather than its bytes as text. Read them one at a time, phone first.
   If your runtime has no way to turn a local file into an image you can look
   at, **the rubric step cannot be performed** — say so and publish on lint and
   fold alone; do not score screenshots you have not seen.

   Two failures look like success and are not. If what comes back is either of
   these placeholders, **no image reached you**:

   ```
   [Current model does not support images. The image will be omitted from this request.]
   [Image omitted: could not be resized below the inline image size limit.]
   ```

   Report those cells as unscored and say why. Never write a score over a
   placeholder — a confabulated rubric pass is worse than an admitted gap.
   (Captures are taken at 2× and are downscaled before you see them, so judge
   layout, overflow, contrast and copy, not hairline detail.)

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

   Send it with `tlon posts send <chat-nest> "…" --bot`, where `<chat-nest>` is
   a `chat/~host/name` the group already has — take it from `tlon channels all`
   and never guess. A group id (`~zod/surface-seed`) is not a channel; posting
   to one fails with a raw Hoon stack trace rather than a readable error.

   Do **not** announce with the `message` tool: its schema carries poll
   parameters this channel cannot honour, and it rejects `action: "send"`
   whenever any of them is set — which is every call, because a model that
   fills in each optional field supplies `pollDurationHours: 1` for a field
   whose schema says `minimum: 1`. The rejection tells you to use
   `action: "poll"`, and `"poll"` is not in the enum you were given, so the
   retry cannot succeed: in session 6a this cost 28 attempts, 28 rejections,
   and one turn killed on the clock. If you land there anyway, stop after the
   first rejection and use `tlon posts send`.

9. **Revise on feedback. Read the app back first.**
   `tlon surface show <channel> --bundle-out app.js --json` returns the
   definition the channel actually holds — including the `recipe` recording
   what the app was asked to be — and writes the published bundle to
   `app.js`, hash-verified against the definition before it lands. **Start
   every revision there.** You are editing an app that exists; "show who
   hasn't responded" is a change to that code, not a fresh generation of
   something adjacent to it. Regenerating from a template throws away every
   choice the previous rounds made — the wording, the layout, the fixes you
   already applied — and the user experiences it as the app being replaced.

   The definition it prints is the raw one, so it is also the thing to edit
   and hand back to `surface publish`: keep the fields you are not changing
   exactly as they came out. (`surface publish` owns `bundle.*` and
   `specRevision` regardless of what your file says, so those you may
   leave.)

   Then: edit, lint, preview, `surface publish` again. Use `--preserve-state`
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
   `tlon surface state <channel>` before you say it landed. See §13 of
   `tlon surface doctrine`.

## Rules that are never optional

- **State changes are events; UI changes are revisions.** Never publish a new
  spec to change data; never post events to change the UI.
- **Actions are the complete list of what members can do.** If a button isn't
  backed by a declared action, it does nothing. Every `invoke` in the bundle
  must reference a declared actionId — the gate checks this.
- **`append` means "duplicates are acceptable."** Double-taps, retries, and two
  devices all produce real duplicate posts, and nothing downstream can tell
  them apart. For anything periodic or counted, use the host-is-the-clock
  pattern from `tlon surface doctrine` instead. The gate folds every action
  twice and fails any whose second fold changes state.
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
  member. The vocabulary table in `tlon surface doctrine` has replacements, the
  templates model the register, and check 6 of `tlon surface rubric` is where
  you actually catch it — by reading every word in the screenshots.
- **Charts go through the chart primitive.** Never construct a raw fixed-size
  canvas; it overflows phones, and the gate rejects it behaviorally.

## Maintaining a live surface

- `tlon surface show <channel> [--bundle-out <path>]` — read back what the
  channel publishes: its definition verbatim, its `recipe`, the storage
  pointer for its bundle, and with `--bundle-out` the bundle source itself.
  This is the app; `surface state` is what members put in it. The two are
  different questions and the commands are not interchangeable.

  The definition comes back raw — exactly the bytes the channel holds, not a
  cleaned-up view of them — because that is what you edit and republish. The
  bundle is fetched only when you ask, and only bytes matching the sha256 the
  definition pins are ever written: a mismatch refuses and writes nothing.
  Take that refusal at face value; it means storage is not serving the app
  this channel published, and there is no flag that makes it work.

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
  revision requests, read it back with `tlon surface show <channel>` instead
  of re-deriving intent — that command is the only thing that returns it, and
  a definition published without one reports `recipePresent: false` rather
  than an empty string, so you can tell "no intent recorded" from "intent was
  nothing". It is member-visible: §14 of `tlon surface doctrine` says what may
  go in it.

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

| `code`                                                                            | class       | what to do                                                                                                                                                                                                                                                                | what the user hears                                                    |
| --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `admin-required`, `group-not-found`                                               | environment | stop; nothing to retry                                                                                                                                                                                                                                                    | "I don't have permission to add channels in that group yet."           |
| `storage-unavailable`, `storage-no-bucket`                                        | environment | stop; the remedy belongs to whoever set the bot up                                                                                                                                                                                                                        | "This node can't host app files yet — storage needs configuring."      |
| `name-burned`, `name-taken`                                                       | environment | pick another name, or omit `--name` for a random one                                                                                                                                                                                                                      | nothing; just proceed                                                  |
| `lint-failed`                                                                     | author      | read `details.violations`, fix the earliest, re-lint                                                                                                                                                                                                                      | nothing until it passes                                                |
| `spec-file-invalid`, `spec-invalid`, `invalid-ops`                                | author      | your own file or ops are wrong; fix and retry                                                                                                                                                                                                                             | nothing                                                                |
| `surface-id-changed`                                                              | author      | almost always your bug — fix the spec, do not pass the override                                                                                                                                                                                                           | nothing                                                                |
| `migration-pending`                                                               | environment | run `tlon surface snapshot <channel>` — that posts the missing snapshot; if it refuses too, stop and say the board is stuck                                                                                                                                               | nothing, unless the repair also refuses                                |
| `state-too-large`                                                                 | environment | the board holds more than a snapshot can carry; prune it with a host event, then retry. **Do not touch the app files**                                                                                                                                                    | "That board has more in it than I can save in one go — let's trim it." |
| `partial-hydration`                                                               | environment | do not report state or snapshot; retry, then report the channel unreadable                                                                                                                                                                                                | "I couldn't read the whole history of that board just now."            |
| `bundle-unavailable`                                                              | environment | the definition read back fine; only its bundle did not. On `details.reason` of `hash-mismatch` or `unsupported-scheme`, stop — there is nothing to retry and the bytes are not the app. On `fetch-failed`, retry once. **Never revise from a regenerated bundle instead** | "I can read that app's setup but not its code right now."              |
| `create-unconfirmed`, `publish-unconfirmed`, `post-unconfirmed`, `kind-tail-lost` | environment | the write is **not** confirmed — do not claim it landed                                                                                                                                                                                                                   | "That didn't go through — let me try again."                           |

- **Never work around a gate rule.** They are load-bearing: a bundle that dodges
  the gate can still never gain capabilities, it just gets worse.
- **Never show the user violations, codes, or JSON.** Report the blocking
  condition in plain terms and stop there.
- If the folded state looks wrong, do not "fix" it by publishing a new spec.
  Read `surface state`, find which events produced it, and correct with a host
  event.

## The rest of this skill, and how to read it

This file is the whole of the skill you were handed — the other documents are
**printed by the CLI**, not opened as files. Some runtimes publish the skill's
whole directory to you; others hand over this file alone, and a file path is
only readable on one of them. The commands work on both, so use them and do
not go looking for the paths:

- `tlon surface doctrine` — the contract and doctrine (`PARADIGM.md`). Read it
  before writing code. Numbered sections; this file cites them by number.
- `tlon surface primitives` — the component catalog (`PRIMITIVES.md`). Read the
  entries for what you use; anything not listed is a runtime `undefined`.
- `tlon surface rubric` — the checks you score `surface preview`'s screenshots
  against, and the things that are preview's artifact rather than the app's.
- `tlon surface templates list` / `show <name>` — the exemplars, with the
  `NOTES.md` that says what to customize. The command is the catalogue; there
  is no directory to browse.

Each takes `--json` if you would rather have the text as a field than as
output. If one of them says the document is not installed, that is a broken
install and not something to work around: say so, and do not proceed to write
an app without the doctrine.
