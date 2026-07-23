# @tloncorp/acp

`tlon-acp` is a generic bridge between the `%acp` Gall agent and an Agent Client Protocol adapter that speaks newline-delimited JSON-RPC over stdio. It does not translate Tlon messages or contain provider-specific protocol logic.

## Run

Build the package, install `%acp` on the target desk, then launch any ACP adapter:

```bash
pnpm --filter @tloncorp/acp build

URBIT_URL=http://127.0.0.1:8080 \
URBIT_SHIP=~sampel-palnet \
URBIT_CODE=sampel-palnet-sampel-dozzod \
ACP_CONNECTION=demo \
node packages/acp/dist/cli.js -- codex-acp
```

Everything after `--` is executed directly without a shell, so adapter flags can be appended normally. For example:

```bash
node packages/acp/dist/cli.js \
  --url http://127.0.0.1:8080 \
  --ship ~sampel-palnet \
  --code sampel-palnet-sampel-dozzod \
  --connection demo \
  --verbose \
  -- codex-acp
```

For an end-to-end transport demo that requires no model credentials, use the included protocol-shaped demo agent in one terminal:

```bash
node packages/acp/dist/cli.js \
  --url http://127.0.0.1:8080 \
  --ship ~sampel-palnet \
  --code sampel-palnet-sampel-dozzod \
  --connection demo \
  --verbose \
  -- node packages/acp/examples/demo-agent.mjs
```

Then run the demo client with the same ship environment in another terminal:

```bash
node packages/acp/examples/demo-client.mjs
```

The client initializes ACP v1, creates a session, sends a text prompt, prints the streamed response and stop reason, and acknowledges the client queue.

The worker subscribes to `/v1/<connection>/agent`, writes those frames to the adapter's stdin, and acknowledges each frame after the write succeeds. Lines read from adapter stdout are poked into the connection's `%client` queue.

The queues make ship-to-worker delivery durable across reconnects. Delivery across a process crash is at least once: a crash after an adapter accepts a frame but before its ship ACK can cause that frame to replay.
