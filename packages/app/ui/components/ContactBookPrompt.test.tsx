import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  syncSystemContacts: vi.fn(),
  syncContactDiscovery: vi.fn(),
  eliminate: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { ContactDiscoveryCompleted: 'ContactDiscoveryCompleted' },
  createDevLogger: () => ({}),
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  syncSystemContacts: mocks.syncSystemContacts,
  syncContactDiscovery: mocks.syncContactDiscovery,
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Text: 'Text',
}));
vi.mock('react-native', () => ({ Alert: { alert: mocks.alert } }));
vi.mock('tamagui', () => ({
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: false,
  styled: (component: unknown) => component,
}));
vi.mock('../../hooks/useContactPermissions', () => ({
  useContactPermissions: () => ({
    status: 'undetermined',
    isLoading: false,
    canAskPermission: true,
    requestPermissions: async () => 'granted',
  }),
}));
vi.mock('../../hooks/useNag', () => ({
  useNag: () => ({
    isLoading: false,
    shouldShow: true,
    eliminate: mocks.eliminate,
    dismiss: mocks.dismiss,
  }),
}));
vi.mock('../../lib/notifications', () => ({
  useNotificationPermissions: vi.fn(),
}));
vi.mock('../../navigation/useTopLevelTabBarContentInset', () => ({
  useTopLevelTabBarContentInset: () => 0,
}));

import { ContactBookPrompt } from './SystemNotices';

let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.syncSystemContacts.mockResolvedValue([]);
  mocks.syncContactDiscovery.mockResolvedValue({
    didDiscover: false,
    didSucceed: true,
    newMatches: [],
  });
  act(() => {
    renderer = create(
      <ContactBookPrompt
        status="undetermined"
        onDismiss={() => {}}
        onRequestAccess={() => {}}
        onOpenSettings={() => {}}
      />
    );
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function continuePrompt() {
  const button = renderer.root.find((node) => node.props.label === 'Continue');
  await act(() => button.props.onPress());
}

test('a failed import shows an error without Success or discovery', async () => {
  mocks.syncSystemContacts.mockRejectedValue(
    new Error('read or import failed')
  );
  await continuePrompt();
  expect(mocks.alert).toHaveBeenCalledOnce();
  expect(mocks.alert).toHaveBeenCalledWith(
    'Unable to sync contacts',
    'Please try again later.'
  );
  expect(mocks.syncContactDiscovery).not.toHaveBeenCalled();
  expect(mocks.eliminate).not.toHaveBeenCalled();
});

test('a successful import keeps the existing confirmation and discovery', async () => {
  await continuePrompt();
  expect(mocks.alert).toHaveBeenCalledWith(
    'Success',
    'Your contacts have been synced.'
  );
  expect(mocks.syncContactDiscovery).toHaveBeenCalledOnce();
  expect(mocks.eliminate).toHaveBeenCalledOnce();
});
