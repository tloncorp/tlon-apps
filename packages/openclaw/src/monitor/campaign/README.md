# First-week onboarding campaign

The channel monitor checks the campaign at startup and every 15 minutes, using
its existing five-minute settings interval. There is no campaign timer, service,
queue or user cron job. A due tip can make one bounded model call for wording. `model.ts` makes timing decisions with a
supplied clock; `runner.ts` saves progress; `live.ts` connects messages and cron.

## Rollout

Default off. Review the single set of templates before enabling a cohort under
`channels.tlon`:

```json
{
  "onboardingCampaign": {
    "enabled": true,
    "enrollAfter": "2026-10-01T00:00:00Z",
    "copy": {
      "own-material": "Send me a note or link about a project. I can help you work out what to do next."
    }
  }
}
```

Use the actual rollout boundary. Optional per-step copy overrides support
`{topic}` and `{task}`; keep them truthful about whether notes or results exist.
The first tip always includes opt-out instructions.

One runnable Tlon account per gateway is required because cron state is shared.
The first signup intro carries timezone and `campaignVersion: 1`; returning
accounts and later groups omit the version. Only authenticated owner intros
newer than the cutoff and within five minutes of the gateway clock can enroll.
The first server observation starts the week once per owner. No old-user backfill.

The Frankenpool QA deployment is temporarily coupled through
`TLON_CONFIG=frankenpool`: it enables the campaign for fresh version-1
enrollments and replaces the day windows with consecutive one-hour windows.
It also ignores the local-time delivery window so a test can finish in one
session. All other deployments retain the explicit config above and production
timing. The gateway logs the resolved deployment name, enabled state, and
interval at campaign startup so operators can verify the coupling without
reading the campaign database.

## Conversation flow

- Reuse structured topic/purpose choices tied to bot setup cards. Save them and
  use them in subsequent replies; the owner's latest request takes precedence.
  Missing choices are fetched at most once per 15 minutes in a running monitor.
  Reply context uses task facts cached by the campaign check, not another cron read.
- Normal replies follow the owner's latest request and the onboarding skill;
  the campaign does not append a generic recurring-task pitch to useful answers.
- Existing bot tools create tasks only after agreement and resolving work,
  cadence, clock time, timezone, and destination. Campaign code creates no tasks.
- Any user recurring task, including a disabled task or one created outside
  onboarding, stops acquisition prompts. Removing it does not restart them.
  One-shot and internal heartbeat jobs do not count.
- A verified task result makes one feedback tip eligible on a regular check,
  subject to the same spacing, activity, and quiet hours as other tips. Failures
  take precedence over successful work. Feedback counts toward the five-tip cap.

Use the private onboarding channel while it contains only the owner and bot.
Public groups, extra members/invitations, or an owner who left route to the owner
DM permanently. Verify privacy before delivery; an unavailable privacy read defers.
There is no campaign presence publisher, heartbeat, or conversation-open trigger.

## Personalized wording

After a tip becomes due and marker recovery finds no prior send, a model-only
run adapts the base template to saved topic/purpose choices, the latest personal
owner message, and current task facts. It uses the owner's routed agent and
configured model, with all tools and direct delivery disabled. Context is bounded;
no extra conversation-history fetch is added. Without useful context, keep the
template. Empty, excessive, failed, or timed-out output also falls back to it.

The run has a 15-second timeout and an isolated temporary transcript that is
removed afterward. The prompt asks for one concrete workflow application in at
most 80 words, preserves the step's intent, and forbids invented work or results.
The host appends first-tip opt-out wording. Eligibility, privacy, task state, and
recent activity are checked again before delivery; changed task facts use the
fresh template. Inference does not run on idle 15-minute checks or recovered sends.

## Timing and opt-out

The five windows begin 24, 48, 72, 120, and 144 hours after enrollment and last
24 hours. Tips are at least 24 hours apart, between 09:00 and 21:00 local time,
near enrollment time or observed message activity. Unknown timezone defers.
Expired windows are skipped without a catch-up burst. Two unanswered tips suppress
intermediate steps but retain a quiet closing. Stop after seven days or five tips.

Active bot/task runs and owner messages in the past 15 minutes defer delivery.
Each check evaluates local state and reads in-process cron state; history and
privacy reads wait until delivery or missed-slot marker reconciliation is due.
A failed/blocked check can retry on the next 15-minute monitor check.

In the Frankenpool profile, “hourly” means eligible on the hour after enrollment
and delivered on the next monitor check (normally within 15 minutes). Active
conversation, recent-message, task-state, silence, privacy, and deduplication
rules still apply.

`/stop-tips` or explicit “stop these tips” requests save opt-out on the owner row.
Bare “stop” stays an ordinary bot request. Opt-out never cancels scheduled tasks.
Setting `enabled: false` stops campaign sends and command interception without
resetting progress. Commands are intercepted only for enrolled owners.

## Persistence and verification

`<OpenClaw state directory>/tlon/onboarding-campaign.sqlite` contains owner rows,
sent steps keyed by `(owner, step)`, and skipped steps. Tlon owns this SQLite file
because OpenClaw's keyed store is unavailable to local plugins. Every owner write
holds the existing per-owner lock. No store means no tip.

The durable sent table prevents replay across restarts. Bot-authored chat markers
recover accepted sends after a crash or send error. There are no permanent attempt
claims, send-slot claims, fake opt-out records, or cross-process state merges.
An ambiguous send with no visible marker may be retried and could duplicate a tip.
Pending enrollment during a storage outage survives only while the process runs.

`TlonBot Onboarding Campaign` records enrollment, send, defer/skip reason, reply,
and opt-out. Existing cron events remain separate; a reply is not conversion.

Unit tests cover inference/fallback, timing, silence, task transitions, cached
context, privacy fallback, marker recovery, opt-out, and durable sent rows.
Exercise copy and conversation quality in the disposable onboarding stack with
the configured real model; do not substitute scripted model responses.
