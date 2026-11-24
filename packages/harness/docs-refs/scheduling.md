# Shared scheduled work

Ask for a follow-up, recurring work, or a reminder through an authorized
[conversation hand](hands.md), such as Tlon. Results return to the same
destination. Open **Settings → Schedules** to inspect or cancel jobs.

Active bound conversations receive `schedule_once`, `cron_add`, `cron_list`,
`cron_remove`, and `reminder_add`. Unbound browser conversations, delegated
agents, and scheduled runs cannot enable these through a configuration flag.
On the Tlon hand only the bot's owner schedules: a turn answering anyone else,
trusted ships included, is not offered these tools, and a call from such a turn
is refused. This holds in DMs and channels, for creating, listing, changing and
cancelling. The hand decides: a conversation's hand tool ceiling also limits
scheduling, and the Tlon hand gives the owner no ceiling and keeps scheduling
out of everyone else's.

## Tasks and literal reminders

`schedule_once` takes a future RFC3339 `at` within 10 years, with `Z` or an
explicit UTC offset, and a self-contained `prompt` (1–4,096 UTF-8 bytes).
It runs inference once at that exact time. Include the necessary brief and
authorized sources: the isolated agent does not receive the source transcript.
Use this for one-time work and `cron_add` for recurring work.

`cron_add` requires `schedule`, `timezone`, `prompt` (1–4,096 UTF-8 bytes), and
`runs` (a decimal string, 1–100). Five-field expressions support wildcards,
steps, ranges and lists. Weekdays are Sunday=0 through Saturday=6; restricted
day-of-month and weekday fields use OR semantics. The next occurrence must be
within the bounded four-year search horizon. Invalid or impossible expressions
are rejected.

`timezone` is `UTC` or a fixed offset written `+HH:MM` or `-HH:MM`, with the
sign and two-digit hours and minutes, up to 14 hours: `-06:00`, `+05:30`.
`+00:00` is accepted and runs exactly as `UTC`; `-00:00`, which RFC3339 reserves
for an unknown offset, is rejected, as are `Z`, `+5`, `UTC+05:00` and IANA
names such as `America/Chicago`. The expression is evaluated on the local
calendar at that offset, so minute, hour, day, month and weekday all match
local time: `0 9 * * *` at `-06:00` runs at 15:00 UTC, and `0 23 * * 5` at
`-06:00` runs on Saturday at 05:00 UTC. Every later run, an edit and recovery
after downtime use the same offset. An offset is fixed: it does not follow
daylight saving, and IANA zones and DST rules are not supported. The job keeps
the offset as written, and listings show it.

`reminder_add` takes literal `text` (1–4,096 UTF-8 bytes) and a future RFC3339
`at` within 10 years, and optionally the conversation's own `destination`; a
reminder is delivered only to the conversation that set it. An explicit
offset or `Z` is required; unknown `-00:00` is rejected. Ask for the intended
offset rather than guessing. When due, the head admits a literal notification
and publication without inference or command parsing. `/cancel` in its text
remains text. Provider availability and credits are not needed at delivery time.

Scheduled agents receive the source configuration and permitted tools, not its
transcript or document membership. They can inherit Workspace to update tasks,
but cannot create schedules, run subagents, execute JavaScript, or administer
Harness. Editing their configuration cannot expand these permissions. The head
checks source permissions before admitting work and dispatching tools, including
Tlon's actor and conversation checks.

Disabling or replacing a source binding pauses affected jobs. So does removing
a tool that the source held when the job was created; giving the source more
tools does not. Removing JavaScript execution is the exception: a scheduled
agent never holds it, so the job continues. A Tlon job whose actor is not the
bot's owner is paused,
including after an ownership change. Re-enabling the source does not resume them;
reschedule explicitly. Stopping the Tlon adapter pauses nothing: its jobs wait,
and a job that came due meanwhile runs once when it's back. Hand workers
authenticate actors and deliver results.

## Timing, delivery and retention

One head-owned Behn wake follows the earliest outstanding schedule deadline.
A reload checks no schedule itself: with a schedule active, it sets that wake
a tick later, so the check runs after every agent on the desk has loaded and
no schedule asks a hand still on its previous code for authority. Downtime coalesces to one run, never a missed-run backlog. The run budget advances
in the same Gall transaction as ledger admission. Pending execution or pending,
claimed or uncertain publication blocks another run of that schedule.

