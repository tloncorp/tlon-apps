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

  it('hides the tlonbot intro only in this user\u2019s own bot DM', () => {
    // Verbatim from tlonbot's INTRO_MESSAGE, ship interpolated mid-message,
    // which is why this one cannot be matched whole.
    const intro = [
      "Howdy, I'm your Tlonbot \u{1F331} ",
      "I'm a purpose-built AI agent that can help you get things done.",
      "You can chat with me here or add me to a group; in groups, you'll need" +
        " to mention me (just @ten's tlonbot) to get my attention.",
      "I'd love to get to know you a bit so I can be more useful. What should" +
        ' I call you, and what kinds of things do you want help with on Tlon?',
      'I can send you a daily morning brief on any topic (AI, news, sports,' +
        ' anything), a daily reminder, or your local weather every morning.' +
        " Just say the word and I'll be there every day. \u{1F305} ",
    ].join('\n\n');
    const post = { authorId: '~pinser-botter-ten', blob: null, isBot: true };

    expect(
      isVisibleChannelPost(
        { ...post, textContent: intro },
        '~ten',
        '~pinser-botter-ten'
      )
    ).toBe(false);
    // Another bot's DM must not be able to blank a message this way.
    expect(
      isVisibleChannelPost(
        { ...post, textContent: intro },
        '~ten',
        '~pinser-botter-zod'
      )
    ).toBe(true);
    // Nor may anyone but the bot itself, in its own DM.
    expect(
      isVisibleChannelPost(
        { ...post, authorId: '~ten', textContent: intro },
        '~ten',
        '~pinser-botter-ten'
      )
    ).toBe(true);
  });

  it('keeps a later bot message that merely opens the same way visible', () => {
    expect(
      isVisibleChannelPost(
        {
          authorId: '~pinser-botter-ten',
          blob: null,
          isBot: true,
          textContent: "Howdy, I'm your Tlonbot \u{1F331} — anything else?",
        },
        '~ten',
        '~pinser-botter-ten'
      )
    ).toBe(true);
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
