import React from 'react';
import { describe, expect, it } from 'vitest';

import { render } from '../../../test/utils';
import ChatInput from './ChatInput';

vi.mock('@/components/Leap/useLeap', () => ({
  default: () => ({
    isOpen: false,
  }),
}));

vi.mock('@/state/groups', () => ({
  useGroupFlag: () => '~sampel-palnet/test',
  useGroups: () => ({}),
}));

vi.mock('@/logic/useGroupPrivacy', () => ({
  default: () => 'public',
}));

vi.mock('@/logic/analytics', () => ({
  captureGroupsAnalyticsEvent: () => ({}),
}));

describe('ChatInput', () => {
  it.skip('renders as expected', () => {
    const { asFragment } = render(
      <ChatInput
        whom="~zod/test"
        sendDm={() => {
          // placeholder;
        }}
        dropZoneId="dropzone"
        isScrolling={false}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
