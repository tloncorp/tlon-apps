import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PluginCommandContext } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  TLON_COMMAND_REGISTRY,
  type TlonCommandDeps,
  buildCommandTokensJson,
  commandTokens,
  registerTlonCommands,
} from './commands-registry.js';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/commands.json'
);
const fixtureJson = fs.readFileSync(fixturePath, 'utf8');

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
    // OpenClaw core commands (/status, /help, /new) are absent by
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
  // and stay green. The registry loop is the only registration site.
  it('registers commands only through the registry (index.ts boundary)', () => {
    const indexSource = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.ts'),
      'utf8'
    );

    expect(indexSource).toMatch(/registerTlonCommands\s*\(/);
    // Every spelling that reaches the SDK method, not just dot-call: bracket
    // access and a detached reference register just as well and would
    // otherwise slip a command past the registry, the fixture, and the app's
    // static list — the exact drift this contract exists to stop.
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
