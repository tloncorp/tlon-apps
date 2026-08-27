import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PluginCommandContext } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  APPROVAL_COMMAND_TOKENS,
  CORE_COMMAND_TOKENS,
  TLON_COMMAND_REGISTRY,
  type TlonCommandDeps,
  buildCommandTokensJson,
  buildEngagementTokensJson,
  commandTokens,
  engagementTokens,
  registerTlonCommands,
} from './commands-registry.js';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/commands.json'
);
const fixtureJson = fs.readFileSync(fixturePath, 'utf8');

const engagementFixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/engagement-tokens.json'
);
const engagementFixtureJson = fs.readFileSync(engagementFixturePath, 'utf8');

const makeDeps = (): TlonCommandDeps => ({
  renderTlonVersion: async () => ({ text: 'tlon version' }),
  handleMigrateCommand:
    undefined as unknown as TlonCommandDeps['handleMigrateCommand'],
  config: {} as TlonCommandDeps['config'],
});

describe('command registry', () => {
  it('holds exactly the ten plugin commands', () => {
    expect(TLON_COMMAND_REGISTRY.map((entry) => entry.name)).toEqual([
      'tlon-version',
      'tlon',
      'allow',
      'reject',
      'ban',
      'pending',
      'banned',
      'unban',
      'owner-listen',
      'migrate',
    ]);
    // OpenClaw core commands (/status, /help, /new, /model) are absent by
    // construction: this plugin neither registers nor dispatches them. The
    // client carries them on its static list as audit-pinned constants.
    expect(TLON_COMMAND_REGISTRY.map((entry) => entry.name)).not.toContain(
      'status'
    );
  });

  it('registers exactly the registry rows (exact-equality parity)', () => {
    const registerCommand = vi.fn();
    registerTlonCommands({ registerCommand }, makeDeps());

    const registered = registerCommand.mock.calls.map(
      (call) => call[0] as Record<string, unknown>
    );
    expect(registered).toHaveLength(TLON_COMMAND_REGISTRY.length);

    // No extras in either direction: same names, same order.
    expect(registered.map((command) => command.name)).toEqual(
      TLON_COMMAND_REGISTRY.map((entry) => entry.name)
    );
    for (let i = 0; i < registered.length; i++) {
      const entry = TLON_COMMAND_REGISTRY[i];
      expect(registered[i].description).toBe(entry.description);
      // Omitted when the row has no args, matching the core SDK payload.
      expect(registered[i].acceptsArgs).toBe(entry.acceptsArgs);
      expect(typeof registered[i].handler).toBe('function');
    }
  });

  // Closes the parity loop at the boundary the previous test cannot see: it
  // drives registerTlonCommands directly, so an `api.registerCommand` added
  // straight to registerFull would register a command the fixture never names
  // and stay green. This checks index.ts for registration outside the registry
  // loop rather than proving the loop is the only possible site.
  it('registers commands only through the registry (index.ts boundary)', () => {
    const indexSource = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.ts'),
      'utf8'
    );

    expect(indexSource).toMatch(/registerTlonCommands\s*\(/);
    // An accident net over the direct spellings — dot-call, bracket string
    // literal, bare reference — each of which would otherwise slip a command
    // past the registry, the fixture, and the app's static list. Deliberate
    // indirection (a computed name, an imported helper) evades it; the target
    // is drift added without thinking, not a proof that none is possible.
    expect(indexSource).not.toMatch(/\.registerCommand\s*\(/);
    expect(indexSource).not.toMatch(/\[\s*['"`]registerCommand['"`]\s*\]/);
    expect(indexSource).not.toMatch(/\bregisterCommand\b(?!\s*[,:)}])/);
  });

  it('wires registered handlers through the registry deps', async () => {
    const registerCommand = vi.fn();
    const deps = makeDeps();
    const renderTlonVersion = vi.spyOn(deps, 'renderTlonVersion');
    registerTlonCommands({ registerCommand }, deps);

    const tlonVersion = registerCommand.mock.calls[0][0] as {
      handler: (ctx: PluginCommandContext) => Promise<{ text: string }>;
    };
    await expect(
      tlonVersion.handler({} as PluginCommandContext)
    ).resolves.toEqual({ text: 'tlon version' });
    expect(renderTlonVersion).toHaveBeenCalledTimes(1);
  });
});

// The fixture is what the client's drift contract reads
// (packages/shared/src/domain/runtimeCommandContract.test.ts). Regenerating it
// is the deliberate step that says "the client's static list must change too".
describe('buildCommandTokensJson', () => {
  it('matches the committed fixture byte-for-byte', () => {
    expect(buildCommandTokensJson()).toBe(fixtureJson);
  });

  it('is byte-stable across calls', () => {
    expect(buildCommandTokensJson()).toBe(buildCommandTokensJson());
  });

  it('names every registered command, and nothing else', () => {
    expect(commandTokens()).toEqual(
      TLON_COMMAND_REGISTRY.map((entry) => `/${entry.name}`)
    );
  });
});

// The engagement fixture is what the client's parity contract reads
// (packages/shared/src/domain/runtimeCommandContract.test.ts): every token the
// popup can insert bare must engage bare in the runtime. Same pattern as the
// commands.json check above.
describe('core command tokens', () => {
  it('mirrors the client OPENCLAW_CORE_COMMANDS audit pin', () => {
    expect(CORE_COMMAND_TOKENS).toEqual(['/status', '/help', '/new', '/model']);
  });

  it('are not registered plugin commands', () => {
    for (const token of CORE_COMMAND_TOKENS) {
      expect(commandTokens()).not.toContain(token);
    }
  });

  it('engages approval card commands without advertising them', () => {
    expect(APPROVAL_COMMAND_TOKENS).toEqual(['/approve']);
    expect(commandTokens()).not.toContain('/approve');
  });
});

describe('buildEngagementTokensJson', () => {
  it('matches the committed fixture byte-for-byte', () => {
    expect(buildEngagementTokensJson()).toBe(engagementFixtureJson);
  });

  it('is byte-stable across calls', () => {
    expect(buildEngagementTokensJson()).toBe(buildEngagementTokensJson());
  });

  it('includes registry, core, and approval commands', () => {
    expect(engagementTokens()).toEqual([
      ...commandTokens(),
      ...CORE_COMMAND_TOKENS,
      ...APPROVAL_COMMAND_TOKENS,
    ]);
  });
});
