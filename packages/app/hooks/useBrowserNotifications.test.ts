import { CollectionRendererId } from '@tloncorp/api';
import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import useBrowserNotifications from './useBrowserNotifications';

const mocks = vi.hoisted(() => ({
  subscribeToActivity: vi.fn(),
  unsubscribe: vi.fn(),
  getChannelWithRelations: vi.fn(),
  getContact: vi.fn(),
  getGroup: vi.fn(),
  notificationCtor: vi.fn(),
}));

vi.mock('@tloncorp/api', async () => {
  const actual =
    await vi.importActual<typeof import('@tloncorp/api')>('@tloncorp/api');
  return {
    ...actual,
    subscribeToActivity: mocks.subscribeToActivity,
    unsubscribe: mocks.unsubscribe,
    onActivityCapabilitiesChange: () => () => {},
    getActivityCapabilitiesEpoch: () => 0,
  };
});

// `@tloncorp/shared` and `@tloncorp/shared/db` reach expo native modules
// through the store index, so they're stubbed down to what this hook touches.
// `@tloncorp/shared/logic` is deliberately NOT mocked: `isSurfaceChannel` is
// the thing under test.
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { ActionTappedPushNotif: 'ActionTappedPushNotif' },
  createDevLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackError: vi.fn(),
  }),
  trackEvent: vi.fn(),
}));

vi.mock('@tloncorp/shared/db', () => ({
  getChannelWithRelations: mocks.getChannelWithRelations,
  getContact: mocks.getContact,
  getGroup: mocks.getGroup,
}));

vi.mock('../navigation/utils', () => ({
  useRootNavigation: () => ({
    resetToChannel: vi.fn(),
    resetToGroup: vi.fn(),
    resetToGroupInvite: vi.fn(),
    resetToPost: vi.fn(),
  }),
}));

vi.mock('./useAgentGroupOnboardingLock', () => ({
  useAgentGroupOnboardingNavGate: () => ({
    locked: false,
    isLoading: false,
    runWhenUnlocked: async (fn: () => unknown) => {
      await fn();
      return { ran: true };
    },
  }),
}));

vi.mock('../ui/components/Activity/ActivitySummaryMessage', () => ({
  reactDisplayValue: () => '',
}));

vi.mock('../ui/contexts/appDataContext', () => ({
  useCalm: () => ({ disableNicknames: false }),
  useCurrentUserId: () => '~zod',
}));

vi.mock('./useIsElectron', () => ({ useIsElectron: () => false }));

const GROUP_ID = '~zod/tlon';
const SURFACE_CHANNEL_ID = 'chat/~zod/dashboard';
const CHAT_CHANNEL_ID = 'chat/~zod/general';

function channelWithRenderer(id: string, renderer: CollectionRendererId) {
  return {
    id,
    groupId: GROUP_ID,
    title: 'A channel',
    contentConfiguration: {
      draftInput: { id: 'tlon.r0.input.chat' },
      defaultPostContentRenderer: { id: 'tlon.r0.content.chat' },
      defaultPostCollectionRenderer: { id: renderer },
    },
  };
}

function activityEventFor(channelId: string) {
  return {
    id: `${channelId}-1`,
    type: 'post',
    channelId,
    groupId: GROUP_ID,
    authorId: '~ten',
    postId: '~ten/1',
    timestamp: 1,
    shouldNotify: true,
    bucketId: 'all',
    content: [{ inline: ['dashboard button tapped'] }],
  };
}

class FakeNotification {
  static permission = 'granted';
  onclick: (() => void) | null = null;
  constructor(title: string, options: unknown) {
    mocks.notificationCtor(title, options);
  }
  close() {}
}

let emitActivity: ((event: unknown) => void) | null = null;

function Harness() {
  useBrowserNotifications();
  return null;
}

async function deliver(channelId: string) {
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(React.createElement(Harness));
  });
  await act(async () => {
    emitActivity?.({
      type: 'addActivityEvent',
      events: [activityEventFor(channelId)],
    });
    await Promise.resolve();
  });
  // let the async showActivityNotification body settle
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    renderer?.unmount();
  });
}

describe('useBrowserNotifications surface-channel exclusion', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    emitActivity = null;
    // Backgrounded tab with permission granted — the state in which the hook
    // actually presents notifications.
    vi.stubGlobal('window', {
      isSecureContext: true,
      Notification: FakeNotification,
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
      focus: () => {},
    });
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      hasFocus: () => false,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    mocks.subscribeToActivity.mockImplementation(async (handler) => {
      emitActivity = handler;
      return 1;
    });
    mocks.getContact.mockResolvedValue({ id: '~ten', nickname: 'Ten' });
    mocks.getGroup.mockResolvedValue({ id: GROUP_ID, title: 'Tlon' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never notifies for a surface channel event, even before the hush has landed', async () => {
    // No volume settings involved: as far as the backend is concerned this
    // channel is still notify-on, which is exactly the pre-hush window.
    mocks.getChannelWithRelations.mockResolvedValue(
      channelWithRenderer(SURFACE_CHANNEL_ID, CollectionRendererId.surface)
    );

    await deliver(SURFACE_CHANNEL_ID);

    expect(mocks.getChannelWithRelations).toHaveBeenCalled();
    expect(mocks.notificationCtor).not.toHaveBeenCalled();
  });

  it('still notifies for a non-surface channel in the same group', async () => {
    mocks.getChannelWithRelations.mockResolvedValue(
      channelWithRenderer(CHAT_CHANNEL_ID, CollectionRendererId.chat)
    );

    await deliver(CHAT_CHANNEL_ID);

    expect(mocks.notificationCtor).toHaveBeenCalledTimes(1);
  });
});
