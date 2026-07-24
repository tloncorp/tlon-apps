import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the media pipeline, the authenticated-api wrapper, and the send helpers
// so sendMedia can be exercised without a ship. The account/target resolution
// (types.js, targets.js) runs for real against a minimal valid config.
vi.mock('@tloncorp/api', () => ({
  scry: vi.fn(),
}));
vi.mock('./urbit/upload.js', () => ({
  prepareOutboundMedia: vi.fn(),
}));
vi.mock('./urbit/api-client.js', () => ({
  withAuthenticatedTlonApi: vi.fn(),
}));
vi.mock('./urbit/send.js', () => ({
  buildMediaStory: vi.fn(() => [{ inline: [''] }]),
  sendDm: vi.fn(),
  sendDmWithStory: vi.fn(),
  sendChannelPost: vi.fn(),
}));
vi.mock('./monitor/index.js', () => ({
  monitorTlonProvider: vi.fn(),
}));
vi.mock('./setup-surface.js', () => ({
  tlonSetupWizard: {},
}));

const cfg = {
  channels: {
    tlon: {
      ship: '~zod',
      url: 'http://localhost:8080',
      code: 'lidlut-tabwed-pillex-ridruc',
    },
  },
} as never;

describe('sendMedia', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { withAuthenticatedTlonApi } = await import('./urbit/api-client.js');
    vi.mocked(withAuthenticatedTlonApi).mockImplementation(
      async (_params, fn) => fn()
    );
    const { sendDmWithStory, sendChannelPost } = await import(
      './urbit/send.js'
    );
    vi.mocked(sendDmWithStory).mockResolvedValue({
      channel: 'tlon',
      messageId: '~zod/1',
      sentAt: 1,
    });
    vi.mocked(sendChannelPost).mockResolvedValue({
      channel: 'tlon',
      messageId: '~zod/1',
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('forwards mediaAccess/mediaLocalRoots/mediaReadFile to prepareOutboundMedia', async () => {
    const { prepareOutboundMedia } = await import('./urbit/upload.js');
    const prepared = {
      url: 'https://storage.example/u/img.png',
      isImage: true,
      width: 10,
      height: 20,
      contentType: 'image/png',
    };
    vi.mocked(prepareOutboundMedia).mockResolvedValue(prepared);

    const { tlonRuntimeOutbound } = await import('./channel.runtime.js');
    const mediaAccess = { localRoots: ['/ws'] };
    const mediaLocalRoots = ['/ws'];
    const mediaReadFile = async (p: string) => Buffer.from(p);

    await tlonRuntimeOutbound.sendMedia?.({
      cfg,
      to: '~nec',
      text: 'caption',
      mediaUrl: '/ws/img.png',
      mediaAccess,
      mediaLocalRoots,
      mediaReadFile,
    } as never);

    expect(prepareOutboundMedia).toHaveBeenCalledWith('/ws/img.png', {
      mediaAccess,
      mediaLocalRoots,
      mediaReadFile,
    });
  });

  it('rejects sendMedia when prepareOutboundMedia rejects (no post attempted)', async () => {
    const { prepareOutboundMedia } = await import('./urbit/upload.js');
    vi.mocked(prepareOutboundMedia).mockRejectedValue(
      new Error(
        'Cannot read media "[local media reference]": Media file not found'
      )
    );
    const { sendDmWithStory, sendChannelPost } = await import(
      './urbit/send.js'
    );

    const { tlonRuntimeOutbound } = await import('./channel.runtime.js');
    await expect(
      tlonRuntimeOutbound.sendMedia?.({
        cfg,
        to: '~nec',
        text: 'caption',
        mediaUrl: '/ws/missing.png',
      } as never)
    ).rejects.toThrow(/Cannot read media "\[local media reference\]"/);

    expect(sendDmWithStory).not.toHaveBeenCalled();
    expect(sendChannelPost).not.toHaveBeenCalled();
  });
});
