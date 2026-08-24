import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  isAgentOnboardingOrientationCompletePost,
  isVisibleChannelPost,
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
