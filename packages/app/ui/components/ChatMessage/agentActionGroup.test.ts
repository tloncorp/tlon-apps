import { describe, expect, it } from 'vitest';

import { resolveAgentActionGroupId } from './agentActionGroup';

const GROUP = '~ten/workspace';
const OTHER = '~ten/elsewhere';
const BOT_DM = {
  postGroupId: null,
  currentGroupId: null,
  requestedGroupId: GROUP,
};

describe('resolveAgentActionGroupId', () => {
  it('takes the workspace the request names when there is no surrounding group', () => {
    // Onboarding runs in the bot DM, which belongs to no group.
    expect(
      resolveAgentActionGroupId({ ...BOT_DM, postIsFromOwnBot: true })
    ).toBe(GROUP);
  });

  it('refuses a groupless conversation when the author is not this user’s bot', () => {
    // Otherwise any ship could DM a surface pointing at a group of ours.
    expect(
      resolveAgentActionGroupId({ ...BOT_DM, postIsFromOwnBot: false })
    ).toBeNull();
  });

  it('needs the request to name a group at all', () => {
    expect(
      resolveAgentActionGroupId({
        ...BOT_DM,
        requestedGroupId: null,
        postIsFromOwnBot: true,
      })
    ).toBeNull();
  });

  it('binds to the surrounding group in a group channel', () => {
    expect(
      resolveAgentActionGroupId({
        postGroupId: GROUP,
        currentGroupId: GROUP,
        requestedGroupId: GROUP,
        postIsFromOwnBot: false,
      })
    ).toBe(GROUP);
  });

  it('will not let a surface in one group act on another', () => {
    expect(
      resolveAgentActionGroupId({
        postGroupId: GROUP,
        currentGroupId: GROUP,
        requestedGroupId: OTHER,
        postIsFromOwnBot: true,
      })
    ).toBeNull();
  });

  it('will not act while the channel disagrees with the post about its group', () => {
    expect(
      resolveAgentActionGroupId({
        postGroupId: GROUP,
        currentGroupId: OTHER,
        requestedGroupId: GROUP,
        postIsFromOwnBot: true,
      })
    ).toBeNull();
  });

  it('will not act before the surrounding group has loaded', () => {
    expect(
      resolveAgentActionGroupId({
        postGroupId: GROUP,
        currentGroupId: null,
        requestedGroupId: GROUP,
        postIsFromOwnBot: true,
      })
    ).toBeNull();
  });
});
