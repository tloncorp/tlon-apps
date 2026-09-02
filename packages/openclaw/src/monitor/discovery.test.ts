import { describe, expect, it, vi } from 'vitest';

import { fetchGroupChanges, fetchInitData } from './discovery.js';

function createRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

describe('channel discovery logging', () => {
  it('does not log routine successful discovery or pending invite counts', async () => {
    const runtime = createRuntime();
    const api = {
      scry: vi.fn().mockResolvedValue({
        groups: {
          '~zod/test': {
            channels: {
              'chat/~zod/general': { meta: { title: 'General' } },
            },
          },
        },
        foreigns: {
          '~nec/invited': {
            invites: [{ from: '~nec', valid: true }],
          },
        },
      }),
    };

    const result = await fetchInitData(api, runtime);

    expect(result.channels).toEqual(['chat/~zod/general']);
    expect(result.foreigns).toEqual({
      '~nec/invited': {
        invites: [{ from: '~nec', valid: true }],
      },
    });
    expect(runtime.log).not.toHaveBeenCalled();
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it('keeps discovery failures observable at error level', async () => {
    const runtime = createRuntime();
    const api = {
      scry: vi.fn().mockRejectedValue(new Error('groups unavailable')),
    };

    const result = await fetchInitData(api, runtime);

    expect(result.channels).toEqual([]);
    expect(runtime.log).not.toHaveBeenCalled();
    expect(runtime.error).toHaveBeenCalledWith(
      '[tlon] Init data fetch failed: groups unavailable'
    );
  });

  it('forwards cancellation to the init scry', async () => {
    const runtime = createRuntime();
    const api = { scry: vi.fn().mockResolvedValue({}) };
    const controller = new AbortController();

    await fetchInitData(api, runtime, { signal: controller.signal });

    expect(api.scry).toHaveBeenCalledWith('/groups-ui/v7/init.json', {
      signal: controller.signal,
    });
  });

  it('rethrows cancellation from the init scry', async () => {
    const runtime = createRuntime();
    const controller = new AbortController();
    const reason = new DOMException('stopped', 'AbortError');
    const api = {
      scry: vi.fn().mockImplementation(async () => {
        controller.abort(reason);
        throw reason;
      }),
    };

    await expect(
      fetchInitData(api, runtime, { signal: controller.signal })
    ).rejects.toBe(reason);
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it('does not log successful incremental discovery but retains failures', async () => {
    const runtime = createRuntime();
    const api = { scry: vi.fn().mockResolvedValue({ changes: [] }) };

    await expect(fetchGroupChanges(api, runtime)).resolves.toEqual({
      changes: [],
    });
    expect(runtime.log).not.toHaveBeenCalled();

    api.scry.mockRejectedValueOnce(new Error('changes unavailable'));
    await expect(fetchGroupChanges(api, runtime)).resolves.toBeNull();
    expect(runtime.error).toHaveBeenCalledWith(
      '[tlon] Failed to fetch changes (falling back to full init): changes unavailable'
    );
  });
});
