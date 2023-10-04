import { describe, it, expect } from 'vitest';
import React from 'react';
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
        sendMessage={() => {
          // placeholder;
        }}
        dropZoneId="dropzone"
        scrollElementRef={{ current: null }}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
