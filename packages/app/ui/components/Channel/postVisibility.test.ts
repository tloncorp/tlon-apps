import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  isAgentOnboardingOrientationCompletePost,
  isVisibleChannelPost,
} from './postVisibility';

describe('isVisibleChannelPost', () => {
  it('hides typed onboarding intro requests', () => {
    expect(
      isVisibleChannelPost({
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-intro-request',
          version: 1,
          groupId: '~ten/group',
        }),
      })
    ).toBe(false);
  });

  it('keeps ordinary and unrelated typed posts visible', () => {
    expect(isVisibleChannelPost({ blob: null })).toBe(true);
    expect(
      isVisibleChannelPost({
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'intro',
        }),
      })
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
