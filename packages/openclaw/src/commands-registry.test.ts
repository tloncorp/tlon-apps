import { parseBotCommandManifest } from '@tloncorp/shared/domain';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PluginCommandContext } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  BOT_COMMANDS_CONTACT_KEY,
  TLON_COMMAND_REGISTRY,
  type TlonCommandDeps,
  buildCommandManifestJson,
  registerTlonCommands,
} from './commands-registry.js';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/command-manifest.json'
);
const fixtureJson = fs.readFileSync(fixturePath, 'utf8').trim();

const makeDeps = (): TlonCommandDeps => ({
  renderTlonVersion: async () => ({ text: 'tlon version' }),
  handleMigrateCommand:
    undefined as unknown as TlonCommandDeps['handleMigrateCommand'],
  config: {} as TlonCommandDeps['config'],
});

describe('command registry', () => {
  it('advertises exactly the ten plugin commands', () => {
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
    // OpenClaw core commands (/status, /help, /new) are not advertised: the
    // core's builtin command registry is not exported from the pinned
    // `openclaw` package, so they cannot be parity-asserted in CI.
    for (const entry of TLON_COMMAND_REGISTRY) {
      expect(entry.manifest).not.toBe(false);
    }
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
  // straight to registerFull would register an unadvertised command and stay
  // green. The registry loop is the only registration site.
  // The popup renders a leading glyph per row; a row without an icon falls
  // back to the generic command glyph and breaks visual parity with the
  // static list, silently.
  it('gives every advertised row an icon', () => {
    for (const entry of TLON_COMMAND_REGISTRY) {
      if (entry.manifest === false) {
        continue;
      }
      expect(entry.manifest.icon, entry.name).toBeTruthy();
    }
  });

  it('registers commands only through the registry (index.ts boundary)', () => {
    const indexSource = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.ts'),
      'utf8'
    );

    expect(indexSource).toMatch(/registerTlonCommands\s*\(/);
    expect(indexSource).not.toMatch(/\.registerCommand\s*\(/);
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

describe('buildCommandManifestJson', () => {
  it('matches the committed fixture byte-for-byte', () => {
    expect(buildCommandManifestJson()).toBe(fixtureJson);
  });

  it('is byte-stable across calls', () => {
    expect(buildCommandManifestJson()).toBe(buildCommandManifestJson());
  });

  it('fixture parses client-side with zero skipped entries', () => {
    const wireCommands = (
      JSON.parse(fixtureJson) as {
        v: number;
        commands: unknown[];
      }
    ).commands;
    const parsed = parseBotCommandManifest(fixtureJson);
    expect(parsed).not.toBeNull();
    // Zero skipped entries: every fixture row survives client validation.
    expect(parsed?.commands).toHaveLength(wireCommands.length);
    expect(parsed?.commands.map((command) => command.command)).toEqual([
      '/tlon-version',
      '/tlon',
      '/allow',
      '/reject',
      '/ban',
      '/pending',
      '/banned',
      '/unban',
      '/owner-listen',
      '/migrate',
    ]);
    // Array order becomes client priority.
    expect(parsed?.commands.map((command) => command.priority)).toEqual(
      Array.from({ length: wireCommands.length }, (_, i) => i + 1)
    );
  });

  it('uses the wire contract contact key', () => {
    expect(BOT_COMMANDS_CONTACT_KEY).toBe('bot-commands');
  });
});
