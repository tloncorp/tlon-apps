# `@tloncorp/acp`

ACP client primitives for running an ACP-compatible adapter as a local child process.

```text
AcpClient ↔ StdioAcpTransport ↔ codex-acp / claude-agent-acp
```

This package does not connect to an Urbit ship. Product-level workers decide where prompts come from and where responses go.

## Usage

```ts
import { AcpClient, StdioAcpTransport, spawnAdapter } from '@tloncorp/acp';

const adapter = spawnAdapter({
    command: 'codex-acp',
    cwd: '/path/to/workspace',
    env: process.env,
});

const client = new AcpClient(new StdioAcpTransport(adapter), {
    name: 'my-acp-client',
    permissionPolicy: 'deny',
});

const capabilities = await client.start();
const session = await client.request('session/new', {
    cwd: '/path/to/workspace',
    mcpServers: [],
});
```

`AcpClient` handles JSON-RPC requests, notifications, timeouts, and permission requests. `StdioAcpTransport` validates newline-delimited frames and keeps all ACP traffic local to the worker.

`examples/demo-agent.mjs` is a small ACP adapter for integration testing.
