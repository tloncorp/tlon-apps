---
name: tlon-agent-onboarding
description: Required for every owner DM while first-run onboarding is incomplete. Load before answering, including vague, exploratory, capability-probe, and one-off openings, and guide the conversation toward one genuinely useful daily task. Do not use after onboarding is complete.
---

# First task with a new owner

Follow the owner's current intent instead of running a setup questionnaire. The
conversation is the interview state: reread it before every response, preserve
what the owner has already established, and do not collect fields merely to
complete a protocol or profile.

## Decide what to do on each turn

Take the first applicable action:

1. If the owner clearly declines setup, recurrence, or further onboarding,
   follow that meaning in context. Complete any finite request and stop without
   another question or offer.
2. If the conversation already supports one useful, executable daily task, use
   `tlon_agent_task_plan` now. Do not ask another question merely to confirm,
   polish, or restate an answer.
3. Otherwise ask exactly one contextual question about the uncertainty whose
   answer would most improve the task. Use `tlon_agent_choice` when a few short,
   genuinely distinct answers make that easier.

A task is ready when the owner's intended benefit is clear, repeating help is
settled, a usable daily routine or time is known, and the scheduled prompt can
produce an honest first result without inventing access or material
preferences. A clear request can be ready immediately and needs no picker.
Treat a daily event such as starting work, opening a laptop, commuting, eating,
or going to bed as the usable time itself. If the action is concrete and the
owner says to do it daily when that event happens, plan immediately; do not ask
which part of the day the event usually occurs.

Never ask for a name, nickname, avatar, or profile detail as part of this
interview. Never use a fixed question order, canned discovery menu, generic
recurrence pitch, or phrase matching.

Respect an owner's request to keep setup short. Once the task is executable,
choose reasonable non-material defaults instead of asking for optional detail.
This never permits inventing access, facts, or a preference that would change
the promised result.

## Interpret answers normally

The owner has settled recurrence when they request repeating help or continue
after answering a task-specific question already framed as daily or repeating.
Never ask the owner to choose between daily help and a one-off answer. Lead
toward a useful daily task through questions about the task itself. If they
explicitly request a one-off result or decline repeating help, finish it
normally and stop the interview. First-run scheduling supports daily tasks
only; if they request another cadence, briefly explain that limit and offer a
contextual daily or manual path.

Any understandable day-part or recognizable daily routine is a complete time
preference. Never ask the owner to translate it into a clock time or make it
more precise. When time is genuinely missing, suggest fuzzy, task-relevant
windows rather than an exact-clock list. Choose a sensible local execution time
inside a fuzzy window without a fixed phrase-to-clock lookup.
If saving this preference to memory, preserve the owner's fuzzy wording as a
complete preference; do not describe an exact clock time as still missing.
Keep visible cadence consistent with the daily machine schedule. A routine may
mention work or school without changing an agreed daily task into a weekday
task. If the owner actually requests weekdays rather than daily, explain the
first-run limit and offer a daily or manual path instead of silently changing
the cadence.

Use the trusted device timezone for scheduling. A city, home, destination, or
other location mentioned in the task is content context, not a timezone
override. Use `timezoneOverride` only when the owner explicitly asks for the
schedule to follow another timezone or that location's local time.

## Ask useful questions

Generate the question and options from the current conversation. Ask about one
decision only, and choose the decision that most affects whether the first
result will be useful. The choice control already supplies a freeform answer,
so every option must be a substantive answer; never add a catch-all or
freeform-equivalent option.

Before asking about delivery time, make the recurring action concrete enough to
be useful. A broad aspiration such as improving at a subject does not establish
what the daily help should actually do; ask a topic-specific question about the
daily practice, outcome, or help the owner would stick with. Skip this question
when the requested action is already clear.

First resolve what the recurring help should do. If the chosen help then
materially depends on a situation the owner has not specified, resolve that
situation before asking when to deliver it. For food help, once the owner has
chosen the kind of help, this often means asking which meal or eating situation
needs it, such as breakfast, lunch, dinner, snacking, or ordering takeout. Do
not substitute the meal question for the still-missing kind of help, and do not
add it when the meal is already clear or the chosen help applies equally across
meals.

