# Capabilities and boundaries

An overview of what Harness can do. Each section links to setup instructions
and API details.

## Conversations and clients

Conversations keep their own history, settings, and notes on the ship. You can
switch clients, rename or delete conversations, stop work, and branch from a
completed, tool-free reply. Branching copies history without repeating its actions.
Closing a client leaves work running; stopping work cannot undo an external action.

See [ACP](acp.md) and [architecture](architecture.md#session-ownership).

## Tasks, projects, and artifacts

Agents use tasks to track work and projects to group it. Creating a task does
not launch an agent. Open Work to inspect progress or manage records yourself.

Artifacts are Notes documents with revision history and reviewable agent drafts.
You choose who can read them and which saved revision to publish. Editing does
not update a public page. Search covers conversations, saved documents, projects,
and tasks. See [tasks, projects, and artifacts](workspaces.md).

## Providers and context

Choose OpenRouter, OpenAI, Anthropic, or a compatible endpoint. Each conversation
has its own model, instructions, context limit, and tools. Defaults apply when
you create a conversation; changing them leaves existing settings alone.

**Known bug:** a conversation's tool settings don't limit owner conversations or their
subagents, so a tool turned off there can still be used. See
[known bugs](../ISSUES.md#known-bugs).

Long conversations are summarized automatically without deleting history.
Relevant shared facts enter context automatically, and agents can search
retained source material.
You can choose separate models for summarization.

See [provider authentication](acp.md#provider-authentication) and
[context and memory](context-and-memory.md).

## Tools and permissions

Tools depend on the conversation's permissions. `current_time` is always available.

| Tool family | Access |
| --- | --- |
| Clay | Files under permitted desk/path prefixes |
| Web | Brave or SearXNG search and GET-only page reads |
| General HTTP | Requests with explicit methods, headers, and bodies |
| MCP | Tools from named, enabled servers |
| Skills | Shared reusable instructions; separate writing and authoring permissions |
| Subagents | Local delegation within the parent's permissions |
| Peers | Authenticated ship-to-ship requests and tool calls |
| Corpus | Conversation recall; cross-conversation access for permitted owner sessions |
| Tlon | Ship-wide social, content, administration, and publishing tools |
| JavaScript | Opt-in execution with broad host access |

Defaults enable broad ship, web, and Tlon access. Configure MCP servers and
JavaScript separately. Review permissions before connecting external participants;
access to a tool is not approval for every action it can perform.

See [trust boundaries](architecture.md#trust-boundaries),
[MCP configuration](integrations.md#mcp-client-configuration),
[peers](peers.md), and [JavaScript execution](execution.md).

## Tlon

The Tlon hand answers permitted DMs, channel mentions, and thread replies.
The ship's Contacts profile supplies its name and avatar.

The ship-wide `tlon` tool supports messages, search, reactions, profiles, groups,
channels, roles, moderation, group DMs, Notes, uploads, channel hooks, and publishing.
Conversation tools cover history, reactions, images, and scheduling in that chat;
ship-wide access is separate. Final answers return to the chat automatically.

See the [Tlon reference](tlon.md), its [tool catalog](tlon.md#ship-wide-tlon-tool),
and [permissions](tlon.md#authority-and-conversation-scope).

## Shared scheduled work

Ask for a one-time follow-up, recurring work, or a literal reminder through an
authorized conversation hand. Results return to that destination. Scheduled
agents receive a brief and permitted tools, not the original transcript.
Open Settings → Schedules to inspect or cancel jobs. See [scheduling](scheduling.md).

## Integration and extension possibilities

Connect an editor with ACP, a tool service with MCP, an Urbit app with native
nouns, or a chat service with the hand protocol. See [integrations](integrations.md)
and [companion workflows](companion.md).

## Limits to account for

- History accumulates; summaries do not reduce stored logs or full replay cost.
- MCP supports stateless Streamable HTTP and a local native bridge, without
  session negotiation, notifications, or OAuth acquisition.
- ACP credentials have owner authority. The API does not provide an ambient
  terminal or filesystem.
- HTTP and JavaScript do not provide private-network or hard CPU isolation.
  Revocation cannot retract an external write.
- Tlon hooks can continue after a conversation or grant ends. Public content
  can be copied or cached elsewhere.
- Recurring schedules use UTC, not local-time/DST rules. Schedules and
  operational records have capacity limits.
- Local acknowledgement is not remote delivery or a read receipt. There is no
  cross-system exactly-once guarantee.

See [development and verification](development.md) for tests and their coverage.
