# Hermes Tlon Integration Harness

This harness mirrors the OpenClaw integration setup:

- Docker Compose starts ephemeral fakezod ships (`~zod`, `~ten`, `~mug`).
- The OpenClaw scripted fake model serves an OpenAI-compatible
  `/v1/chat/completions` endpoint.
- Vitest sends DMs from `~ten` to the Hermes Tlon adapter running as `~zod`.

Run the smoke suite from this package with:

```sh
pnpm test:integration
```

Host ports default to `8080`, `8081`, `8082`, and `4000`. Override them when
those ports are already busy:

```sh
ZOD_PORT=9080 TEN_PORT=9081 MUG_PORT=9082 FAKE_MODEL_PORT=4100 pnpm test:integration
```

The test compose file configures Hermes with a custom chat-completions model:

```yaml
HERMES_MODEL_PROVIDER: custom
HERMES_MODEL: tlon-test-scripted
HERMES_MODEL_BASE_URL: http://fake-model:4000/v1
HERMES_MODEL_API_KEY: TEST_KEY
HERMES_MODEL_API_MODE: chat_completions
```

`dev/entrypoint.sh` writes those values into the generated Hermes config before
starting the gateway.
