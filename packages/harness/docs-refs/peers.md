# Peers: agent requests and direct tools

Agents can ask another ship to do work or call its tools directly. Both use
Ames-authenticated ship identity and require permission from both ships.

## Asking side

`ask_peer(ship, prompt, task?)` sends a request to the peer's `%harness` agent
and returns its answer or error as a tool result. Requests have durable IDs and
a Behn deadline; replies must come from the addressed ship.

Both ships check their current grants. Removing local trust stops further
dispatch and rejects later results, but cannot undo accepted remote work.
Permission discovery does not require reciprocal trust.

## Serving side

Configure incoming access in **Settings → Peers**. Add an explicit peer, edit
its resource grants, optional model and shared skills, or revoke it. This is
permission to ask **your** agent; the other ship must grant you access separately
for calls in the opposite direction.

The owner and **Tlon → Trusted ships** automatically have incoming peer
access with **0 = unlimited** tokens by default. Each ordinary trusted-ship row
has a **Peer token limit** field, the recorded token count, and **Reset count**.
The count tracks recorded prompt + response usage since the last reset,
or lifetime usage when no reset is recorded. Reset applies immediately and persists across restarts without
changing the limit, grants, or conversation history. In-flight usage is charged
when recorded. The limit is checked before admitting another request; it is not a model context
window or a hard cutoff within a running response. Editing only this limit
keeps access inherited: resource permissions still follow Tlon trust, and
removing trust removes inherited access. A separately created explicit peer
grant remains until revoked in Peers.

Peer requests use the current global provider/model defaults unless a
**Serving model** override is saved in Peers. Native `%peer-config` also sets
an override. Provider credentials are managed in Settings → Providers;
peer grants do not include keys.

Each peer has a private working conversation, separate from the owner's chat.
Its grant selects tools, model, token budget, and shared skills:

```hoon
+$  peer-grant
  $:  tools=(list tool-grant)
      model=(unit @t)
      budget=@ud
      inflows=(set @t)
  ==
```

Unlisted non-owners are refused. Explicit grants and live Tlon trust determine
access. New requests use current grants; running requests can lose access but
cannot gain newly added tools.

## Full-admin ownership

**Settings → Peers → Owner · full admin** edits the single owner identity shared
with Tlon, even when Tlon replies are disabled. Owners can use `harness_admin`
for Harness configuration, credentials, skills, permissions, and conversations.
The tool routes through the existing ACP administrative handlers. It does not
grant administration of the Earth host operating system.

Only authenticated direct owner peer requests and live owner DM lanes gain
remote administrative provenance. Channel posts, schedules, rehearsal work,
and delegated model turns do not inherit it. Both dispatch and callbacks check
current identity and request generation. Owners get default resource tools,
all shared skills, and no peer token cap; an ordinary explicit grant cannot
restrict ownership. Demotion does not delete a separately stored peer grant.

On first initialization, a moon with no explicit owner selects its actual
sponsor. Detection uses `(clan:title our) == %earl` and sponsorship uses
`(sein:title our now our)`, not address bit layout. A durable marker preserves
later replacement or clearing. **Make sibling moons full admins** is off by
default; when enabled, both ships must be moons and their current `sein:title`
sponsors must match. Future sponsorship changes affect this live check.

Owner saves compare both the previous owner and sibling-owner flag; stale
edits fail. Clearing all owners disables Tlon replies.

## Remote permission awareness

`list_peer_access` lists dated permission reports received from remote ships;
`check_peer(ship)` refreshes one without inference. **Access on other ships**
in Peers exposes the same reports separately from incoming policy. A grant
change announces only that recipient's own grant, never the whole allowlist.
Reports are bounded to 256 ships and persisted across reloads. They are not a
network directory or an authorization cache. An absent report or an offline peer is not evidence of denied access.

The `%harness-access-0` mark carries `%query` and `%status`. The reported grant
describes the sender's permission for the recipient; it never modifies the
recipient's incoming grants. Receivers enforce current access on every call.

## Direct tool RPC

