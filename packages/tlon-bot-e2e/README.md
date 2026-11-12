# @tloncorp/tlon-bot-e2e

Private workspace package for shared Tlon bot E2E infrastructure.

The shared runner starts a driver-specific Docker runtime for Hermes, OpenClaw or Harness, then runs common scenarios through the shared scenario DSL and `ScenarioActors` abstraction. Package-specific suites remain available for driver divergences.

## Local Env Files

The shared runner loads `packages/tlon-bot-e2e/.env` before selecting a driver or resolving runtime paths. Shell environment variables take precedence over the file, so CI and one-off command overrides continue to work normally.

Use `packages/tlon-bot-e2e/.env.example` as the template for local values such as `TLON_BOT_E2E_DRIVER`, `TLONBOT_DIR`, `TLONBOT_TOKEN`, `BRAVE_API_KEY`, and the `TEST_STORAGE_*` settings used by media/blob scenarios. The shared loop scenario also accepts `TLON_KNOWN_BOT_USERS` and `TLON_MAX_CONSECUTIVE_BOT_RESPONSES`; defaults are chosen by the drivers so the baseline suite works without local overrides.

Runner controls such as `TLON_BOT_E2E_SUITE` and `TLON_BOT_E2E_SCENARIO_PARTITIONS` are also allowed in this package `.env` for local workflows. Shell values still win over the file, so commands can override them for one-off runs without editing local config.

After the fake ships become ready, the runner assembles and applies the checkout's `%groups` desk. `TLON_BOT_E2E_DESK_SHIPS` selects a comma-separated ship set and defaults to `~zod,~ten,~mug` — every ship the harness boots. Narrowing it leaves the omitted ships on their pier's desk, which breaks any branch that bumps a negotiated protocol version. This requires `just`, `yq` and `rsync`, as described in the root desk-dependency documentation.

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
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:harness
```

The runner allocates host ports by default, renders a unique compose project name per capability partition, scrubs ambient compose env, starts shared `ships` and `fake-model` services, then starts the selected bot service through the driver. A driver without a bot service (Harness) builds and starts no bot container.

A scenario's `driverSkips` names the drivers that cannot run it and why. On those drivers the scenario is registered as skipped and its reason is printed as a `[tlon-bot-e2e] skip <id>: <reason>` line.

Current common scenarios are:

-   no-model connectivity checks across bot, owner, and third-party ships
-   `bot-info` identity publication on the bot profile and its replication to the owner's peer contact
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
-   model-driven cron creation, scheduler firing, and origin delivery on all three drivers in the `cron` capability partition

The reaction scenarios cover dispatch and acknowledgement anchoring only. `packages/openclaw/src/monitor/history.test.ts` is the deterministic gate for pre-echo ID normalization and exact-reply cache-miss fetching.

Run the model-driven cron scenario alone with:

```bash
TLON_BOT_E2E_SCENARIO_PARTITIONS=cron pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes
TLON_BOT_E2E_SCENARIO_PARTITIONS=cron pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:openclaw
TLON_BOT_E2E_SCENARIO_PARTITIONS=cron pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:harness
```

The no-agent cron scenario deliberately covers Hermes only. OpenClaw's existing package-level heartbeat coverage verifies its proactive target today; the symmetric shared proactive scenario is tracked by TLON-5931.

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

## Harness Runtime Details

Harness runs on the bot ship `~zod`. Once the branch `%groups` desk is applied, the driver builds `packages/harness` with `just --justfile packages/harness/justfile out=<dir> build`, creates and mounts a `%harness` desk on `~zod`, commits and installs it, and waits for `%harness-tlon` to answer its status scry. `%mcp` is not installed. It then configures Harness over ACP through Eyre, using `packages/harness/acp/harness-acp.mjs`: `~ten` becomes the owner, the Tlon hand is enabled with `response: mentions` and no allowed or trusted ships, and the default model endpoint is the fake model's `/v1/chat/completions` as seen from the ships container.

Harness publishes a turn's final assistant text to the originating chat, so text replies are scripted as plain text steps. They expect `tlon_read_history` among the advertised tools, since every Tlon conversation is offered it; only the owner's conversations are also offered the `tlon` tool. Its `tlon` tool takes structured actions; the adapter translates only the tlon commands that enabled scenarios send, and adapter methods no enabled scenario uses throw. Harness has only the common suite. Scenarios it cannot run, or that are not enabled for it yet, are skipped with their reasons.

## Hermes Runtime Details

The image builds hermes-agent at `v0.22.6`; set `TLON_E2E_HERMES_AGENT_REF` to build another ref, and the runner logs the effective one (`[hermes] hermes-agent ref ...`) before the build. The adapter's Docker dev loop reads `HERMES_AGENT_REF` instead, so a value exported for that loop does not leak into E2E.

The Hermes E2E compose path does not load `packages/hermes-tlon-adapter/.env`. It writes a fresh `$HERMES_HOME/config.yaml` with:

-   `model.provider: custom`
-   `model.default: tlon-test-scripted`
-   `model.base_url: http://fake-model:4000/v1`
-   `model.api_mode: chat_completions`
-   `platform_toolsets.tlon: [tlon, no_mcp]` in baseline, or `[tlon, cronjob, no_mcp]` when the cron partition sets `HERMES_E2E_ENABLE_CRONJOB=1`
-   empty `mcp_servers`
-   `agent.disabled_toolsets: [cronjob]` in baseline and no disabled cronjob toolset in the cron partition
-   in the LCM lane (below), the LCM plugin in `plugins.enabled`, `context.engine` naming its engine, and `context_engine` appended to `platform_toolsets.tlon`

