# Multitenant OpenClaw Hosting Plan

## Goal

Run many hosted Tlon bot moons against a smaller number of central OpenClaw gateways while keeping each customer segmented by Tlon account, OpenClaw agent, workspace, state, sessions, provider credentials, and control-plane authorization.

The bot moon remains in its planet's Kubernetes workload. OpenClaw runs in a separate sharded workload and connects to each moon through its cluster-local Eyre service.

This design provides application-level tenant segmentation. It does not turn one OpenClaw process or its native plugins into a hostile-code security boundary. Tenants that require that boundary must be placed in separate gateway shards.

## Deployment modes and compatibility

The plugin remains self-hoster-first. Its existing standalone behavior is the default when `channels.tlon.deploymentMode` is absent (or explicitly set to `standalone`): one ordinary OpenClaw install may use the existing top-level Tlon credentials and no hosting control plane is required.

Central hosting explicitly sets `channels.tlon.deploymentMode: monolithic`. That opt-in enables the stricter multitenant contract: every account must have an exact agent binding, process-global credential fallbacks are forbidden, ambiguous gateway-global features fail closed, and hosted control-plane calls must name a server-authorized tenant. Features that have not yet been made account-safe remain unavailable in this mode rather than changing or weakening standalone behavior.

## Target topology

```text
planet + bot moon pod                    OpenClaw shard pod
+------------------------+              +---------------------------+
| planet                 |              | one OpenClaw gateway      |
| bot moon :8080         |<--HTTP/SSE---| N Tlon channel accounts   |
| <planet>-moon-eyre svc |              | N bound OpenClaw agents   |
+------------------------+              | per-agent state/workspace |
                                        +---------------------------+
                                                     ^
                                                     |
                                                Ylem/Solaris
```

## Tenant identity invariant

Each hosted tenant has one stable tenant ID. The generated OpenClaw configuration uses it as both the Tlon `accountId` and OpenClaw `agentId`.

Every request path must derive the tenant from trusted runtime context:

1. Inbound Tlon events carry their monitor's `accountId`.
2. OpenClaw bindings route that account to exactly one agent.
3. Tools derive the account from the executing agent/session; model-supplied account IDs are never authoritative.
4. Ylem verifies customer ownership, resolves the tenant and shard, and sends the server-derived tenant ID to internal hosting routes.

Ambiguous or missing mappings fail closed.

No customer is the default OpenClaw agent. Shards include an unbound default agent with no credentials so OpenClaw's default-agent credential fallback cannot expose one customer's credentials to another customer.

## Generated configuration

For every tenant the shard reconciler emits:

-   one `channels.tlon.accounts.<tenantId>` entry;
-   one `agents.list[]` entry with unique `workspace` and `agentDir` paths;
-   one explicit `(channel: tlon, accountId: tenantId) -> agentId` binding;
-   tenant-specific model, tool, skill, and sandbox policy;
-   `session.dmScope: per-account-channel-peer` unless product behavior deliberately calls for shared DMs inside a tenant.

The reconciler never relies on the implicit default account or a channel-wide wildcard binding.

## Phase 1: Tlon channel plugin hardening

### Account-aware tools

-   Resolve the `tlon` CLI credentials at execution time from the active session's agent and its exact Tlon account binding.
-   Apply the same resolution to internal and cron sessions.
-   Fail closed for unbound agents, multiple matching accounts, missing session identity, or missing credentials.
-   Remove process-global Urbit credential fallback from multitenant operation.

### Account-scoped runtime state

-   Scope message and reaction history caches by account.
-   Replace last-writer-wins telemetry reporter slots with an account-keyed registration lifecycle.
-   Make gateway status and API client parameters account-scoped.
-   Make context-lens event state, storage, routes, and ship sync account/agent scoped. Context lenses remain disabled in the first pilot until this is complete.
-   Make owner re-engagement nudges account-scoped.
-   Keep `/migrate` disabled for multitenant shards until its complete workflow is account-scoped.
-   Extend account config validation to every supported per-account ACL, lifecycle, and hosted setting.

### Regression coverage

-   Two accounts connected to the same public nest cannot share cached messages, dedupe decisions, reaction targets, approvals, settings, or telemetry.
-   Starting, stopping, reconnecting, or reloading one account does not mutate another account's state.
-   Inbound and outbound routing always retain the account ID.
-   A tenant cannot use `tlon`, cron, or an internal session to access another tenant's ship.

## Phase 2: `tlon-hosting-oc` hardening

### Provider authentication

-   Scope OAuth start, flow polling, completion, status, refresh, model discovery, and deletion to a trusted tenant/agent identity.
-   Store the tenant and agent on every flow and verify it on every follow-up.
-   Resolve the selected agent's auth store instead of the default agent store.
-   Never expose the gateway bearer token to customers. Ylem remains the public authorization boundary and calls shard routes with an internal service credential.

