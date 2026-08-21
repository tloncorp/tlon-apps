import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { validateBlobEntry } from '../client/a2ui';
import { parsePostBlob } from '../client/content-helpers';

// The meal-plan kit's card instruction embeds a complete blob-array template
// that the agent copies nearly verbatim. The model cannot be validated at
// authoring time, so this test pins the template itself: if the a2ui limits
// or entry schemas move and the template stops validating, this fails before
// a live agent posts a card that every client rejects.
// vitest runs with cwd at the package root.
const CARD_INSTRUCTION_PATH = join(
  process.cwd(),
  '../tlon-kits/kits/meal-plan/instructions/card.md'
);

function templateJson(): unknown {
  const source = readFileSync(CARD_INSTRUCTION_PATH, 'utf8');
  const fence = source.match(/```json\n([\s\S]*?)\n```/);
  if (!fence) {
    throw new Error('card.md has no ```json fence');
  }
  return JSON.parse(fence[1]);
}

describe('meal-plan weekly card template', () => {
  test('is a two-entry blob array joined by one surfaceId', () => {
    const entries = templateJson() as Array<Record<string, unknown>>;
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.map((entry) => entry.type)).toEqual([
      'a2ui',
      'interactive-surface',
    ]);

    const a2ui = entries[0] as {
      messages: Array<{
        createSurface?: { surfaceId: string };
        updateComponents?: { surfaceId: string };
      }>;
    };
    const surface = entries[1] as { surfaceId: string; revision: number };
    expect(a2ui.messages[0]?.createSurface?.surfaceId).toBe(surface.surfaceId);
    expect(a2ui.messages[1]?.updateComponents?.surfaceId).toBe(
      surface.surfaceId
    );
    expect(surface.revision).toBe(0);
  });

  test('the a2ui entry passes the real validator with headroom for edits', () => {
    const entries = templateJson() as Array<Record<string, unknown>>;
    expect(validateBlobEntry(entries[0])).toBe(true);

    const components = (
      entries[0] as {
        messages: Array<{
          updateComponents?: { components: unknown[] };
        }>;
      }
    ).messages[1]?.updateComponents?.components;
    // The validator caps components at 80; the agent renames meals and adds
    // note sublines, so the template must not sit at the cap.
    expect(components?.length).toBeLessThanOrEqual(70);
  });

  test('both entries survive the shared blob parser as their own types', () => {
    const serialized = JSON.stringify(templateJson());
    const parsed = parsePostBlob(serialized);
    expect(parsed.map((entry) => entry.type)).toEqual([
      'a2ui',
      'interactive-surface',
    ]);
  });
});
