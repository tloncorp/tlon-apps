/**
 * Redirects through the installed SSRF guard (not mocked): a non-owner turn
 * checks every hop against its media rule, which the guard's own policy does
 * not know.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tloncorp/api', () => ({
  getCurrentUserIsHosted: vi.fn(() => false),
  scry: vi.fn(async () => {
    throw new Error('no storage');
  }),
  uploadFile: vi.fn(),
}));

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const ATTACKER = 'https://attacker.example/image';
const SHIP_HOST = 'zod.tlon.network';
const cfg = { channels: { tlon: { url: `https://${SHIP_HOST}` } } } as never;

let transport: ReturnType<typeof vi.fn>;

function redirectTo(location: string) {
  transport.mockImplementation(async (url: string) =>
    url === ATTACKER
      ? new Response(null, { status: 302, headers: { location } })
      : new Response(PNG, { headers: { 'content-type': 'image/png' } })
  );
}

async function turnFor(senderRole: 'owner' | 'user', runId: string) {
  const { startTlonAgentTurn } = await import('../turn-recorder.js');
  return startTlonAgentTurn(
    {
      accountId: 'hosted',
      agentId: 'main',
      destinationKind: 'dm',
      inputMessageId: '~nec/1',
      runId,
      sessionKey: `agent:main:tlon:direct:~nec-${runId}`,
      ship: '~zod',
      trigger: 'dm',
      senderRole,
    },
    {
      observer: {
        recordStarted: () => undefined,
        recordTerminal: () => undefined,
      },
    }
  );
}

describe('prepareOutboundMedia redirects', () => {
  beforeEach(() => {
    transport = vi.fn();
    vi.stubGlobal('fetch', transport);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([`https://${SHIP_HOST}/image`, 'https://93.184.216.34/image'])(
    'refuses a non-owner redirect to %s',
    async (location) => {
      const { prepareOutboundMedia } = await import('./upload.js');
      redirectTo(location);
      const turn = await turnFor('user', `redirect-${location}`);
      await expect(
        turn.run(() => prepareOutboundMedia(ATTACKER, { cfg }))
      ).rejects.toThrow();
      expect(transport.mock.calls.map(([url]) => url)).toEqual([ATTACKER]);
    }
  );

  it('follows a non-owner redirect to another public https host', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    redirectTo('https://cdn.example.org/image');
    const turn = await turnFor('user', 'redirect-public');
    await expect(
      turn.run(() => prepareOutboundMedia(ATTACKER, { cfg }))
    ).resolves.toMatchObject({ url: ATTACKER });
    expect(transport.mock.calls.map(([url]) => url)).toEqual([
      ATTACKER,
      'https://cdn.example.org/image',
    ]);
  });

  it('leaves an owner turn on the SSRF policy alone', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    redirectTo(`https://${SHIP_HOST}/image`);
    const turn = await turnFor('owner', 'redirect-owner');
    await expect(
      turn.run(() => prepareOutboundMedia(ATTACKER, { cfg }))
    ).resolves.toMatchObject({ url: ATTACKER });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('keeps the non-owner decision for a download that outlives the turn', async () => {
    const { prepareOutboundMedia } = await import('./upload.js');
    let redirect!: () => void;
    const redirected = new Promise<void>((resolve) => (redirect = resolve));
    transport.mockImplementation(async (url: string) => {
      if (url !== ATTACKER) {
        return new Response(PNG, { headers: { 'content-type': 'image/png' } });
      }
      await redirected;
      return new Response(null, {
        status: 302,
        headers: { location: `https://${SHIP_HOST}/image` },
      });
    });
    const turn = await turnFor('user', 'redirect-after-finalize');
    const pending = turn.run(() => prepareOutboundMedia(ATTACKER, { cfg }));
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    turn.finalize({ durationMs: 1 });
    redirect();
    await expect(pending).rejects.toThrow();
    expect(transport).toHaveBeenCalledOnce();
  });
});
