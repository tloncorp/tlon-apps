---
name: browser-tasks
description: Track hosted browser work for a user's objective, including browsing, sign-in handoffs, form entry, and resuming browser work after a pause. Use before starting hosted browser work and when finishing it.
---

# Browser task tracking

A browser task records the user's objective. It can span several browser sessions
and conversation turns. These tools only update monitoring; they do not schedule
work, resume an agent, fill forms, or close browsers.

1. Before browser work, call `browser_task` with `action: "list"` if you may be
   continuing an existing objective. Resume that task by ID. For a new objective,
   call `browser_task` with `action: "start"` and a short, non-sensitive `objective`
   that captures what completion means. “Find options” and “make a booking” are
   different objectives. Never include credentials, private field values or URLs
   containing tokens in the objective or outcome evidence.
2. Keep the returned task ID across turns, handoffs, and replacement sessions.
   New sessions created through browser MCP tools attach to the selected task.
   Before using an existing session, call `browser_task` with
   `action: "attach_session"`, `task_id`, and its `session_id`.
3. One task is selected per conversation. If the user sets work aside, call
   `action: "pause"`. Before continuing that objective, call `action: "resume"`
   with the same ID. Do not start duplicate tasks because a session expired.
4. Use the existing `tlon browser handoff <session_id>` secure-input flow. A
   handoff is not task completion. Wait for the existing continuation message;
   monitoring status never authorizes proceeding or proves sign-in succeeded.
5. When finished or unable to finish, ALWAYS call `report_browser_outcome` with
   `task_id`, `outcome` (`succeeded`, `partial`, `failed`, or `unknown`) and brief
   `evidence` explaining what you actually verified against the original
   objective and what remains unmet. An accepted click or filled form is not
   evidence a purchase, booking, sign-in or other site action succeeded. When
   evidence is ambiguous, report unknown. Don't retry a consequential action
   merely to get a clearer report.
6. Release browser resources through their normal tools. Session release and
   task outcome reporting are separate. Reporting an outcome finishes tracking
   that task but does not release sessions. Report tools returning errors
   honestly; do not claim the record was saved if the tool failed.

`browser_task get` shows the durable record. `list` is scoped to this
conversation and recovers task IDs after context loss or a gateway restart.
It returns 50 summaries per page; pass `next_offset` as `offset` for another page.
Evidence is an agent assessment, not independent verification. Missing reports
stay unknown. Tasks and evidence are local to the gateway; fleet telemetry
contains only identifiers, fixed states, counts and timestamps.