A run's final message goes to the conversation that created the job. To post
elsewhere, the run uses the ship-wide `tlon` tool, which it has when the creating
conversation's grants include `tlon`. An owner DM has it; other conversations take
their grants from Settings → Defaults when they are created.

Results enter the hand's outbox. Check delivery separately from execution;
uncertain sends are not retried automatically. See [hand receipts](hands.md#claims-and-receipts).

The head retains up to 64 schedule records across all hands. Cancel stops future
work but cannot retract dispatched effects. Clear is allowed only for completed
or cancelled jobs whose work is settled. An unfired cancellation's unused run
budget does not prevent clearing. Run conversations, observations and delivery
receipts remain; clearing disables the run binding and strips its tool grants.

## Importing OpenClaw scheduled tasks

When Harness replaces an OpenClaw bot on the same moon,
`acp/import-openclaw-schedules.mjs` makes Harness schedules of the bot's
OpenClaw scheduled tasks once. It reads the file that
`openclaw cron list --json --all` prints in the bot's container, and never
contacts OpenClaw. Like the
[memory import](context-and-memory.md#importing-an-openclaw-memorymd), it needs
the moon's URL and a Netscape cookie file holding the moon's `urbauth-` cookie.
`--owner` names the bot's owner: every schedule is made as the owner, and the
script imports nothing unless the Tlon hand is enabled with that owner.

```sh
cd packages/harness
SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt \
  node acp/import-openclaw-schedules.mjs --from export.json --owner '~sampel-palnet' --dry-run
```

On a moon, in this order:

1. Save the export while OpenClaw still runs.
2. Stop OpenClaw, so that the two runtimes never both run a task.
3. Start Harness with the owner set. Each task becomes a schedule of an
   existing Tlon conversation, so the owner sends the bot a message in every
   DM, channel and thread a task posts to. In a channel or thread the message
   mentions the bot: by default the bot answers only mentions there, and a
   message it does not answer starts no conversation.
4. Run with `--dry-run`, which creates nothing, and read what it prints.
5. Run again without it.

Each task is mapped this way:

- A cron task becomes a recurring prompt of 100 runs. Its timezone becomes the
  zone's offset on the day of the import, such as `-05:00` for
  America/New_York in winter; a zone at UTC+0 is sent as `UTC`. The offset is
  fixed: a task imported in winter runs an hour off, in local time, while
  daylight saving is in effect. A cron task with no `tz` is refused, because
  it ran in the OpenClaw host's zone, which the export does not record.
- A one-time (`at`) task becomes a one-time prompt at the same instant, in UTC.
  One whose time has passed, or is more than ten years away, is refused.
- A delivery `to` naming the owner's ship (`~ship`, `dm/~ship`, `dm:~ship`,
  with or without `tlon:`) posts to the owner's DM; a nest such as
  `chat/~host/name`, `heap/…` or `diary/…`, with or without `tlon:`, `group:`
  or `room:`, posts to that channel. The task is refused when the ship has no
  conversation there yet.
- A task with a `threadId` posts to the existing conversation in that thread.
  With none, it is refused, unless `--threads-to-parent` sends it to the DM
  or channel instead.

These are refused, with the reason:

- a task that is not an agent turn (a system event, command, script or
  heartbeat), one with a trigger script, which would run every time, and one
  on an interval (`every`) or another schedule kind;
- a task whose prompt OpenClaw treats as untrusted outside content: one in a
  hook session (`session:hook:…`), one whose payload has an
  `externalContentSource`, and one that sets `allowUnsafeExternalContent`.
  Harness would run that text as the owner's own instruction;
- an empty prompt or one over 4,096 bytes;
- a tool list that held the task to fewer tools than its conversation may
  give it, since a schedule runs with its conversation's tools. A task with
  no `toolsAllow`, or with `["*"]`, is imported; so is one with OpenClaw's
  default list (`toolsAllowIsDefault` and at least one tool), with a note
  giving the list's size. Any other list, an empty one included whatever its
  marker, is refused; `--widen-tools` imports these tasks with a warning on
  each, giving the size of the list it had;
- delivery off (`mode: none`), or no destination in the export, since every
  schedule posts its result. `--none-to-owner-dm` posts these to the owner's
  DM;
- another ship's DM, a notebook, a webhook or another transport;
- a task past the head's 64 schedule records, counting those already held.

Disabled tasks are listed and not imported, and OpenClaw's own heartbeat,
memory-dreaming and skill-review jobs are left out. A model, stagger, pacing,
failure alert or failure destination, a session other than `isolated`, a
wake mode other than `now`, `deleteAfterRun` and a sending account other than
`default` are not carried; the script names each on the task's line. The
model, fallback models, thinking level, timeout and light-context settings
are dropped too: the conversation's own settings run the schedule. Only the
model is named on the line. A scheduled run gets no transcript, whatever
session the task used.

A recurring schedule stops after its hundredth run. For each new cron task
the script prints the date of that run, worked out from the expression and
the offset; when the four-year search runs out first, it prints the last run
it finds. For an expression outside the grammar above it prints that the date
is unknown; the head decides whether to accept it. For a schedule Harness
already holds, the date comes from the schedule's next run and the runs it
has left. Either way, a schedule that ends within 30 days is marked, so the
operator can tell the owner.

The schedule id is derived from the OpenClaw task's id, so a rerun repeats the
same creates. The head answers each with the schedule it holds, and the script
compares that schedule's timing, prompt, conversation and kind with the task:
the same is reported as already there, and a schedule edited in Harness since
the import as existing but different, left as it is. A rerun that would
create a task differently is refused by the head. That happens after the
zone's offset changes, after the conversation gets a new binding, or with a
different choice of options.

The script prints one line per task, with its label, schedule, destination,
outcome and notes, then totals. It prints no prompt. It exits non-zero when a
create fails, a schedule differs from its task, or the ship is not set up for
the owner, and zero otherwise, refusals included. A malformed export is
reported by position only, without its text.

## Native and ACP API

Owner-authenticated ACP clients use:

| Method | Parameters | Result |
| --- | --- | --- |
| `harness/cron` | optional `binding` | Schedule rows, optionally scoped to a source binding |
| `harness/cron/add` | `id`, `binding`, `actor`, `kind`, `args` | Created schedule row |
| `harness/cron/cancel` | `id` | Updated schedule rows |
| `harness/cron/clear` | `id` | Remaining schedule rows |

`id` is a canonical native `@uv` string, such as `0v1`; use a fresh id for new
work. Repeating a create with the same id and payload returns the existing job;
a conflicting payload is rejected. `kind` is `prompt` or `reminder`, and `args`
contains that tool's fields. On a Tlon binding, an `actor` who is not the bot's
owner is rejected. The source binding supplies the hand, destination
and source session; callers cannot replace these through the job arguments.

Native applications watch `/crons/[request-id]` on `%harness`, then poke mark
`%harness-cron` with `request:harness-cron`. A `%noun` fact returns
`(each json @t)`. The mark also accepts JSON `{id, action}`, with action keys
`add`, `list`, `cancel`, or `clear`. The read-only `/cron/json` scry projects
the same rows. These are same-ship/owner APIs, like the existing hand boundary.
Model tools additionally require an exact outstanding request and source input;
listing and cancellation cannot expose another source binding's schedules.

The JavaScript `HandClient` wraps these as `schedule(binding, options)`,
`schedules(binding)`, `cancelSchedule(id)`, and `clearSchedule(id)`.

## Verification

`desk/tests/harness-cron.hoon` tests strict calendar parsing;
`desk/tests/harness-schedule.hoon` tests shared validation, isolation, evidence
gates and bounded advancement. The opt-in
`desk/tests-integration/harness-schedule.hoon` exercises full-agent reload,
single-timer replacement, durable schedule ownership and scheduling within a
hand's ceiling. Run
`tests-js/cron-conformance.mjs` with `SHIP_URL` and `SHIP_COOKIE` on a development
ship to exercise a non-Tlon hand, native/ACP parity, model-created schedules,
literal delivery, recursive-call denial and source revocation. It uses a local
deterministic model, leaves marked conversation/receipt evidence and cancels its
fixture schedules without changing global defaults or Tlon policy.
`acp/import-openclaw-schedules.test.mjs` covers the import's mapping,
refusals, ids, offsets and hundredth-run dates offline.
`tests-js/import-openclaw-schedules-conformance.mjs` opens a DM and a channel
conversation with the owner on fake ships, then checks a dry run, an import
read back from `harness/cron`, a rerun that creates nothing, a task aimed at a
missing conversation, `--widen-tools` and `--none-to-owner-dm`, and a rerun
after an imported schedule is edited.
