# Shared scheduled work

Ask for a follow-up, recurring work, or a reminder through an authorized
[conversation hand](hands.md), such as Tlon. Results return to the same
destination. Open **Settings → Schedules** to inspect or cancel jobs.

Active bound conversations receive `schedule_once`, `cron_add`, `cron_list`,
`cron_remove`, and `reminder_add`. Unbound browser conversations, delegated
agents, and scheduled runs cannot enable these through a configuration flag.

## Tasks and literal reminders

`schedule_once` takes a future RFC3339 `at` within 10 years, with `Z` or an
explicit UTC offset, and a self-contained `prompt` (1–4,096 UTF-8 bytes).
It runs inference once at that exact time. Include the necessary brief and
authorized sources: the isolated agent does not receive the source transcript.
Use this for one-time work and `cron_add` for recurring work.

`cron_add` requires `schedule`, `timezone: "UTC"`, `prompt` (1–4,096 UTF-8 bytes),
and `runs` (a decimal string, 1–100). Five-field expressions support wildcards,
steps, ranges and lists. Weekdays are Sunday=0 through Saturday=6; restricted
day-of-month and weekday fields use OR semantics. The next occurrence must be
within the bounded four-year search horizon. Invalid or impossible expressions
are rejected. Recurring local time, IANA zones and DST are not supported.

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

Disabling or replacing a source binding, or changing its effective grants,
pauses affected jobs. Re-enabling the source does not resume them; reschedule
explicitly. Stopping the Tlon adapter pauses nothing: its jobs wait, and a job that
came due meanwhile runs once when it's back. Hand workers authenticate actors and
deliver results.

## Timing, delivery and retention

One head-owned Behn wake follows the earliest outstanding schedule deadline.
Downtime coalesces to one run, never a missed-run backlog. The run budget advances
in the same Gall transaction as ledger admission. Pending execution or pending,
claimed or uncertain publication blocks another run of that schedule.

Results enter the hand's outbox. Check delivery separately from execution;
uncertain sends are not retried automatically. See [hand receipts](hands.md#claims-and-receipts).

The head retains up to 64 schedule records across all hands. Cancel stops future
work but cannot retract dispatched effects. Clear is allowed only for completed
or cancelled jobs whose work is settled. An unfired cancellation's unused run
budget does not prevent clearing. Run conversations, observations and delivery
receipts remain; clearing disables the run binding and strips its tool grants.

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
contains that tool's fields. The source binding supplies the hand, destination
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
single-timer replacement and durable schedule ownership. Run
`tests-js/cron-conformance.mjs` with `SHIP_URL` and `SHIP_COOKIE` on a development
ship to exercise a non-Tlon hand, native/ACP parity, model-created schedules,
literal delivery, recursive-call denial and source revocation. It uses a local
deterministic model, leaves marked conversation/receipt evidence and cancels its
fixture schedules without changing global defaults or Tlon policy.
