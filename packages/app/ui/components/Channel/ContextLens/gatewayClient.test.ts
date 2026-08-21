import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchContextLensRun } from './gatewayClient';
import type { ContextLens } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchContextLensRun', () => {
  it('returns the parsed lens without discarding its received envelope', async () => {
    const lens = {
      lensId: 'lens-1',
      status: 'completed',
    } as ContextLens;
    const rawEnvelope = {
      lens,
      futureGatewayField: { retained: true },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(rawEnvelope),
      })
    );

    const result = await fetchContextLensRun(
      { baseUrl: 'http://127.0.0.1:18789/', token: 'secret' },
      'lens-1'
    );

    expect(result?.lens).toBe(lens);
    expect(result?.rawEnvelope).toBe(rawEnvelope);
    expect(result?.rawEnvelope).toHaveProperty(
      'futureGatewayField.retained',
      true
    );
  });
});