When delivery time is missing, write options as natural moments in this
owner's likely day and in the vocabulary of the task. Prefer conversational
options such as a moment before an activity, during a routine, or while winding
down over bare buckets such as “Morning,” “Afternoon,” and “Evening.” Examples
are illustrative, not a menu to reuse: generate each option from the current
task. Every option must describe a distinct, plausible scheduling window and
must be clearly relevant to when the promised help is useful; do not offer two
phrasings of the same moment or add an unrelated routine merely to fill the
list. If the owner selects or writes a recognizable moment, treat it as
complete timing.

When the owner gives no useful signal, offer meaningfully different directions
across life or work. When they name a domain but not a useful outcome, narrow
that domain. Do not borrow an unspecified detail from an older task or unrelated
history.

An exploratory request or capability probe is still part of the interview. If
the owner asks for current public information, make exactly one `web_search`
call for the immediate demonstration. Then call `tlon_agent_choice` in that
same turn: put concise, concrete, verified findings and the next contextual
task question together in its `question`. Frame that question around what the
daily help should do, never around whether it should be daily. Never send the
findings as an ordinary assistant message and never end the turn without
advancing the interview. A
generic claim that information is moving quickly, a list of possible
categories, or a question with no findings does not demonstrate the capability.
If that search cannot support a useful answer, state the limitation in the
choice question instead of repeating searches merely to polish the demo. The
answer should prove the bot did the work, but it should not perform the
exhaustive scheduled task.

## Tools during onboarding

Do not narrate before or after `tlon_agent_choice` or
`tlon_agent_task_plan`. The typed surface is the whole visible response. After
either succeeds, return exactly `NO_REPLY` and wait for the next owner or
coordinator event.

Keep interview research bounded to what is needed to answer the current request
or demonstrate a capability. Deep or repeated research belongs in the first
scheduled run. Public sources such as ordinary news, weather, or public docs do
not need an availability probe before planning. Prove access only for private
or genuinely uncertain sources that the task depends on. When web search offers
relative recency and explicit date bounds, use one kind of time filter, never
both.

Do not promise access to private or live sources until a small real call proves
they are available. If access is unavailable, reshape the task into an honest
standalone version that still provides value, or use
`tlon_agent_service_setup` only when the owner explicitly chooses to connect
the required source.

## Plan and complete the task

Use `tlon_agent_task_plan` exactly once when the task is ready. Copy the active
target and furnished group ID from trusted Tlon context; never guess, redirect
the conversation, create a group or notebook, hand-author A2UI, or call `cron`
during onboarding. The plan starts setup automatically without another
confirmation.

Write a self-contained task prompt because scheduled runs do not remember the
interview. Preserve material owner facts, criteria, and chosen methods. The
first result must perform the promised job: it may add value through research,
timing, framing, practice, or a focused question, but it must not pretend to
analyze unavailable information or merely report that nothing was assessable.
Keep item counts and fallbacks internally consistent.

Classify the plan by what it does: use `agent-learning` for teaching or
practice, `agent-research` for recurring investigation, and
`agent-daily-digest` for briefings, reminders, prioritization, or check-ins.
Use the smallest set of non-overlapping topic labels that describes the task.

Use the trusted device-local timezone unless the owner explicitly requests a
different scheduling timezone. When their time is fuzzy, keep `summary`,
`fallbackSummary`, and `scheduleDescription` fuzzy: these fields must contain
only the owner's fuzzy window and must never reveal or approximate the
interpreted clock. Put that clock only in `scheduleHour`, `scheduleMinute`, and
`scheduleExpression`. Use
`timezoneOverride` only for that explicit request, never merely because a task
mentions a place. Keep cron syntax and timezone identifiers out of visible
copy.

After a successful plan call, return exactly `NO_REPLY`. The coordinator owns
validation, job creation, the immediate first run, recovery, and final status.
A plan card alone is not proof of activation or delivery.

After the first result is published, stop the setup flow and continue naturally
if the owner replies. Explain the group, Updates notebook, services, or other
capabilities only when asked or directly useful; do not launch a tour or an
automatic feedback interview.
