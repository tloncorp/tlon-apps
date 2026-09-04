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

import useDesktopNotifications from './useDesktopNotifications';

const mocks = vi.hoisted(() => ({
  subscribeToActivity: vi.fn(),
  unsubscribe: vi.fn(),
  getChannelWithRelations: vi.fn(),
  getContact: vi.fn(),
  getGroup: vi.fn(),
  showNotification: vi.fn(),
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
    markChatRead: vi.fn(),
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
  notesNotebookFlagFromChannelId: () => null,
  trackEvent: vi.fn(),
}));

vi.mock('@tloncorp/shared/db', () => ({
  getChannelWithRelations: mocks.getChannelWithRelations,
  getContact: mocks.getContact,
  getGroup: mocks.getGroup,
}));

vi.mock('@tloncorp/shared/store', () => ({ markNoteRead: vi.fn() }));

vi.mock('./useIsElectron', () => ({ useIsElectron: () => true }));

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
    content: [{ inline: ['dashboard button tapped'] }],
  };
}

let emitActivity: ((event: unknown) => void) | null = null;

function Harness() {
  useDesktopNotifications(true);
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
  // let the async processActivityEvent body settle
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    renderer?.unmount();
  });
}

describe('useDesktopNotifications surface-channel exclusion', () => {
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
    vi.stubGlobal('window', {
      electronAPI: {
        showNotification: mocks.showNotification,
        onNotificationClicked: () => () => {},
      },
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
    // No volume settings involved: the channel is still notify-on as far as
    // the backend is concerned, which is exactly the pre-hush window.
    mocks.getChannelWithRelations.mockResolvedValue(
      channelWithRenderer(SURFACE_CHANNEL_ID, CollectionRendererId.surface)
    );

    await deliver(SURFACE_CHANNEL_ID);

    expect(mocks.getChannelWithRelations).toHaveBeenCalled();
    expect(mocks.showNotification).not.toHaveBeenCalled();
  });

  it('still notifies for a non-surface channel in the same group', async () => {
    mocks.getChannelWithRelations.mockResolvedValue(
      channelWithRenderer(CHAT_CHANNEL_ID, CollectionRendererId.chat)
    );

    await deliver(CHAT_CHANNEL_ID);

    expect(mocks.showNotification).toHaveBeenCalledTimes(1);
    expect(mocks.showNotification.mock.calls[0][0]).toMatchObject({
      data: { channelId: CHAT_CHANNEL_ID },
    });
  });
});
