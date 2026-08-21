import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  type BotAgentType,
  RUNTIME_COMMANDS,
  STATIC_MANIFESTS,
} from './slashCommands';

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

// The engagement parity contract reads each runtime's engagement fixture: the
// token set that engages bare from the owner in a watched group channel.
const ENGAGEMENT_FIXTURES: { harness: BotAgentType; fixture: string }[] = [
  {
    harness: 'openclaw',
    fixture: '../../../openclaw/fixtures/engagement-tokens.json',
  },
  {
    harness: 'hermes',
    fixture: '../../../hermes-tlon-adapter/fixtures/engagement-tokens.json',
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

// The engagement parity contract. The popup inserts commands bare (no mention
// prefix), and in third-party-hosted group channels a bare command only works
// if the runtime engages it without a mention. So every token the client can
// offer — the FULL static manifest, runtime half AND core half — must appear
// in that runtime's committed engagement-tokens.json.
//
// Subset, not equality: a runtime may engage tokens the client never suggests
// (Hermes handles the unadvertised /tlon-version alias), so extra fixture
// tokens are fine; a missing one is the bug this contract exists to stop — a
// client-side command addition that works in DMs/mentions but is silently
// ignored bare in third-party-hosted groups.
describe.each(ENGAGEMENT_FIXTURES)(
  '$harness engagement parity contract',
  ({ harness, fixture }) => {
    it('every popup token engages bare in the runtime', () => {
      const engagementTokens = new Set(readTokens(fixture));
      const popupTokens = STATIC_MANIFESTS[harness].commands.map(
        (option) => option.command as string
      );

      for (const token of popupTokens) {
        expect(engagementTokens.has(token)).toBe(true);
      }
    });

    it('the engagement fixture is a non-empty list of slash tokens', () => {
      const engagementTokens = readTokens(fixture);
      expect(engagementTokens.length).toBeGreaterThan(0);
      for (const token of engagementTokens) {
        expect(token).toMatch(/^\/[a-zA-Z0-9-]+$/);
      }
    });
  }
);
