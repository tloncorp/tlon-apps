import { describe, expect, it } from 'vitest';

import { canUseBrowserHandoff } from './browserHandoffTrust';

const dm = {
  currentUserId: '~sampel-palnet',
  authorId: '~finned-palmer',
  channelId: '~finned-palmer',
  canUseAgentProviderControls: false,
};

describe('browser handoff trust', () => {
  it('allows self-provisioned DM bots on owned moons', () => {
    expect(
      canUseBrowserHandoff({
        ...dm,
        authorId: '~dirmec-dolbes-sampel-palnet',
        channelId: '~dirmec-dolbes-sampel-palnet',
      })
    ).toBe(true);
  });

  it('does not trust sender-supplied bot metadata', () => {
    expect(canUseBrowserHandoff(dm)).toBe(false);
    const botProfileSender = { ...dm, isBot: true, hasBotPosts: true };
    expect(canUseBrowserHandoff(botProfileSender)).toBe(false);
  });

  it('requires the owned moon to be the DM counterpart', () => {
    expect(
      canUseBrowserHandoff({
        ...dm,
        authorId: dm.currentUserId,
      })
    ).toBe(false);
    expect(
      canUseBrowserHandoff({
        ...dm,
        authorId: '~dirmec-dolbes-sampel-palnet',
        channelId: 'chat/~sampel-palnet/general',
      })
    ).toBe(false);
  });

  it('rejects another user’s moon', () => {
    expect(
      canUseBrowserHandoff({
        ...dm,
        authorId: '~dirmec-dolbes-finned-palmer',
        channelId: '~dirmec-dolbes-finned-palmer',
      })
    ).toBe(false);
  });

  it('allows the hosted owner bot in its DM', () => {
    expect(
      canUseBrowserHandoff({ ...dm, canUseAgentProviderControls: true })
    ).toBe(true);
  });

  it.each(['chat/~sampel-palnet/general', '0v123', '~nec'])(
    'rejects handoffs outside the owner/bot DM even with provider controls: %s',
    (channelId) => {
      expect(
        canUseBrowserHandoff({
          ...dm,
          channelId,
          canUseAgentProviderControls: true,
        })
      ).toBe(false);
    }
  );
});
