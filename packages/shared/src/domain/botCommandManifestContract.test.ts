import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseBotCommandManifest } from './slashCommands';

// Cross-package contract (nudge-settings-contract pattern): each runtime's
// committed manifest fixture must parse cleanly through this client parser with
// zero skipped entries, and advertise exactly the commands it claims to.
//
// These assertions live here, in the package that owns the parser, and read the
// fixtures by relative path. Running them from the runtime packages instead
// would make those packages depend on `@tloncorp/shared`, which is
// workspace-only — the OpenClaw plugin is installed with plain `npm install` in
// its containerized E2E, where an unpublished workspace dep is a hard 404.
const fixture = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), 'utf8').trim();

const RUNTIMES = [
  {
    name: 'openclaw',
    json: () => fixture('../../../openclaw/fixtures/command-manifest.json'),
    expected: [
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
    ],
  },
  {
    name: 'hermes-tlon-adapter',
    json: () =>
      fixture('../../../hermes-tlon-adapter/fixtures/command-manifest.json'),
    // `/tlon-version` is handled but deliberately unadvertised (legacy alias).
    expected: [
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
    ],
  },
] as const;

describe.each(RUNTIMES)('$name manifest fixture', ({ json, expected }) => {
  it('parses with zero skipped entries', () => {
    const raw = json();
    const wireCommands = (JSON.parse(raw) as { commands: unknown[] }).commands;
    const parsed = parseBotCommandManifest(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.commands).toHaveLength(wireCommands.length);
    // Array order becomes client priority.
    expect(parsed?.commands.map((command) => command.priority)).toEqual(
      Array.from({ length: wireCommands.length }, (_, i) => i + 1)
    );
  });

  it('advertises exactly its declared commands', () => {
    const parsed = parseBotCommandManifest(json());
    expect(parsed?.commands.map((command) => command.command)).toEqual(
      expected
    );
  });
});
