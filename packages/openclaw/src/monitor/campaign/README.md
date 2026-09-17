# First-week onboarding tips

The channel monitor owns a one-minute timer. `model.ts` decides what is due,
`runner.ts` owns durable state and delivery, and `live.ts` connects the existing
OpenClaw state/cron APIs and Tlon DM transport. No extra service, queue, model
call, or per-user cron job is needed to send a tip.

## Rollout

Disabled by default. Review the five messages in `templates.ts` before enabling
for a cohort. Configure each selected gateway under `channels.tlon`:

```json
{
  "onboardingCampaign": {
    "enabled": true,
    "enrollAfter": "2026-10-01T00:00:00Z"
  }
}
```

Choose the actual rollout time; the example is not an activation date. This
version supports gateways with exactly one runnable Tlon account. Multiple
accounts defer delivery because cron jobs are shared at gateway level.

Enrollment requires the new signup client: its initial intro request includes
`campaignVersion: 1`, `isFirstGroup: true`, and the device timezone. Returning
accounts and later group creation do not send the campaign version. A validated
owner intro must be newer than the rollout boundary and at most five minutes
old. Catch-up can recover a just-posted intro before the channel watch connects;
older history never enrolls. Enrollment uses server observation time, once per
owner, regardless of subsequent requests or campaign versions.

The initial timezone allows users who abandon setup to receive tips. Missing or
invalid timezones defer delivery. Disabling the flag stops delivery without
clearing enrollment or opt-out; re-enabling skips expired slots.

## Delivery and stopping

All tips go to the owner's DM. The five slots start 24, 48, 72, 120, and 144 hours
after enrollment; each expires 24 hours later. Delivery is between 09:00 and
21:00 in the recorded timezone, at least 24 hours after the previous tip, and
15 minutes after recent owner conversation. Active message and cron runs defer
delivery. Two unanswered tips skip remaining intermediate slots but retain the
closing slot. Everything expires after seven days. No burst of missed tips.

`/stop-tips` and explicit phrases such as “stop these tips” persist opt-out and
leave scheduled tasks unchanged. Bare “stop” remains a normal bot request.
Any user recurring task, including a disabled one or one created outside guided
onboarding, permanently ends the campaign. One-shot and internal heartbeat jobs
do not. A first DM reply receives the last tip as context for the normal bot turn.

State lives in OpenClaw's `tlon-onboarding-campaign` keyed store, keyed by owner.
No store or no scheduler means no tip. Writes and checks are serialized within
the process. A durable sent list prevents routine replay after restart; marked
DM posts recover accepted sends when saving state fails. History checks inspect
50 posts. There is no distributed exactly-once guarantee: a crash plus a busy DM
that pushes the marker out of history can cause a duplicate. Pending enrollment
while the store is unavailable is retained only until process exit.

Telemetry uses `TlonBot Onboarding Campaign` with enrolled, sent, skipped, reply,
and opted-out actions. Reply means an owner DM following a tip, not attribution
of a task conversion. Existing task events remain the conversion source.

## Verification

Unit tests exercise the clock, missed slots, silence backoff, persistence,
opt-out, shutdown, task creation, DM transport, marker recovery, and reply context.
The shared client tests cover timezone and signup-only metadata.

The integration case sends an intro on disposable fake ships, accelerates only
its fixture enrollment clock, checks a real marked DM, replies “yes,” and verifies
stored opt-out:

```sh
pnpm --dir packages/openclaw test:integration test/cases/14-onboarding-campaign.test.ts
```
