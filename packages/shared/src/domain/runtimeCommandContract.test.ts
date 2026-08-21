import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { type BotAgentType, RUNTIME_COMMANDS } from './slashCommands';

// The drift contract. Command lists are app-static now, so nothing on the wire
// keeps them honest — this test does: each runtime commits a token-only fixture
// generated from its own command registry, and the static list for that harness
// must name exactly those tokens. An addition, a removal, or a duplicate in a
// runtime turns this red on the PR that makes it.
//
// It deliberately does NOT compare positions. The two orders legitimately
// differ (a registry is registration-ordered; the static list is curated), and
// ordering is editorial — carried by `priority` and asserted through
// rankSlashCommands in packages/app, not declared by a runtime.
//
// Core commands are outside this relation by construction: the runtimes neither
// register nor dispatch them, so their fixtures cannot mention them.
//
// These assertions live here, in the package that owns the static lists, and
// read the fixtures by relative path. Running them from the runtime packages
// instead would make those packages depend on `@tloncorp/shared`, which is
// workspace-only — the OpenClaw plugin is installed with plain `npm install` in
// its containerized E2E, where an unpublished workspace dep is a hard 404.
const RUNTIMES: { harness: BotAgentType; fixture: string }[] = [
  { harness: 'openclaw', fixture: '../../../openclaw/fixtures/commands.json' },
  {
    harness: 'hermes',
    fixture: '../../../hermes-tlon-adapter/fixtures/commands.json',
  },
];

const readTokens = (rel: string): string[] =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), 'utf8'));

describe.each(RUNTIMES)(
  '$harness command drift contract',
  ({ harness, fixture }) => {
    it('the static runtime list names exactly the runtime tokens', () => {
      const runtimeTokens = readTokens(fixture);
      const staticTokens = RUNTIME_COMMANDS[harness].map(
        (option) => option.command as string
      );

      // Sorted equality: catches additions, removals, and duplicates on either
      // side, while leaving order to each side's own concern.
      expect([...runtimeTokens].sort()).toEqual([...staticTokens].sort());
    });

    it('the fixture is a non-empty list of popup-triggerable tokens', () => {
      const runtimeTokens = readTokens(fixture);
      expect(runtimeTokens.length).toBeGreaterThan(0);
      for (const token of runtimeTokens) {
        expect(token).toMatch(/^\/[a-zA-Z0-9-]+$/);
      }
    });
  }
);
