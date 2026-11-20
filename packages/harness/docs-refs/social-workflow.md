# Conversation work and selected document delivery

Ordinary answers return to the conversation automatically. Sending a saved
document is a separate choice: the owner selects the exact text and destination.

## Agent-managed tasks

Agents track larger jobs with tasks and optional projects. They do the work in
their conversation or delegate it, then record outcomes. Creating or assigning
a task does not start execution; a later follow-up needs a schedule or active
worker. See [task coordination](workspaces.md#coordination).

## Selected document delivery

Select a saved task result to preview its accepted body, recipient, and destination.
Confirmation queues that text for delivery. Later document edits do not change
the queued message. The hand checks source authority, destination, content, and
record incarnation before sending; inspect its receipt to learn whether delivery
succeeded.

Saving, accepting, publishing, and sending are separate actions. Document sharing
does not include private conversations, and agents need authorization to copy
private material into shared records. If delivery is uncertain, inspect the
destination before deciding whether to resend.

The [inbox](inbox.md) shows tasks, proposals, and delivery receipts.
[Conversation controls](work-control.md) provide previews and confirmation;
the [scheduler](scheduling.md) handles future work.

## Local verification

```sh
SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/test-ship-cookie \
  SOAK_EXPECT_SHIP='~your-test-ship' node tests-js/social-workflow-conformance.mjs
```

The fixture checks loopback host and owner identity. A deterministic local model
and in-memory delivery sink exercise the real head, Workspace, Notes, scheduler,
and inbox. Coverage includes deduplication, authorship, review permissions, exact
reply text and destination, and uncertain delivery. It makes no remote model
calls, social sends, or public pages.

Cleanup cancels fixture schedules, disables bindings, and archives the project
and artifact. Conversations, tasks, proposals, and receipts remain under the
printed fixture prefix. An incomplete run leaves its task blocked and reports
cleanup failures. Global model settings and policy are unchanged.