### Hosted workspace and model services

-   Sync hosted prompts into every configured tenant workspace.
-   Interpolate ship and owner values from tenant configuration rather than process-global `TLON_*` environment variables.
-   Apply hosted model policy and migrations per agent.
-   Audit cron migration and repair services for tenant-aware attribution and storage.
-   Keep subscription provider runtimes gateway-global only where the runtime is stateless and credentials remain per-agent.
-   Treat Solaris's per-ship provider configuration as the hosted source of truth. The shard reads it through Pioneer's server-token-authenticated provider-config route, renders model selection per agent, and sends API keys only over the gateway's authenticated loopback operator route.
-   Persist provider credentials with OpenClaw's current auth-store API in each agent's `openclaw-agent.sqlite`; do not generate the legacy `auth-profiles.json` or expose provider keys through process-global environment variables.
-   Keep the unbound default `main` agent credential-free and fail shard startup if its auth store contains any profile. OpenClaw exposes default-agent credentials as a read-through fallback to secondary agents, so a populated main store would violate tenant isolation even though every Horizon login is routed to an explicit tenant agent.

## Phase 3: executable three-tenant spike

Run three real bot moons against one manually configured gateway. Join two moons to the same public group and prove:

-   messages route to the intended agent;
-   replies leave through the intended moon;
-   sessions, workspaces, auth profiles, and model selection remain separate;
-   account add/remove and credential rotation hot-reload safely;
-   one unreachable or reconnecting moon does not interrupt the others;
-   provider auth operations affect only the selected tenant.

The spike is the gate before building the shared hosting controller.

## Phase 4: Ranger and Ylem control plane

### Ranger

-   Extend the current tlawn specification with an explicit local/shared runtime mode while preserving existing local behavior.
-   In shared mode, keep the moon and its existing Eyre service but omit the co-located `tlawn` container.
-   Reconcile central OpenClaw shard workloads, PVCs, config Secrets, stable tenant assignments, health, and rollout.
-   Permit shard pods to reach moon Eyre services through narrow NetworkPolicy.
-   Obtain and rotate moon connection credentials through an authenticated Pioneer/feds control-plane endpoint rather than mounting customer piers into the shard.

The initial controller is configured through Ranger's environment:

-   `OPENCLAW_SHARD_COUNT` controls the assignment pool (default `1`, maximum `128`);
-   `OPENCLAW_SHARD_IMAGE` selects the Pioneer image containing the shard supervisor (defaults to Ranger's Pioneer image);
-   `OPENCLAW_SHARD_PORT` controls the internal gateway port (default `18789`);
-   `OPENCLAW_SHARD_STORAGE` controls newly created shard PVC size (default `10Gi`).
-   `OPENCLAW_SHARD_STORAGE_CLASS` overrides the shard PVC storage class; Ranger defaults it to the bare-metal `planet-balanced` class (backed by `rancher.io/local-path`) and otherwise uses the cluster default.
-   `OPENCLAW_SHARD_TLON_CONFIG` selects the bucket-published component bundle used by all gateways in the shard pool.
-   `OPENCLAW_SHARD_ENTRYPOINT_URL` optionally overrides the environment bucket URL used to download `shard.py` and `tlawn.py`.

Assignments are recorded in `ranger.tlon.io/openclaw-shard` so ordinary reconciles and shard-count changes do not move an existing tenant. Operators may deliberately change that annotation to pin or migrate a tenant. The first implementation refreshes tenant manifests and moon codes in place; PVC/state migration and controlled drain remain explicit rollout work rather than being hidden inside reassignment.

### Ylem/Solaris

-   Remain the source of truth for customer ownership, bot enablement, provider settings, OAuth entry points, and model choices.
-   Resolve `ship -> tenant -> shard` before provider auth, health, reload, and configuration operations.
-   Proxy provider auth only after ownership checks.
-   Replace raw shared-pod log access with tenant-tagged/filterable events; raw shard logs must never be returned to one customer.

## Phase 5: migration and rollout

-   Drain each local gateway before migration.
-   Copy workspace, per-agent auth profiles, sessions, cron jobs, and required plugin state into the assigned shard paths.
-   Verify channel connection, provider auth, and an inbound/outbound round trip before removing the local `tlawn` container.
-   Start with an internal shard capped at 5-10 tenants.
-   Tune shard density from measured RSS/heap, active-turn concurrency, queue latency, reconnect storms, and failure behavior.
-   Use shard size as the initial noisy-neighbor and blast-radius control because OpenClaw's primary agent concurrency limit is gateway-wide.

## Production acceptance criteria

-   Cross-tenant canary data never appears in another tenant's prompt, history, tool result, log surface, provider status, or outbound message.
-   Tenant onboarding and removal do not restart or disconnect unaffected tenants.
-   Removing a tenant stops its monitor and revokes access before deleting its state.
-   Credential rotation reconnects only the affected account.
-   OAuth flows and refresh tokens remain confined to the selected agent store.
-   Shard restart behavior is measured for duplicate and lost delivery; no at-least-once claim is made without an executable proof.
-   A noisy-neighbor soak stays within the shard's memory limit and preserves acceptable queue latency for other tenants.

## Implementation order

1. Account-aware `tlon` tool resolution.
2. Tlon plugin shared-state scoping and config schema completion.
3. Agent-scoped provider auth and workspace handling in `tlon-hosting-oc`.
4. Three-tenant executable spike.
5. Ranger/Ylem shared-runtime control plane.
6. State migration tooling and production load testing.

## Implementation status (2026-08-14)

Completed in the first plugin pass:

-   added the opt-in `channels.tlon.deploymentMode: monolithic` contract while preserving standalone defaults;
-   made the `tlon` tool resolve credentials from the executing agent's exact account binding and fail closed on ambiguous monolithic calls;
-   prohibited top-level credential inheritance in monolithic mode and required complete `ship`, `url`, and `code` values on every named account;
-   scoped channel history, reaction targets, authorization configuration, and diary migration discovery notices by account;
-   serialized operations using `@tloncorp/api`'s process-global client, reconfiguring it for the active account immediately before sends, uploads, actions, and computing-presence updates;
-   replaced last-writer-wins telemetry slots with account-keyed registrations whose cleanup cannot remove a replacement monitor;
-   explicitly disabled the still-global gateway-status, context-lens, re-engagement, and migration-command paths in monolithic mode;
-   made `tlon-hosting-oc` provider-auth flows and auth-store operations agent scoped, including flow ownership and exact account-binding checks;
-   made hosted session-model migration resolve each agent's effective default independently;
-   made hosted prompt sync enumerate exact account bindings, interpolate each account's ship/owner/Eyre values, and update all tenant workspaces from one downloaded archive.
-   stopped gateway-global subscription-provider discovery from using a tenant workspace in monolithic mode;
-   added a tenant-scoped hosting health route that validates the requested agent's exact Tlon account binding;
-   added an opt-in Ranger `tlawn.mode: monolithic` deployment contract that retains the bot moon, omits the per-ship OpenClaw container, and injects the remote gateway address, trusted agent ID, and secret-backed bearer token only into Pioneer API;
-   taught Pioneer to overwrite client-supplied tenant identity on provider-auth requests, proxy to the configured central gateway, and use the tenant-scoped route for gateway health; standalone loopback behavior remains the default.
-   extended Ylem's Voyager Ship codec so Solaris preserves `mode`, gateway coordinates, secret references, and `pluginBranch` when it decodes and rewrites Ranger resources; moon/config patches now use record updates so future deployment fields are preserved too.
-   added executable provider-route isolation coverage proving an Anthropic login flow created for one bound agent is invisible to another bound agent.
-   added Ranger's shared shard reconciler: opted-in ships receive a sticky rendezvous assignment and trusted gateway coordinates, while each active shard gets a generated tenant config Secret, persistent token Secret, private Service, StatefulSet/PVC, and Pioneer-only ingress policy;
-   added a Pioneer-image shard supervisor that retrieves each moon's `+code` from the authenticated in-cluster Pioneer endpoint, atomically renders the runnable config on the shard PVC, preserves the last credential during a temporary ship outage, and refreshes projected tenant configuration without putting moon codes into Ship specs;
-   moved that supervisor to bucket-published `tlonbot/entrypoint/shard.py`; the Pioneer image now downloads it at startup with an image-bundled fallback, and the self-contained shard bootstrap reads the component bundle and atomically builds/installs the selected Tlon plugins without invoking per-ship `tlawn.py` or inspecting a pier;
-   made shard PVCs select the `planet-balanced` local-path-backed class automatically on bare-metal Ranger deployments (with an explicit storage-class override) and allowed enough startup time for branch-selected plugin builds;
-   restricted the shard process to the single `PIONEER_SIDECAR_TOKEN` key rather than exposing the rest of `voyager-env-secrets`.

Still required before the three-tenant spike:

-   finish the cron device-scope repair audit for remaining process-global authorization assumptions;
-   add an executable two-account live-monitor routing test.
-   exercise the generated StatefulSet against a real Pioneer image and three live moons, including OpenClaw hot reload after tenant add/remove and `+code` rotation;
-   add shard capacity/rebalancing controls and migration of existing per-ship workspace, auth, session, and cron state before production rollout.
