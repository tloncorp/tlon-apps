# AGENTS.md — Tlon Plugin for OpenClaw

Guidelines for agents (and humans) working on this plugin.

---

## Commands

```bash
# Development
pnpm dev                    # Run dev environment (uses Docker)

# Testing
pnpm test                   # Run unit tests
pnpm test:watch             # Watch mode
pnpm test:security          # Security tests only
pnpm test:integration       # Integration tests (ephemeral fakezods)
pnpm test:integration:dev   # Integration tests against running dev
pnpm test:integration:watch # Watch mode for dev environment

# Linting & Formatting
pnpm lint                   # Type-aware lint with oxlint
pnpm lint:fix               # Auto-fix lint issues
pnpm format                 # Check formatting
pnpm format:fix             # Auto-fix formatting

# Type checking
pnpm tsc --noEmit           # Full type check
```

---

## Goals / Purpose

- Bridge OpenClaw ↔ Tlon/Urbit messaging
- Support DMs and group channels with proper access control
- Rich content: images, markdown → Tlon story format
- Runtime-configurable authorization (settings store)

---

## Architecture

- **SSE for inbound** — `sse-client.ts` handles real-time events from the ship
- **HTTP pokes for outbound** — avoids SSE conflicts, simpler error handling
- **Settings store** — runtime config that persists (channel rules, blocked ships, etc.)
- **Approval flow** — DM requests from unknown ships queue for admin approval

### File Organization

```
src/
  channel.ts        # ChannelPlugin implementation (outbound, setup, status)
  monitor/          # Inbound message handling (SSE event loop)
    index.ts        # Main monitor loop
    approval.ts     # DM/channel approval workflow
    discovery.ts    # Auto-discover channels in joined groups
    history.ts      # Message history and caching
    utils.ts        # Bot mention detection, allowlist checks
  urbit/            # Low-level Urbit communication
    sse-client.ts   # SSE subscription client
    auth.ts         # +code authentication
    send.ts         # Send DMs and group messages
    story.ts        # Build Urbit story format
  settings.ts       # Runtime settings store (hot-reload via settings-store)
  types.ts          # Shared types
  config-schema.ts  # Zod schema for config validation
  targets.ts        # Target parsing (DM ship or channel nest)
```

### Key Patterns

- **Plugin SDK**: Implements `ChannelPlugin` interface from `openclaw/plugin-sdk`
- **Dual message paths**: Monitor uses SSE for inbound; outbound uses HTTP-only pokes
- **Settings hot-reload**: Config can be updated via Urbit's settings-store without restart
- **Authorization cascade**: Settings store overrides file config; default to "restricted" mode

### Dependencies

- `@tloncorp/api` — Tlon API library (use this first!)
- `openclaw/plugin-sdk` — Plugin interfaces and utilities
- `@urbit/http-api` / `@urbit/aura` — Urbit primitives

### Dev Environment Setup

1. Clone repo and run `./dev/setup.sh`
2. Configure `.env` with ship credentials
3. Run `pnpm dev` (uses Docker)

---

## Security

See [SECURITY.md](SECURITY.md) for the full security model (authorization, credentials, invariants).

Quick reminders:
- ❌ `Math.random()` → ✅ `crypto.randomUUID()`
- ❌ Raw `fetch()` with user URLs → ✅ `urbitFetch` with SSRF policy
- ❌ Unsanitized input to `spawn()` → ✅ Validate/allowlist first
- ❌ Forgetting `release()` → ✅ Always cleanup in `finally` blocks

---

## Coding Practices

### Use `@tloncorp/api` First

If the API package supports it, use it. Don't write raw HTTP calls for things the SDK handles:
- Channel operations (subscribe, poke)
- Scries for data fetching
- Types for Tlon data structures (Post, Writ, etc.)

Only drop to raw `urbitFetch` when the SDK doesn't cover the use case.

### Imports

- Node built-ins: always use `node:` prefix (`import crypto from "node:crypto"`)
- Prefer named imports from `openclaw/plugin-sdk`
- Keep third-party, SDK, and local imports grouped

### Types

- Use types from `@tloncorp/api` for Tlon structures
- Use types from `openclaw/plugin-sdk` for plugin interfaces
- Avoid `any` — if you need an escape hatch, use `unknown` and narrow

### Error Handling

