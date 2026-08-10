import { parseBotCommandManifest } from '@tloncorp/shared/domain';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Cross-language contract (nudge-settings-contract pattern): the Hermes
// adapter's advertised manifest fixture must parse cleanly through the
// client's parser with zero skipped entries.
const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../hermes-tlon-adapter/fixtures/command-manifest.json'
);
const fixtureJson = fs.readFileSync(fixturePath, 'utf8').trim();

describe('Hermes command manifest contract', () => {
  it('parses with zero skipped entries', () => {
    const wireCommands = (
      JSON.parse(fixtureJson) as {
        v: number;
        commands: unknown[];
      }
    ).commands;
    const parsed = parseBotCommandManifest(fixtureJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.commands).toHaveLength(wireCommands.length);
    expect(parsed?.commands.map((command) => command.priority)).toEqual(
      Array.from({ length: wireCommands.length }, (_, i) => i + 1)
    );
  });

  it('advertises the ten adapter commands, not the hidden legacy alias', () => {
    const parsed = parseBotCommandManifest(fixtureJson);
    expect(parsed?.commands.map((command) => command.command)).toEqual([
      '/owner-listen',
      '/migrate',
      '/tlon',
      '/allow',
      '/reject',
      '/ban',
      '/unban',
      '/pending',
      '/banned',
      '/channel-access',
    ]);
  });
});
