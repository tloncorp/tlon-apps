import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { urbitFetch, runBrowserHandoffCommand } = vi.hoisted(() => ({
  urbitFetch: vi.fn(),
  runBrowserHandoffCommand: vi.fn(),
}));
vi.mock('./urbit/fetch.js', () => ({ urbitFetch }));
vi.mock('./tlon-command-runner.js', async (original) => ({
  ...(await original<typeof import('./tlon-command-runner.js')>()),
  runBrowserHandoffCommand,
}));

import { runBrowserSessionHandoff } from './browser-session-handoff.js';

const handle = 'sess_MHKz9dQ1TjqLmA7vXpR2bw';
const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const config = {
  channels: {
    tlon: {
      ship: '~zod',
      url: 'https://zod.example',
      code: 'secret',
      ownerShip: '~nec',
    },
  },
  mcp: {
    servers: {
      mcp: {
        url: 'https://zod.example/apps/mcp/mcp',
        transport: 'streamable-http' as const,
        headers: { 'X-API-Key': 'tenant-secret' },
      },
    },
  },
};

function viewerUrl(
  audience = 'session-viewer',
  expiresAt = Date.now() + 7_200_000
) {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      aud: audience,
      sid: sessionId,
      exp: Math.floor(expiresAt / 1000),
    })
  ).toString('base64url');
  return `https://browser-session-ovh2.tlon.network/s/${payload}.${'a'.repeat(43)}?clipboardBridge=true`;
}

function reply(structuredContent: unknown, extra = {}) {
  const release = vi.fn().mockResolvedValue(undefined);
  urbitFetch.mockImplementation(async ({ init }) => ({
    response: Response.json({
      jsonrpc: '2.0',
      id: JSON.parse(init.body).id,
      result: { structuredContent, ...extra },
    }),
    release,
  }));
  return release;
}

beforeEach(() => {
  vi.clearAllMocks();
  runBrowserHandoffCommand.mockResolvedValue(
    '✓ Secure browser form sent to ~nec'
  );
});

afterEach(() => vi.useRealTimers());

