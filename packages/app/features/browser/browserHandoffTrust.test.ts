import { describe, expect, it } from 'vitest';

import { canUseBrowserHandoff } from './browserHandoffTrust';

const dm = {
  currentUserId: '~sampel-palnet',
  authorId: '~finned-palmer',
  channelId: '~finned-palmer',
  canUseAgentProviderControls: false,
};

describe('browser handoff trust', () => {
  it('allows self-provisioned DM bots identified by bot messages or owned moons', () => {
    expect(canUseBrowserHandoff({ ...dm, isBot: true })).toBe(true);
    expect(canUseBrowserHandoff({ ...dm, hasBotPosts: true })).toBe(true);
    expect(
      canUseBrowserHandoff({
        ...dm,
        authorId: '~dirmec-dolbes-sampel-palnet',
        channelId: '~dirmec-dolbes-sampel-palnet',
      })
    ).toBe(true);
  });

  it('requires a bot signal from the DM counterpart', () => {
    expect(canUseBrowserHandoff(dm)).toBe(false);
    expect(
      canUseBrowserHandoff({
        ...dm,
        authorId: dm.currentUserId,
        hasBotPosts: true,
      })
    ).toBe(false);
    expect(
      canUseBrowserHandoff({
        ...dm,
        channelId: 'chat/~sampel-palnet/general',
        isBot: true,
      })
    ).toBe(false);
  });

  it('allows the hosted owner bot and authorized group agent', () => {
    expect(
      canUseBrowserHandoff({ ...dm, canUseAgentProviderControls: true })
    ).toBe(true);
    expect(
      canUseBrowserHandoff({
        ...dm,
        channelId: 'chat/~sampel-palnet/general',
        canUseAgentProviderControls: true,
      })
    ).toBe(true);
  });
});
