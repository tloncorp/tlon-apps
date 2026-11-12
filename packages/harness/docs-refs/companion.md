# Companion workflows

A companion is an agent you can reach through the web app, Tlon, or another
client. Each conversation has its own history; relevant durable facts are
shared across conversations. Use `/memory off` to opt a conversation out.

## Set up a companion

1. Configure the provider and model in Settings, then review default tools.
2. Set reusable behavior in instructions or shared skills. Memory retains
   attributed preferences and durable facts automatically.
3. For Tlon, select an owner, add trusted ships and grant only the resources
   each participant needs. Enable the reply hand and review mention policy.
4. Edit the ship's public nickname/avatar through the Tlon page if desired.
   Contacts remains the source of that profile.
5. Try a conversation and a tool, then check the result.

Defaults include broad tools. Review permissions before connecting other people.

## Research with recoverable evidence

Use web search, authorized files or configured MCP servers to collect evidence.
The conversation retains tool arguments, results and answers. Pin explicit
requirements with `/remember`; use `/context` to inspect the working budget.

Long conversations are summarized with links to their sources. Search finds
retained records; agents need a separate owner-only grant to search other
conversations. For exact claims, read the source rather than relying on its summary.

Fork a completed reply to explore another approach. The branch inherits that
history boundary without rerunning prior effects; subsequent changes are independent.

## Work with a Tlon community

The agent can answer DMs, mentions, and replies to its posts. Each person and
destination/thread has a distinct conversation. Thread context includes the
parent post and recent replies, not private Harness chats.

With the ship-wide Tlon grant, an authorized task can create a group, invite
members, organize channels, edit Notes or manage roles. Discover arguments with
`tlon({action: "help"})` and read native state before making changes.
Exact-target confirmations and revision checks apply to destructive operations
and publishing.

Normal answers return to the initiating conversation automatically. Use explicit
send actions for separate messages elsewhere. Group-DM tools are available, but
incoming group-DM messages do not start automatic replies.

## Schedule a report or reminder

Ask for a one-time follow-up or a recurring report. Scheduled agents receive a
brief and permitted tools, not the original transcript. Recurring schedules use UTC.

Use a literal reminder when the desired output is already known. It needs an
explicit time offset and destination, but no model or provider credits when due.
A scheduling acknowledgement confirms the saved job, not delivery of its message.

Use any authorized conversation hand; schedules belong to Harness, not Tlon.
Inspect Settings → Schedules for execution, delivery and pause state. Permission
changes can pause affected schedules; cancellation cannot retract a send already
dispatched. See [shared scheduling](scheduling.md).

## Publish and automate deliberately

Native Notes supports shared notebooks, imports and diary-copy workflows.
Plans and revision checks bind writes to inspected content and permissions.
Publishing a post or note makes the selected content publicly accessible under
the ship's hosting; it requires explicit approval.

Channel hooks are persistent Hoon programs, not conversation-local callbacks.
They can keep acting after Harness work ends or its tool grant is revoked.
Inspect, stop and remove them explicitly. Neither hook execution nor the
JavaScript tool provides hard CPU isolation.

## Recover without repeating uncertain actions

The Work panel separates received input, running work, completed inference,
sending and uncertain delivery. Inspect the session for model failures and the
publication ledger for send failures.

Correcting credentials or changing a model affects subsequent requests; it does
not automatically retry failed work. A known-unsent publication can be explicitly
retried without rerunning inference. An uncertain send needs destination
evidence before a retry decision.

See [hand recovery](hands.md#claims-and-receipts) and
[Tlon operation](tlon.md#delivery-and-operation) for delivery and record retention.

## Connect more surfaces

An editor uses ACP; another Urbit app uses native nouns; a mailbox or chat
connector implements the hand protocol. Remote ships can ask the agent or call
granted tools directly under authenticated Urbit identity.

See [integrations](integrations.md) to choose a connection method.
