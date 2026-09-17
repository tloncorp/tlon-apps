# First-week onboarding campaign

The existing channel monitor owns one minute timer. `model.ts` evaluates timing
with a supplied clock; `runner.ts` persists progression; `live.ts` connects Tlon
messages, presence, and OpenClaw cron state. Tips need no extra model call,
service, queue, or user cron job. Normal replies carry the conversational part
of the campaign.

## Rollout

Default off. Review the message copy before enabling a cohort. Configure the
selected gateways under `channels.tlon`:

```json
{
  "onboardingCampaign": {
    "enabled": true,
    "enrollAfter": "2026-10-01T00:00:00Z",
    "direction": "useful",
    "copy": {
      "own-material": "Send me a note or link about a project. I can help you work out what to do next."
    }
  }
}
```

Use the actual rollout boundary; the example is not an activation date.
Directions are `useful` (default), `archive`, and `routine`; the enrolled
owner retains their direction if configuration changes. Copy overrides support
`{topic}` and `{task}`. Missing overrides use the typed templates. Keep overrides
conditional and truthful; do not assert that notes or results exist. The first
message always includes opt-out instructions.

One runnable Tlon account per gateway is required: cron state is shared at the
gateway level. The new signup client's first intro request carries timezone and
`campaignVersion: 1`. Returning accounts and later groups omit the version.
Only authenticated owner intros newer than the cutoff and at most five minutes
old can enroll. Catch-up can recover a fresh intro; it does not backfill old
history. The server's first observation starts the week, once per owner.

## Conversation flow

- Reuse structured topic and purpose choices from owner posts tied to bot setup
  cards. Keep these facts after ordinary replies, but give the owner's latest
  request precedence. Do not restart the feature menu.
- After a useful answer or verified saved note, the normal bot turn is instructed
  to ask “Would this be useful every week?” A confirmed delivered offer suppresses
  the equivalent scheduled prompt for that direction. This conversational judgment
  is model-driven; timing and suppression are deterministic.
- Task creation still follows the ordinary bot tools: obtain agreement and resolve
  the work, cadence, clock time, timezone, and destination. Campaign code creates
  no tasks. Never claim a note, connection, or result exists without checking it.
- Any user recurring task, including disabled tasks or ones made outside guided
  onboarding, switches acquisition to feedback. Removing it does not restart
  acquisition. One-shot and internal heartbeat jobs do not count.
- After verified task delivery, the next conversation open makes feedback pending.
  It waits for safe conditions while the conversation stays visible. Failed runs
  or deliveries take precedence over successful work, including the closing tip.
  One feedback tip can replace a scheduled tip within the five-message cap.

Use the original private onboarding channel while it contains only owner and
bot. Public groups, extra members/invitations, or an owner who left route to the
owner DM. Recheck privacy before sending; once moved to DM, remain there.
Failure to read group privacy defers delivery. A reply in either personal route
receives the most recent tip plus campaign facts in the normal bot context.

## Timing and opt-out

The five windows begin 24, 48, 72, 120, and 144 hours after enrollment, each lasting
24 hours. Scheduled tips are at least 24 hours apart, between 09:00 and 21:00 in
local time, near enrollment time or observed activity time. Unknown timezone
waits for a client activity signal. Expired windows are skipped; no catch-up burst.
Two unanswered tips suppress intermediate steps but retain a quiet closing.
Everything stops after seven days or five proactive messages.

Active bot/task runs and recent owner messages defer delivery. The shared client
publishes bot-only `other` presence while its conversation is focused and the app
is active. One token identifies each open; 30-second keepalives expire after
90 seconds. Close events retain the token so an older view cannot close a newer
one. This uses existing `%presence`, with no chat control posts or backend change.
Older clients still get the recent-message/active-run checks but cannot trigger
open-based feedback.

`/stop-tips` and explicit requests such as “stop these tips” persist opt-out.
Bare “stop” remains an ordinary bot request. Opt-out never cancels scheduled work.
Disabling the flag stops campaign delivery without resetting state.

## Persistence and verification

State is in `<OpenClaw state directory>/tlon/onboarding-campaign.sqlite`. Tlon
owns this file because OpenClaw restricts its generic keyed-store API to bundled
or trusted official plugins, while Tlon also runs as a local plugin. SQLite
atomically claims enrollment, each step, and up to five send slots. Opt-out has
its own durable record. No writable store means no tip.

The sent list and bot-authored post markers reconcile accepted sends. A permanent
attempt claim prevents duplicate retries across workers/restarts; an ambiguous
send with no visible marker may lose a tip rather than repeat it. Enrollment
observed during a storage outage survives only until that process exits.

`TlonBot Onboarding Campaign` records enrollment, direction, send, defer/skip
reason, reply, and opt-out. Existing cron events describe creation/delivery and
remain separate from campaign sends. A reply event is not proof of conversion.

Tests cover clock decisions, silence, task transitions, privacy fallback,
presence ownership/lifecycle, reply context, suppression, opt-out, restart, and
independent SQLite claims. The shared fake-ship case exercises a real owner
intro, marked delivery, useful reply/offer recording, and durable opt-out:

```sh
pnpm --dir packages/openclaw test:integration:shared:package test/cases/14-onboarding-campaign.test.ts
```

The harness accelerates only its disposable fixture's enrollment clock. Copy and
real-model conversational quality still require cohort review before rollout.