### LCM lane

`TLON_E2E_HERMES_LCM=1` builds the Hermes image with an LCM context-engine plugin, enables it beside the Tlon plugin (`plugins.enabled`, `context.engine`, and the `context_engine` toolset), and expects its `lcm_*` tools to be advertised on every primary model call. The runner reads the expected tool list from the installed plugin once the stack is ready. With the package suite it also boots a second stack with a small context budget and runs `src/scenarios/hermes-lcm.test.ts`, which drives a DM past the compaction threshold and checks the summary DAG and `lcm_grep` recall. CI runs this as the `lcm` shard of `.github/workflows/hermes-ci.yml`:

```bash
TLON_E2E_HERMES_LCM=1 pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes:package
```

The default plugin is lcm-x at the Hermes plugin-catalog pin, with embeddings off so no embedding model is downloaded:

| Variable | Default |
| --- | --- |
| `HERMES_LCM_REPO` | `https://github.com/electricsheephq/lcm-x.git` |
| `HERMES_LCM_REF` | `1a13744482a2448c38d6f9f0b98803f07aac6e81` |
| `HERMES_LCM_SUBDIR` | `plugin` (empty means the repo root) |
| `TLON_E2E_HERMES_LCM_PLUGIN` | `hermes-lcm-x` |
| `TLON_E2E_HERMES_LCM_ENGINE` | `lcm-x` |
| `LCM_EMBEDDINGS_ENABLED` | `false` |

`LCM_ENTITIES_ENABLED` and `LCM_DISABLED_TOOLS` pass through to every LCM stack. The compaction stack's budget (`HERMES_MODEL_CONTEXT_LENGTH`, `LCM_CONTEXT_THRESHOLD`, `LCM_FRESH_TAIL_COUNT`, `LCM_LEAF_CHUNK_TOKENS`, `LCM_MAX_ASSEMBLY_TOKENS`) can be overridden with the same-named variables, and `TLON_E2E_HERMES_LCM_TURNS` sets how many DM turns the scenario sends (default 10).

To run the lane against hermes-lcm instead, override the same variables. hermes-lcm at `main` currently faults on hermes-agent v0.22.6: its per-turn ingest fails with "file is not a database", Hermes falls back to its built-in compressor, and the `lcm_*` tools disappear.

```bash
TLON_E2E_HERMES_LCM=1 \
HERMES_LCM_REPO=https://github.com/stephenschoettler/hermes-lcm.git \
HERMES_LCM_REF=main \
HERMES_LCM_SUBDIR= \
TLON_E2E_HERMES_LCM_PLUGIN=hermes-lcm \
TLON_E2E_HERMES_LCM_ENGINE=lcm \
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes:package
```

The fake ship service preserves the current rube-\*-group-blob / `vere-v4.5` runtime pairing and deterministic fakezod access codes. Startup logs include artifact URLs, cache hit/miss state, byte sizes, and checksum results. The rube archive checks use the MD5 ETags exposed by `bootstrap.urbit.org`; the Vere archive uses a checked SHA-256.

## Unit Tests

The package `test` script is safe under root recursive invocations such as:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test -- run -u
pnpm --filter @tloncorp/tlon-bot-e2e test -- run
```

It runs fake-model and pure runtime/driver unit tests and does not start Docker.
