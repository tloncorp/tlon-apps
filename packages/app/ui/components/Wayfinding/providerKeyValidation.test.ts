import { describe, expect, test } from 'vitest';

import { validateProviderKey } from './providerKeyValidation';

// ---- Live key validation (online) -------------------------------------------
// These mirror what hosting's /provider-models endpoint does internally:
// proxy the key to the real provider's models endpoint. If these pass, the
// same key will succeed through the splash flow.
//
// Run with:
//   OPENROUTER_KEY=sk-or-v1-... OPENAI_KEY=sk-proj-... \
//     pnpm -F @tloncorp/app vitest run providerKeyValidation
//
// Tests skip automatically when env vars are absent so CI stays green.

const OPENROUTER_LIVE_KEY = process.env.OPENROUTER_KEY;
const OPENAI_LIVE_KEY = process.env.OPENAI_KEY;
const ANTHROPIC_LIVE_KEY = process.env.ANTHROPIC_KEY;

describe('live provider key validation', () => {
  test.skipIf(!OPENROUTER_LIVE_KEY)(
    'openrouter: key returns a non-empty model list',
    async () => {
      expect(
        validateProviderKey('openrouter', OPENROUTER_LIVE_KEY!)
      ).toBeNull();

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${OPENROUTER_LIVE_KEY}` },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { data?: { id: string }[] };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data!.length).toBeGreaterThan(0);
      expect(body.data![0].id).toBeTypeOf('string');
    },
    15_000
  );

  test.skipIf(!OPENAI_LIVE_KEY)(
    'openai: key returns a non-empty model list',
    async () => {
      expect(validateProviderKey('openai', OPENAI_LIVE_KEY!)).toBeNull();

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${OPENAI_LIVE_KEY}` },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { data?: { id: string }[] };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data!.length).toBeGreaterThan(0);
      expect(body.data![0].id).toBeTypeOf('string');
    },
    15_000
  );

  test.skipIf(!ANTHROPIC_LIVE_KEY)(
    'anthropic: key returns a non-empty model list',
    async () => {
      expect(validateProviderKey('anthropic', ANTHROPIC_LIVE_KEY!)).toBeNull();

      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'anthropic-version': '2023-06-01',
          'X-Api-Key': ANTHROPIC_LIVE_KEY!,
        },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { data?: { id: string }[] };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data!.length).toBeGreaterThan(0);
      expect(body.data![0].id).toBeTypeOf('string');
    },
    15_000
  );
});
