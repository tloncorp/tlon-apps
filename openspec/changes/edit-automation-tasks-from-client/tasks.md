## 1. Types, Marks, and Codecs

- [x] 1.1 Add v1 edit types to `desk/sur/steward/automation.hoon` on the ACUR layout: `request-id`, `poke-status`, flat `edit` (`%create`/`%update`/`%delete`), `action-error`, `response-body`, `response`, `dispatch`, `a-automation` (existing `%project` plus `%edit`/`%finalize`), `c-automation` (`%edit`), `u-automation`/`r-automation` aliasing the existing `update`, owner-side `incoming-request`, and bot-side `pending-command`.
- [x] 1.2 Add JSON codecs in `desk/lib/steward/automation-json.hoon`: dejs for the new `a-automation` variants, enjs for `dispatch` and `response`, reusing the existing task codecs.
- [x] 1.3 Extend `desk/mar/steward/automation/action-1.hoon` to parse the new variants; add `command-1.hoon` (noun), `dispatch-1.hoon` (JSON out), and `response-1.hoon` (noun and JSON out).
- [x] 1.4 Codec tests in `desk/tests/lib/steward-automation-json.hoon`: round-trips for each edit variant, patch-shaped update, `at` in milliseconds, every response body, and rejection of malformed envelopes.

## 2. Owner-Side Request Loop

- [x] 2.1 Extend the unreleased `state-1` automation slice with `requests` and `pending` maps (no version bump, per the branch-only-state rule); the released-state migration bunts both; migration tests updated.
- [x] 2.2 Bind `/steward/~/v1` in Eyre on init and upgrade; add `POST /steward/~/v1/automation` with authenticated-session gating, defensive parsing, request-id minting, and the held-open request record.
- [x] 2.3 Route the `a-automation` `%edit` variant into the same dispatch as HTTP; reject foreign sources.
- [x] 2.4 Implement the relay: watch the bot's `/v1/automation/request/<owner>/<uv>` on a wire carrying bot and id, poke `c-automation` `%edit`, arm the 20-second wake; handle watch nack, poke ack/nack, response fact, and leave.
- [x] 2.5 Implement `finalize-request`: store the result, give the fact on `/v1/automation/request/<uv>`, complete the held HTTP request once; implement `finalize-pending` on the wake.
- [x] 2.6 Add `GET /steward/~/v1/automation/request/<uv>` (marks fetched, 404 when unknown) and the local-only per-request watch path with replay of a stored terminal result.
- [x] 2.7 Add `GET /steward/~/v1/automation/tasks` returning the mirror scry JSON.
- [x] 2.8 Add the periodic cleanup sweep with the notes eviction schedule.
- [x] 2.9 Owner-side tests in `desk/tests/app/steward.hoon`: id minting and honoring, foreign edit rejected, watch-before-poke card order, each nack path, in-time response, pending wake, late response after pending, replay on subscribe, unknown-id 404, sweep behavior.

## 3. Bot-Side Command Loop

- [x] 3.1 Admit `%steward-automation-command-1` only from the configured owner; reject others without recording.
- [x] 3.2 Add the per-request watch path admitting only the requester named in the path.
- [x] 3.3 Add the local-only `/v1/automation/harness` feed; on subscribe replay outstanding commands as `dispatch` facts; give one fact per accepted command.
- [x] 3.4 Implement the presence check against `sup.bowl`, immediate `harness-offline`, and the pending record with no deadline, bounded only by the sweep's long pending window.
- [x] 3.5 Admit `%finalize` only from the local source; finalize on the requester's per-request path and drop the record; ignore unknown ids.
- [x] 3.6 Bot-side tests: owner accepted, foreign rejected, harness-offline fast path, replay on harness subscribe, response routing, late response delivered, unknown-id response ignored, and an assertion that the automation task map is unchanged across every path.
- [x] 3.7 End-to-end Hoon test with owner and bot cores in one test: edit in, command out, response back, client fact delivered.

## 4. OpenClaw Plugin

- [x] 4.1 Subscribe from the monitor, which owns the SSE client, next to the lens subscription; reach the cron service through the accessor the telemetry observer already stashes (`getCronServiceAccessor`) instead of widening the shared connection params.
- [x] 4.2 Add `steward-automation-edit.ts`: Zod schemas for incoming commands; mapping to `CronService` `add`/`update`/`remove` input including `at` milliseconds → ISO, payload kind/message → `systemEvent`/`agentTurn`, required-field checks for create, and a deterministic job id derived from the request id passed to `add`.
- [x] 4.3 Register harness-feed subscription at `gateway_start` under the exactly-one-runnable-account gate; hold `getCron`; serialize per bot; apply and poke `%finalize`; unsubscribe at `gateway_stop`.
- [x] 4.4 Map outcomes: `add` → `created` with the derived id; duplicate-id rejection → `created` with the same id; `update` → `updated`; `remove` `removed:false` → `not-found`; thrown → `harness-error`; validation failure → `invalid`.
- [x] 4.5 Tests: each mapping, each outcome, replayed commands on resubscribe including an idempotent replayed create, multi-account no-subscribe, serialization of two commands for one job, and a fixture check of the accepted input shape against 2026.5.28, 2026.7.1-2, and 2026.8.2 schemas.

## 5. API Client

- [x] 5.1 Add `packages/api/src/client/stewardAutomationApi.ts`: `createAutomation`, `updateAutomation`, `deleteAutomation`, `getAutomationRequest`, `awaitAutomationRequest`, `getAutomations`, `scryAutomations`, `subscribeToAutomations`, with typed `StewardAutomationEditError` and `StewardAutomationPendingError` mirroring the notes envelope errors; wire types in `packages/api/src/urbit/stewardAutomation.ts`.
- [x] 5.2 Export from the api package index; add unit tests for envelope handling and request-id passthrough.

## 6. Documentation and Validation

- [x] 6.1 Update `docs/backend/desk/app/steward.md`: replace the "no task mutation surface" statement with the edit loop, HTTP surface, harness feed, error vocabulary, marks, and paths; update the poke and subscription surface lists.
- [x] 6.2 Update `packages/openclaw/README.md` for the harness subscription and edit application.
- [x] 6.3 Compile the desk and run the targeted Hoon tests on a dev ship (rapsed `%groups` via its MCP tools, after merging develop so the desk loads); a live self-owned edit round-trips to a typed `harness-offline`.
- [x] 6.4 Run plugin format, lint, typecheck, unit tests, and api-package tests.
- [x] 6.5 Exercised create and update cross-ship (owner simtyc → bot rapsed → OpenClaw 2026.5.28 in the dev container) over the owner's HTTP surface; the mirror on simtyc reflected both; delete, late pickup by id, every typed error path, and harness-offline with the container stopped also verified live. Pending-then-replay after a harness restart is covered by unit tests only. Two live-only bugs found and fixed: eyre's http-response watch, and the created id on hosts that ignore a requested id.