describe('browser session handoff', () => {
  it('retries unavailable lookups with bounded exponential backoff and sends one card', async () => {
    vi.useFakeTimers();
    reply({ session_id: handle, viewer_url: viewerUrl() });
    const releases = [vi.fn(), vi.fn()];
    for (const release of releases) {
      urbitFetch.mockImplementationOnce(async () => ({
        response: new Response('private upstream error', { status: 503 }),
        release,
      }));
    }
    const pending = runBrowserSessionHandoff(
      'tlon',
      ['browser', 'handoff', handle],
      config
    );
    await vi.advanceTimersByTimeAsync(499);
    expect(urbitFetch).toHaveBeenCalledTimes(1);
    expect(releases[0]).toHaveBeenCalledOnce();
    expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(urbitFetch).toHaveBeenCalledTimes(2);
    expect(releases[1]).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(urbitFetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toContain('sent');
    expect(urbitFetch).toHaveBeenCalledTimes(3);
    expect(runBrowserHandoffCommand).toHaveBeenCalledOnce();
  });

  it.each([
    { code: 'EAI_AGAIN' },
    { code: 'ECONNREFUSED' },
    { name: 'TimeoutError' },
    { cause: { code: 'UND_ERR_SOCKET' } },
  ])('retries transient transport failures (%j)', async (cause) => {
    vi.useFakeTimers();
    reply({ session_id: handle, viewer_url: viewerUrl() });
    urbitFetch.mockRejectedValueOnce(cause);
    const pending = runBrowserSessionHandoff(
      'tlon',
      ['browser', 'handoff', handle],
      config
    );
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toContain('sent');
    expect(urbitFetch).toHaveBeenCalledTimes(2);
    expect(runBrowserHandoffCommand).toHaveBeenCalledOnce();
  });

  it('limits retries to three attempts and never delivers after exhaustion', async () => {
    vi.useFakeTimers();
    const release = vi.fn();
    urbitFetch.mockImplementation(async () => ({
      response: new Response('secret failure', { status: 502 }),
      release,
    }));
    const pending = expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
    ).rejects.toThrow(
      /^Could not resolve a live browser session for handoff\.$/
    );
    await vi.runAllTimersAsync();
    await pending;
    expect(urbitFetch).toHaveBeenCalledTimes(3);
    expect(release).toHaveBeenCalledTimes(3);
    expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
  });

  it('caps attempt timeouts by the shared fifteen-second deadline', async () => {
    vi.useFakeTimers();
    const timeouts: number[] = [];
    urbitFetch.mockImplementation(async ({ timeoutMs }) => {
      timeouts.push(timeoutMs);
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
      throw Object.assign(new Error('secret timeout'), {
        name: 'TimeoutError',
      });
    });
    const start = Date.now();
    const pending = expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
    ).rejects.toThrow('Could not resolve');
    await vi.runAllTimersAsync();
    await pending;
    expect(timeouts).toEqual([5_000, 5_000, 3_500]);
    expect(Date.now() - start).toBe(15_000);
    expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 409, 429])(
    'does not retry a definitive HTTP %i response',
    async (status) => {
      const release = vi.fn();
      urbitFetch.mockImplementation(async () => ({
        response: new Response('denied', { status }),
        release,
      }));
      await expect(
        runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
      ).rejects.toThrow('Could not resolve');
      expect(urbitFetch).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
    }
  );

  it.each([
    { args: ['browser'] },
    { args: ['browser', '--help'] },
    { args: ['browser', 'handoff', '--help'] },
  ])(
    'documents only handle-based handoff at the model boundary',
    async ({ args }) => {
      const result = await runBrowserSessionHandoff('tlon', args, config);
      expect(result).toContain('browser handoff <session_id>');
      expect(result).not.toContain('<signed-viewer-url>');
      expect(urbitFetch).not.toHaveBeenCalled();
      expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
    }
  );

  it.each([
    {},
    { mcp: { servers: { mcp: { ...config.mcp.servers.mcp, headers: {} } } } },
    {
      mcp: { servers: { mcp: { ...config.mcp.servers.mcp, enabled: false } } },
    },
    {
      mcp: {
        servers: {
          mcp: {
            ...config.mcp.servers.mcp,
            url: 'https://zod.example/untrusted',
          },
        },
      },
    },
  ])('requires the configured authenticated MCP proxy', async (connection) => {
    await expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], {
        channels: config.channels,
        ...connection,
      })
    ).rejects.toThrow('Could not resolve');
    expect(urbitFetch).not.toHaveBeenCalled();
    expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
  });

  it.each([
    () => Response.json({ error: 'private upstream details' }, { status: 401 }),
    () =>
      new Response('invalid private body', {
        headers: { 'content-type': 'application/json' },
      }),
    () => Response.json({ padding: 'x'.repeat(65_537) }),
    () =>
      Response.json({
        jsonrpc: '2.0',
        id: 'wrong-request',
        result: {
          structuredContent: { session_id: handle, viewer_url: viewerUrl() },
        },
      }),
  ])(
    'fails closed and releases failed or malformed responses',
    async (response) => {
      const release = vi.fn().mockResolvedValue(undefined);
      urbitFetch.mockResolvedValue({ response: response(), release });
      await expect(
        runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
      ).rejects.toThrow(
        /^Could not resolve a live browser session for handoff\.$/
      );
      expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
      expect(urbitFetch).toHaveBeenCalledOnce();
    }
  );

  it('accepts an MCP event-stream response and closes it as soon as the matching result arrives', async () => {
    const url = viewerUrl();
    const release = vi.fn().mockResolvedValue(undefined);
    const cancel = vi.fn();
    urbitFetch.mockImplementation(async ({ init }) => ({
      response: new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `: keepalive\n\nevent: message\ndata: ${JSON.stringify({
                  jsonrpc: '2.0',
                  id: JSON.parse(init.body).id,
                  result: {
                    structuredContent: { session_id: handle, viewer_url: url },
                  },
                })}\n\n`
              )
            );
          },
          cancel,
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      ),
      release,
    }));
    await expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
    ).resolves.toContain('sent');
    expect(urbitFetch.mock.calls[0][0].init.headers.Accept).toBe(
      'application/json, text/event-stream'
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it('resolves the handle through the configured tenant and sends the exact server-issued URL', async () => {
    const url = viewerUrl();
    const release = reply({ session_id: handle, viewer_url: url });
    const result = await runBrowserSessionHandoff(
      'tlon',
      ['browser', 'handoff', handle],
      config
    );
    const request = urbitFetch.mock.calls[0][0];
    expect(request.baseUrl).toBe('https://zod.example');
    expect(request.path).toBe('/apps/mcp/mcp');
    expect(request.init.headers).toMatchObject({
      'X-API-Key': 'tenant-secret',
    });
    expect(JSON.parse(request.init.body)).toMatchObject({
      method: 'tools/call',
      params: {
        name: 'browser_browser_session_live_view',
        arguments: { session_id: handle },
      },
    });
    expect(request.maxRedirects).toBe(0);
    expect(runBrowserHandoffCommand).toHaveBeenCalledWith(
      'tlon',
      ['browser', 'handoff', url],
      config
    );
    expect(release).toHaveBeenCalledOnce();
    expect(result).toContain('sent to ~nec');
    expect(result).not.toContain(url);
  });

  it('fetches again for each handoff instead of retaining an expiring capability', async () => {
    for (const expiry of [Date.now() + 1_800_000, Date.now() + 7_200_000]) {
      const url = viewerUrl('session-viewer', expiry);
      reply({ session_id: handle, viewer_url: url });
      await runBrowserSessionHandoff(
        'tlon',
        ['browser', 'handoff', handle],
        config
      );
      expect(runBrowserHandoffCommand).toHaveBeenLastCalledWith(
        'tlon',
        ['browser', 'handoff', url],
        config
      );
    }
    expect(urbitFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { args: ['browser', 'handoff', viewerUrl('session-view')] },
    { args: ['browser', 'handoff', 'sess_typo'] },
    { args: ['browser', 'handoff', handle, '--owner', '~bud'] },
    { args: ['--ship', '~bud', 'browser', 'handoff', handle] },
  ])(
    'rejects model-supplied capabilities and malformed commands before network access',
    async ({ args }) => {
      await expect(
        runBrowserSessionHandoff('tlon', args, config)
      ).rejects.toThrow('browser handoff <session_id>');
      expect(urbitFetch).not.toHaveBeenCalled();
      expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
    }
  );

  it('rejects ambiguous accounts before contacting the browser service', async () => {
    await expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], {
        ...config,
        channels: {
          tlon: {
            ...config.channels.tlon,
            accounts: { other: { ...config.channels.tlon, ship: '~bud' } },
          },
        },
      })
    ).rejects.toThrow('exactly one');
    expect(urbitFetch).not.toHaveBeenCalled();
  });

  it.each([
    { session_id: 'sess_other', viewer_url: viewerUrl() },
    { session_id: handle },
    { session_id: handle, viewer_url: viewerUrl('session-view') },
    {
      session_id: handle,
      viewer_url: viewerUrl('session-viewer', Date.now() - 1_000),
    },
    {
      session_id: handle,
      viewer_url: viewerUrl().replace(
        'browser-session-ovh2.tlon.network',
        'evil.example'
      ),
    },
  ])(
    'rejects mismatched or invalid browser metadata without disclosing it',
    async (metadata) => {
      const release = reply(metadata);
      await expect(
        runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
      ).rejects.toThrow('Could not resolve');
      expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
    }
  );

  it('does not deliver a card when the authenticated lookup denies a foreign or released session', async () => {
    reply({ session_id: handle, viewer_url: viewerUrl() }, { isError: true });
    await expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
    ).rejects.toThrow('Could not resolve');
    expect(runBrowserHandoffCommand).not.toHaveBeenCalled();
    expect(urbitFetch).toHaveBeenCalledOnce();
  });

  it('does not leak upstream response bodies or transport errors', async () => {
    urbitFetch.mockRejectedValue(
      new Error(`failure tenant-secret ${viewerUrl()}`)
    );
    await expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
    ).rejects.toThrow(
      /^Could not resolve a live browser session for handoff\.$/
    );
  });

  it('does not leak the resolved capability from CLI errors', async () => {
    const url = viewerUrl();
    reply({ session_id: handle, viewer_url: url });
    runBrowserHandoffCommand.mockRejectedValue(new Error(`failure ${url}`));
    await expect(
      runBrowserSessionHandoff('tlon', ['browser', 'handoff', handle], config)
    ).rejects.toThrow(/^Could not send the secure browser form\.$/);
    expect(runBrowserHandoffCommand).toHaveBeenCalledOnce();
    expect(urbitFetch).toHaveBeenCalledOnce();
  });
});
