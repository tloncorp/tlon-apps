import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { readBrowserTaskServiceStatus } from './browser-task-service.js';
import { urbitFetch } from './urbit/fetch.js';
vi.mock('./urbit/fetch.js', () => ({ urbitFetch: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const handle = 'sess_' + 'a'.repeat(22);
const config = {
  channels: {
    tlon: {
      ship: '~zod',
      url: 'https://zod.example',
      code: 'private-code',
      ownerShip: '~nec',
    },
  },
  mcp: {
    servers: {
      mcp: {
        url: 'https://zod.example/apps/mcp/mcp',
        transport: 'streamable-http' as const,
        headers: { 'X-API-Key': 'private-key' },
      },
    },
  },
};
function wire(metadata: unknown, wrongId = false) {
  const release = vi.fn().mockResolvedValue(undefined);
  vi.mocked(urbitFetch).mockImplementation(
    async ({ init }) =>
      ({
        response: Response.json({
          jsonrpc: '2.0',
          id: wrongId ? 'wrong' : JSON.parse(init!.body as string).id,
          result: { structuredContent: metadata },
        }),
        release,
      }) as Awaited<ReturnType<typeof urbitFetch>>
  );
  return release;
}
it('reads only the authenticated monitoring tool and strips unsolicited content', async () => {
  const release = wire({
    session_id: handle,
    monitor: {
      version: 1,
      epoch: randomUUID(),
      revision: 1,
      secret: 'private-value',
      fill: {
        revision: 1,
        at: 1000,
        formId: 'login',
        submitted: true,
        values: { password: 'private-value' },
      },
    },
  });
  const signal = new AbortController().signal;
  const result = await readBrowserTaskServiceStatus(config, handle, signal);
  expect(result.fill?.submitted).toBe(true);
  expect(JSON.stringify(result)).not.toContain('private-value');
  const request = vi.mocked(urbitFetch).mock.calls[0][0];
  expect(JSON.parse(request.init!.body as string).params).toEqual({
    name: 'browser_browser_session_monitor',
    arguments: { session_id: handle },
  });
  expect(request.init!.signal).toBe(signal);
  expect(request.maxRedirects).toBe(0);
  expect(release).toHaveBeenCalledOnce();
});
it('rejects mismatched sessions or replies and always releases the request', async () => {
  const release = wire({ session_id: 'sess_' + 'b'.repeat(22) });
  await expect(readBrowserTaskServiceStatus(config, handle)).rejects.toThrow(
    'status unavailable'
  );
  expect(release).toHaveBeenCalledOnce();
  const wrong = wire({ session_id: handle }, true);
  await expect(readBrowserTaskServiceStatus(config, handle)).rejects.toThrow(
    'status unavailable'
  );
  expect(wrong).toHaveBeenCalledOnce();
});
it('does not surface sensitive upstream errors or allow unconfigured routes', async () => {
  vi.mocked(urbitFetch).mockRejectedValue(
    new Error('private-key private-value')
  );
  await expect(readBrowserTaskServiceStatus(config, handle)).rejects.toThrow(
    /^Browser monitoring status unavailable\.$/
  );
  vi.mocked(urbitFetch).mockClear();
  await expect(
    readBrowserTaskServiceStatus(
      {
        ...config,
        mcp: {
          servers: {
            mcp: {
              ...config.mcp.servers.mcp,
              url: 'https://zod.example/arbitrary',
            },
          },
        },
      },
      handle
    )
  ).rejects.toThrow('status unavailable');
  expect(urbitFetch).not.toHaveBeenCalled();
});
