# @tloncorp/tlon-bot-e2e

Private workspace package for shared Tlon bot E2E infrastructure.

The shared runner starts a driver-specific Docker runtime for Hermes or OpenClaw, then runs common scenarios through the shared scenario DSL and `ScenarioActors` abstraction. Package-specific suites remain available for driver divergences.

## Local Env Files

The shared runner loads `packages/tlon-bot-e2e/.env` before selecting a driver or resolving runtime paths. Shell environment variables take precedence over the file, so CI and one-off command overrides continue to work normally.

Use `packages/tlon-bot-e2e/.env.example` as the template for local values such as `TLON_BOT_E2E_DRIVER`, `TLONBOT_DIR`, `TLONBOT_TOKEN`, `BRAVE_API_KEY`, and the `TEST_STORAGE_*` settings used by media/blob scenarios. The shared loop scenario also accepts `TLON_KNOWN_BOT_USERS` and `TLON_MAX_CONSECUTIVE_BOT_RESPONSES`; defaults are chosen by the drivers so the baseline suite works without local overrides.

Runner controls such as `TLON_BOT_E2E_SUITE` and `TLON_BOT_E2E_SCENARIO_PARTITIONS` are also allowed in this package `.env` for local workflows. Shell values still win over the file, so commands can override them for one-off runs without editing local config.

The loader only accepts the explicit harness allowlist in `src/runtime/env.ts`. Unknown keys fail the run instead of being passed through implicitly. Docker Compose is still launched with `.env` auto-loading disabled, so package-local files such as `packages/openclaw/.env` and `packages/hermes-tlon-adapter/.env` do not bleed into shared E2E containers.

## Fake Model

The fake model exposes an OpenAI-compatible Chat Completions test oracle:

-   `GET /health`
-   `GET /v1/models`
-   `POST /v1/_scripts`
-   `DELETE /v1/_scripts`
-   `GET /v1/_received`
-   `POST /v1/chat/completions`

Use constructed clients in shared tests:

```ts
import { FakeModelClient, createFakeModelServer } from '@tloncorp/tlon-bot-e2e/fake-model';

const server = await createFakeModelServer().listen({ port: 0 });
const fakeModel = new FakeModelClient(server.baseUrl);
```

The CLI wrapper remains available for Docker/manual use:

```bash
PORT=4000 node packages/tlon-bot-e2e/src/fake-model/server.mjs
```

OpenClaw's current container-visible server path remains `packages/openclaw/test/support/fake-model/server.mjs` for Milestone 1.

Model scripts can declare driver auxiliary calls in `ModelScript.options.allowedAuxiliaryCalls`. The fake model classifies those server-side and does not advance the scripted primary-call sequence; shared assertions and settling helpers likewise count primary calls only.

## Shared Common Runtime

Run the baseline common scenarios with:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:openclaw
```

The runner allocates host ports by default, renders a unique compose project name per capability partition, scrubs ambient compose env, starts shared `ships` and `fake-model` services, then starts the selected bot service through the driver.

Current common baseline scenarios are:

-   no-model connectivity checks across bot, owner, and third-party ships
-   owner DM text reply
-   owner DM `tlon` tool call followed by final assistant text
-   unauthorized third-party DM produces no fake-model call and no direct reply
-   allowlisted third-party DM receives a reply
-   owner DM still works when channel owner-listen is disabled
-   owner-listen channel dispatch for owner plain posts, global disable, per-channel mute, and mention overrides
-   `/owner-listen all off` and `/owner-listen all on` settings persistence
-   practical known-bot loop protection with a BotProfile-shaped `~mug` sender and human reset
-   reaction on a bot-authored channel root dispatches an acknowledgement on both drivers (threaded by OpenClaw; top-level by Hermes under the shared `reply_in_thread: false` config)
-   reaction on a bot-authored root DM reply, covering reaction dispatch and acknowledgement anchoring (threaded by OpenClaw; top-level by Hermes under the shared `reply_in_thread: false` config)
-   channel thread-root anchoring, participated-thread follow, and an unparticipated-thread control
-   reaction on a bot-authored channel thread reply, covering the reply-reaction route and thread-root acknowledgement anchoring
-   DM thread anchoring, including a check that the follow-up does not appear in the main DM
-   stop/start replay coverage is selected and visibly skipped pending [TLON-6098](https://linear.app/tlon/issue/TLON-6098): neither runtime replays messages received while the bot is down; the intact scenario remains the regression gate when reconnect replay lands
-   Hermes-only no-agent cron delivery to `TLON_HOME_CHANNEL`, with a future one-shot fired through `run_one_job(..., adapters=None, loop=None)` so the test uses the standalone sender path without racing the gateway ticker

The reaction scenarios cover dispatch and acknowledgement anchoring only. `packages/openclaw/src/monitor/history.test.ts` is the deterministic gate for pre-echo ID normalization and exact-reply cache-miss fetching.

The cron scenario deliberately covers Hermes only. OpenClaw's existing package-level heartbeat coverage verifies its proactive target today; the symmetric shared proactive scenario is tracked by TLON-5931. A model-driven cron turn is tracked by [TLON-6150: bot e2e: cron-enabled capability partition (model-driven cron turn)](https://linear.app/tlon/issue/TLON-6150).

## Current gates

Reaction parity depends on the Hermes reaction and DM parent-author behavior introduced by PR [#6108](https://github.com/tloncorp/tlon-apps/pull/6108). The restart scenario remains registered rather than filtered out, so Vitest reports its TLON-6098 skip reason until missed-message replay after reconnect is implemented.

Shared scenarios use `src/runtime/docker-direct.ts` for service lifecycle work. It resolves exactly one container by Compose project/service labels, verifies a fresh running state after start, and provides bounded direct `docker exec` calls. This is necessary because scenario processes rehydrate runtime context without a Compose handle.

Common scenarios default to the `baseline` partition. Future media, image, and storage scenarios should declare capabilities and run only through matching partitions:

```bash
TLON_BOT_E2E_SCENARIO_PARTITIONS=all pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes
```

## Package-Specific Suites

Run driver-specific scenarios separately with:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes:package
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:openclaw:package
```

OpenClaw package-specific runs still execute package Vitest files one process at a time. Additional OpenClaw file paths can be passed after `--`.

OpenClaw's shared-runtime replacement for the package integration suite runs both the common shared scenarios and the package-specific OpenClaw files:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:openclaw:all
```

From `packages/openclaw`, this is exposed as:

```bash
pnpm test:integration:shared
```

## Hermes Runtime Details

The Hermes E2E compose path does not load `packages/hermes-tlon-adapter/.env`. It writes a fresh `$HERMES_HOME/config.yaml` with:

-   `model.provider: custom`
-   `model.default: tlon-test-scripted`
-   `model.base_url: http://fake-model:4000/v1`
-   `model.api_mode: chat_completions`
-   baseline `platform_toolsets.tlon: [tlon, no_mcp]`
-   empty `mcp_servers`
-   `agent.disabled_toolsets: [cronjob]`

The fake ship service preserves the current rube-27 / `vere-v4.5` runtime pairing and deterministic fakezod access codes. Startup logs include artifact URLs, cache hit/miss state, byte sizes, and checksum results. The rube archive checks use the MD5 ETags exposed by `bootstrap.urbit.org`; the Vere archive uses a checked SHA-256.

## Unit Tests

The package `test` script is safe under root recursive invocations such as:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test -- run -u
pnpm --filter @tloncorp/tlon-bot-e2e test -- run
```

It runs fake-model and pure runtime/driver unit tests and does not start Docker.
