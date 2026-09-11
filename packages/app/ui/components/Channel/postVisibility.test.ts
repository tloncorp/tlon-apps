import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  findAgentOnboardingOrientationCompletePostId,
  isAgentGroupSetupActive,
  isAgentGroupSetupCompletePost,
  isAgentGroupSetupRequestPost,
  isAgentOnboardingFirstGroupRequestPost,
  isAgentOnboardingOrientationCompletePost,
  isVisibleChannelPost,
  TLAWN_HOME_GROUP_WELCOME_MESSAGE,
} from './postVisibility';

describe('isVisibleChannelPost', () => {
  it('hides typed onboarding intro requests', () => {
    expect(
      isVisibleChannelPost(
        {
          authorId: '~ten',
          blob: appendToPostBlob(undefined, {
            type: 'tlon-agent-intro-request',
            version: 1,
            groupId: '~ten/group',
          }),
        },
        '~ten'
      )
    ).toBe(false);
  });

  it('keeps onboarding intro requests from other authors visible', () => {
    expect(
      isVisibleChannelPost(
        {
          authorId: '~nec',
          blob: appendToPostBlob(undefined, {
            type: 'tlon-agent-intro-request',
            version: 1,
            groupId: '~ten/group',
          }),
        },
        '~ten'
      )
    ).toBe(true);
  });

  it('keeps a failed intro request visible so it can be retried', () => {
    expect(
      isVisibleChannelPost(
        {
          authorId: '~ten',
          deliveryStatus: 'failed',
          blob: appendToPostBlob(undefined, {
            type: 'tlon-agent-intro-request',
            version: 1,
            groupId: '~ten/group',
          }),
        },
        '~ten'
      )
    ).toBe(true);
  });

  it('keeps ordinary and unrelated typed posts visible', () => {
    expect(isVisibleChannelPost({ authorId: '~ten', blob: null }, '~ten')).toBe(
      true
    );
    expect(
      isVisibleChannelPost(
        {
          authorId: '~ten',
          blob: appendToPostBlob(undefined, {
            type: 'tlon-agent-post-marker',
            version: 1,
            key: 'intro',
          }),
        },
        '~ten'
      )
    ).toBe(true);
  });

  it('hides the provisioning welcome only in the bot home group', () => {
    const welcome = {
      authorId: '~bot',
      blob: null,
      isBot: true,
      textContent: TLAWN_HOME_GROUP_WELCOME_MESSAGE,
    };

    expect(
      isVisibleChannelPost(welcome, '~ten', 'chat/~ten/home-group-chat')
    ).toBe(false);
    expect(isVisibleChannelPost(welcome, '~ten', 'chat/~ten/elsewhere')).toBe(
      true
    );
  });

  it('keeps user-authored and combined onboarding welcomes visible', () => {
    const channelId = 'chat/~ten/home-group-chat';
    expect(
      isVisibleChannelPost(
        {
          authorId: '~ten',
          blob: null,
          textContent: TLAWN_HOME_GROUP_WELCOME_MESSAGE,
        },
        '~ten',
        channelId
      )
    ).toBe(true);
    expect(
      isVisibleChannelPost(
        {
          authorId: '~bot',
          blob: null,
          isBot: true,
          textContent: `${TLAWN_HOME_GROUP_WELCOME_MESSAGE}\n\nWhat can I help you with?`,
        },
        '~ten',
        channelId
      )
    ).toBe(true);
  });
});

describe('isAgentOnboardingOrientationCompletePost', () => {
  it('recognizes the final onboarding marker', () => {
    expect(
      isAgentOnboardingOrientationCompletePost({
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'orientation-complete',
        }),
      })
    ).toBe(true);
  });

  it('ignores other posts', () => {
    expect(isAgentOnboardingOrientationCompletePost({ blob: null })).toBe(
      false
    );
    expect(
      isAgentOnboardingOrientationCompletePost({
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'intro',
        }),
      })
    ).toBe(false);
  });
});

describe('findAgentOnboardingOrientationCompletePostId', () => {
  const marker = (id: string, authorId: string) => ({
    id,
    authorId,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-post-marker' as const,
      version: 1 as const,
      key: 'orientation-complete',
    }),
  });

  it('accepts only the recorded group agent marker', () => {
    expect(
      findAgentOnboardingOrientationCompletePostId(
        [marker('spoofed', '~member'), marker('real', '~bot')],
        '~bot'
      )
    ).toBe('real');
    expect(
      findAgentOnboardingOrientationCompletePostId(
        [marker('spoofed', '~member')],
        '~bot'
      )
    ).toBeNull();
  });
});

describe('agent group setup state markers', () => {
  it('recognizes the durable setup request', () => {
    expect(
      isAgentGroupSetupRequestPost({
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-intro-request',
          version: 1,
          groupId: '~ten/group',
        }),
      })
    ).toBe(true);
    expect(isAgentGroupSetupRequestPost({ blob: null })).toBe(false);
  });

  it('distinguishes the first hosted group from later setup requests', () => {
    const request = (isFirstGroup?: boolean) => ({
      blob: appendToPostBlob(undefined, {
        type: 'tlon-agent-intro-request' as const,
        version: 1 as const,
        groupId: '~ten/group',
        ...(isFirstGroup ? { isFirstGroup: true } : {}),
      }),
    });

    expect(isAgentOnboardingFirstGroupRequestPost(request(true))).toBe(true);
    expect(isAgentOnboardingFirstGroupRequestPost(request())).toBe(false);
  });

  it('recognizes completion and terminal failure', () => {
    for (const key of [
      'orientation-complete',
      'group-setup-complete',
      'first-entry-failed',
    ]) {
      expect(
        isAgentGroupSetupCompletePost({
          blob: appendToPostBlob(undefined, {
            type: 'tlon-agent-post-marker',
            version: 1,
            key,
          }),
        })
      ).toBe(true);
    }
    expect(
      isAgentGroupSetupCompletePost({
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'services-card',
        }),
      })
    ).toBe(false);
  });

  it('keeps setup active without coupling it to navigation locking', () => {
    const request = {
      authorId: '~ten',
      blob: appendToPostBlob(undefined, {
        type: 'tlon-agent-intro-request' as const,
        version: 1 as const,
        groupId: '~ten/group',
      }),
    };
    const complete = {
      authorId: '~bot',
      blob: appendToPostBlob(undefined, {
        type: 'tlon-agent-post-marker' as const,
        version: 1 as const,
        key: 'group-setup-complete',
      }),
    };

    expect(isAgentGroupSetupActive([], '~ten', '~bot', true)).toBe(true);
    expect(isAgentGroupSetupActive([request], '~ten', '~bot', false)).toBe(
      true
    );
    expect(
      isAgentGroupSetupActive([request, complete], '~ten', '~bot', false)
    ).toBe(false);
    expect(
      isAgentGroupSetupActive(
        [request, { ...complete, authorId: '~someone-else' }],
        '~ten',
        '~bot',
        false
      )
    ).toBe(true);
    expect(
      isAgentGroupSetupActive(
        [{ ...request, authorId: '~someone-else' }],
        '~ten',
        '~bot',
        false
      )
    ).toBe(false);
    expect(
      isAgentGroupSetupActive(
        [{ ...request, deliveryStatus: 'failed' }],
        '~ten',
        '~bot',
        false
      )
    ).toBe(false);
  });
});