`list_peer_tools(ship)` discovers a permitted ship's tool schema and
`call_peer_tool(ship, name, arguments)` invokes one granted tool. `arguments`
is a JSON object. There is no serving-model turn around the invocation;
an explicitly requested cognitive tool such as a subagent may itself use a
model. The same resource-specific checks and executors serve local and remote
calls, including per-server MCP grants and per-desk Clay grants.
Invocations require mutual trust. Workspace calls additionally require the
Workspace grant in both directions. Each endpoint checks its own live grant;
dated remote permission reports never authorize a call. Ownership uses the
same live sponsor, explicit-owner, and enabled sibling-moon checks described
above; task coordination does not confer new administrative authority.

## Coordinating work across ships

Keep each task on one home ship. A coordinating agent creates a concrete task
there and passes its ID as the optional `task` argument to `ask_peer`. Harness
attaches the reference with this ship as home; the argument grants no access.
The bounded prompt contains the deliverable, completion check, dependencies,
and only authorized context. Untracked questions omit `task`.
The receiving agent reads, claims, and updates that home task using
`call_peer_tool` with the home ship's `workspace` tool. Claims are attributed
to the authenticated peer's local audit identity and display its ship. The
coordinator incorporates and verifies the answer; it does not create a second
task record merely to mirror the first. The same flow works in either direction.

The Workspace tool's `args` and the peer call's `arguments` are JSON objects,
not encoded strings. Discover the current schema before calling.
Task bookkeeping runs without serving-model inference; `ask_peer` invokes
the other agent. Creating or assigning a task alone never starts execution.
If a call times out, inspect the task before further action and never resend
an uncertain mutation automatically. Do not grant trust or tools to bypass a
failed delegation. Missing access requires an owner decision.

Each requesting ship has one active peer conversation. An additional request
is refused while that conversation is running, so its prompt and result cannot
be mixed with another assignment. A repeated in-flight request ID adds no
second input. A caller timeout does not cancel remote execution; inspect the
home task instead of resending or reassigning the work.

See [task coordination](workspaces.md#coordination) for when agents use tasks
and how they record outcomes.

The `%harness-rpc-0` mark carries:

```hoon
[%tools id=@uv]
[%invoke id=@uv issued=@da name=@t args=@t]
[%result id=@uv result=(each @t @t)]
```

Calls use a separate `peer-tool--<ship>` audit conversation. At most one is
active per peer. Durable receipts keyed by `[ship id]` prevent re-execution;
matching duplicates return the existing result, while mismatched payloads
are rejected. A ten-minute validity window (30 seconds allowed future skew)
makes eviction of completed receipts replay-safe. Pending receipts survive
eviction; the receiver rejects at its 256-receipt bound. Calls have a two-minute
deadline. A timeout cannot undo external work already accepted, so callers
must not automatically retry an uncertain operation under a new ID.

## Local MCP discovery

When the local `%mcp-proxy` agent is running, Harness registers it once as
`<@p>-mcp` at `urbit://<@p>/mcp-proxy`. The agent comes from the `%mcp` desk at
<https://github.com/tloncorp/mcp>. Existing entries, disabled entries, and
subsequent deletion are respected. Registration does not add a tool grant.
The native connection uses the MCP desk's local Gall HTTP-request interface,
not a guessed HTTP port or a stored login cookie. Normal MCP server grants,
configuration fingerprints, generation fences, response limits, and deadlines
still apply.

## Agent-request contract

The `%harness-a2a-0` mark carries the typed ask/answer payload:

```hoon
+$  ask-id  @uv
+$  request  [%ask id=ask-id kind=%text prompt=@t]
+$  response  [%answer id=ask-id result=(each @t @t)]
```

The receiver authorizes Ames' source ship before admitting the request.
Replies match the pending request ID and addressed peer.

## Published surface

Shared memory supplies bounded, attributed facts; full transcript access still
follows corpus grants. `inflows` names shared skills, not arbitrary conversations. Owners have explicit
administrative authority; ordinary grants never become owner identities.

## Verification

`tests-js/peers-conformance.mjs`, `tests-js/peer-rpc-conformance.mjs` and
`tests-js/peer-tool-client-conformance.mjs` exercise peer access, discovery,
direct calls and request handling. Use disposable ships and read each fixture's
setup requirements before running it.

Check grants, native results, and receipt IDs. See [development](development.md)
for test precautions.