- Let errors bubble up with context (don't swallow silently)
- Use `runtime.error?.()` for logging errors in monitor
- Wrap external calls (urbitFetch, API) in try/catch with meaningful messages

### Async Patterns

- Always handle abort signals when passed (`opts.abortSignal`)
- Clean up resources in `finally` blocks (release urbitFetch, close connections)
- Use retry logic with exponential backoff for network calls

### What NOT to Do

- ❌ `Math.random()` for IDs — use `crypto.randomUUID()`
- ❌ Raw `fetch()` for user-provided URLs — use `urbitFetch`
- ❌ Hardcoded ship names or URLs in logic
- ❌ Skipping SSRF policy when making requests

---

## Testing

### Unit Tests (Local)

Test pure logic in isolation:

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode during development
```

What to unit test:
- Ship normalization (`~ship` handling)
- Channel nest parsing
- Story/markdown conversion
- Message deduplication logic
- Settings store operations

### Upstream Tests

When the plugin is copied to `extensions/tlon` in the main OpenClaw repo:

```bash
# From openclaw root
pnpm test -- extensions/tlon    # plugin tests only
pnpm tsc --noEmit               # full type check
```

Upstream security scanners catch:
- Weak randomness (`Math.random()` in security contexts)
- Temp path handling (path traversal risks)
- SSRF vulnerabilities (raw fetch with user input)

### Integration Tests

Integration tests prompt the bot via DM and verify ship state changes directly.

#### Pattern

```typescript
import { describe, test, expect, beforeAll } from "vitest";
import { getFixtures, waitFor, type TestFixtures } from "../lib/index.js";

describe("my feature", () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await getFixtures();
  });

  test("mutates state correctly", async () => {
    // 1. Generate unique token for this test run
    const token = `test-value-${Date.now().toString(36)}`;
    
    // 2. Send natural language prompt
    const response = await fixtures.client.prompt(
      `Update your profile status to exactly "${token}" and confirm.`
    );
    expect(response.success).toBe(true);
    
    // 3. Verify state changed on bot ship (not response text)
    const updated = await waitFor(async () => {
      const contacts = await fixtures.botState.contacts();
      const self = contacts.find(c => c.id === fixtures.botShip);
      return self?.status === token ? true : undefined;
    }, 30_000);
    
    expect(updated).toBe(true);
  });
});
```

#### Key Principles

- **Assert from bot ship's perspective** — use `fixtures.botState.*` to scry actual state, don't just trust response text
- **Use unique tokens** — include `Date.now()` to make values deterministic and verifiable
- **Poll with `waitFor`** — state changes are async, poll until expected or timeout
- **Seed fixtures on bot ship** — don't depend on test user's private data

#### State Client Methods

```typescript
fixtures.botState.groups()           // All groups bot is in
fixtures.botState.group(flag)        // Specific group details
fixtures.botState.contacts()         // All contacts
fixtures.botState.settings()         // Bot settings
fixtures.botState.channelPosts(id)   // Messages in a channel
fixtures.botState.activity()         // Activity feed
```

#### Running Integration Tests

```bash
# Self-contained with ephemeral fakezods (CI uses this)
pnpm test:integration

# Against running dev environment
pnpm test:integration:dev

# Watch mode
pnpm test:integration:watch
```

#### Test File Naming

Tests are numbered for execution order:

```
test/cases/
  01-connectivity.test.ts   # Basic connection checks
  02-contacts.test.ts       # Contact/profile tests
  03-messages.test.ts       # DM tests
  04-groups.test.ts         # Group tests
  05-channels.test.ts       # Channel tests
  99-commands.test.ts       # Slash command tests
```

---

## PR Checklist

Before opening a PR:

- [ ] **Types pass**: `pnpm tsc --noEmit` clean
- [ ] **Unit tests pass**: `pnpm test`
- [ ] **Integration tests pass**: `pnpm test:integration` (or at minimum, `test:integration:dev`)
- [ ] **Uses API package** where applicable (not raw HTTP)
- [ ] **Security**: No `Math.random()`, raw `fetch()` with user URLs, or unsanitized input to `spawn()`
- [ ] **Cleanup**: Resources released in `finally` blocks, abort signals respected
- [ ] **Commit messages**: Conventional commits (`feat:`, `fix:`, `chore:`)

### Upstream CI Checks

When merged to OpenClaw, these run automatically:
- `actionlint` — GitHub Actions syntax
- `checks (node, test)` — Full test suite
- `checks (bun, test)` — Bun compatibility
- Security scanners (temp-path-guard, etc.)

### Common CI Failures

| Failure | Fix |
|---------|-----|
| `Math.random()` detected | Use `crypto.randomUUID()` |
| Merge conflicts in `pnpm-lock.yaml` | Regenerate: `pnpm install --lockfile-only` |
| Type errors after merge | Check for API changes in main |

---

## Patterns

- **Normalize ships**: always `~ship` format internally
- **Channel nest format**: `chat/~host/name` or `diary/~host/name`
- **Message deduplication**: via processed-message tracker
- **History caching**: for context in replies
