# @tloncorp/tlon-bot-e2e

Private workspace package for shared Tlon bot E2E infrastructure.

Milestone 2 adds the minimal shared Docker runtime for the Hermes smoke subset.
OpenClaw scenario migration and the full shared scenario DSL remain later work.

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

## Hermes Smoke Runtime

Run the Hermes-only shared smoke harness with:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test:e2e:hermes
```

The runner allocates host ports by default, renders a unique compose project
name, scrubs ambient compose env, starts shared `ships` and `fake-model`
services, and then starts the Hermes `hermes-tlon` service through the Hermes
driver.

The Hermes E2E compose path does not load `packages/hermes-tlon-adapter/.env`.
It writes a fresh `$HERMES_HOME/config.yaml` with:

-   `model.provider: custom`
-   `model.default: tlon-test-scripted`
-   `model.base_url: http://fake-model:4000/v1`
-   `model.api_mode: chat_completions`
-   baseline `platform_toolsets.tlon: [tlon, no_mcp]`
-   empty `mcp_servers`
-   `agent.disabled_toolsets: [cronjob]`

The fake ship service preserves the current rube-27 / `vere-v4.5` runtime
pairing and deterministic fakezod access codes. Startup logs include artifact
URLs, cache hit/miss state, byte sizes, and checksum results. The rube archive
checks use the MD5 ETags exposed by `bootstrap.urbit.org`; the Vere archive uses
a checked SHA-256.

Current M2 smoke scenarios are:

-   owner DM text reply
-   streamed `tlon` tool call followed by final assistant text
-   unauthorized DM sender produces no fake-model call and no direct reply

## Unit Tests

The package `test` script is safe under root recursive invocations such as:

```bash
pnpm --filter @tloncorp/tlon-bot-e2e test -- run -u
pnpm --filter @tloncorp/tlon-bot-e2e test -- run
```

It runs fake-model and pure runtime/driver unit tests and does not start Docker.
