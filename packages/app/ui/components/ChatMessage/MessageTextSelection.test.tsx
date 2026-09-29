import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useMessageActionModel } from './ChatMessageActions/MessageActions';
import { MessageTextSelectionProvider } from './MessageTextSelectionSheet';

vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
});

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  copy: vi.fn(async () => {}),
  copiedText: '',
  toast: vi.fn(),
  channel: { id: 'chat', type: 'chat' },
}));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  TextInput: 'TextInput',
  Alert: {},
}));
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Text: 'Text',
  Pressable: 'Pressable',
  useCopy: (text: string) => {
    mocks.copiedText = text;
    return { doCopy: mocks.copy };
  },
  useToast: () => mocks.toast,
}));
vi.mock('tamagui', () => ({
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: false,
  useTheme: () => ({ primaryText: { val: '#000' } }),
}));
vi.mock('../ActionSheet', () => ({
  ActionSheet: Object.assign(
    (props: React.PropsWithChildren) =>
      React.createElement('ActionSheet', props),
    {
      ScrollableContent: 'ScrollableContent',
    }
  ),
}));
vi.mock('../Avatar', () => ({ ContactAvatar: 'ContactAvatar' }));
vi.mock('../ContactNameV2', () => ({ ContactName: 'ContactName' }));
vi.mock('../SentTimeText', () => ({ SentTimeText: 'SentTimeText' }));
vi.mock('@tloncorp/shared', () => ({
  ChannelAction: { staticSpecForId: () => ({}) },
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/logic', () => ({
  getPinnedPostId: () => null,
  isMuted: () => false,
}));
vi.mock('@tloncorp/shared/store', () => ({
  useConnectionStatus: () => 'Disconnected',
  useContextLensBotShips: () => ({ data: [] }),
}));
vi.mock('expo-clipboard', () => ({}));
vi.mock('../../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~zod',
}));
vi.mock('../../contexts/attachment', () => ({
  useAttachmentContext: () => ({}),
}));
vi.mock('../../contexts/channel', () => ({
  useChannelContext: () => mocks.channel,
}));
vi.mock('../../utils', () => ({
  useIsAdmin: () => false,
  triggerHaptic: vi.fn(),
}));
vi.mock('../ActionList', () => ({ default: 'ActionList' }));
vi.mock('../Channel/ContextLens/lensPost', () => ({
  getOwnContextLensStamp: () => null,
}));
vi.mock('../Channel/ContextLens/useContextLensStore', () => ({
  useContextLensAvailable: () => false,
}));
vi.mock('../ForwardPostSheet', () => ({ useForwardPostSheet: () => ({}) }));
vi.mock('../draftInputs/shared', () => ({ useDraftInputContext: () => null }));

const post = {
  id: 'message-1',
  authorId: '~nec',
  channelId: 'chat',
  sentAt: 100,
  content: [
    { inline: ['First paragraph 🙏'] },
    { inline: ['Second paragraph'] },
  ],
  textContent: 'First paragraph 🙏 Second paragraph',
} as db.Post;
let model: ReturnType<typeof useMessageActionModel>;
let renderer: ReactTestRenderer;
const afterDismiss = vi.fn((action: () => void) => action());
function Menu({ message = post }: { message?: db.Post }) {
  const currentModel = useMessageActionModel({
    post: message,
    postActionIds: ['copyText', 'copyRef'],
    dismiss: vi.fn(),
    runAfterDismiss: afterDismiss,
  });
  React.useEffect(() => {
    model = currentModel;
  }, [currentModel]);
  return null;
}
function renderMenu(message = post, withProvider = true) {
  act(() => {
    renderer = create(
      withProvider ? (
        <MessageTextSelectionProvider>
          <Menu message={message} />
        </MessageTextSelectionProvider>
      ) : (
        <Menu message={message} />
      )
    );
  });
}
function sheet() {
  return renderer.root.findByType('ActionSheet' as never);
}
function openSheet() {
  act(() => model.performAction('selectText'));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, __DEV__: false });
  vi.useFakeTimers();
  mocks.platform.OS = 'ios';
  mocks.copy.mockClear();
  mocks.toast.mockClear();
  afterDismiss.mockClear();
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.useRealTimers();
});

test('offers selection beside copy while offline and opens it after menu dismissal', () => {
  renderMenu();
  expect(model.actions.map((action) => action.id)).toEqual([
    'copyText',
    'selectText',
    'copyRef',
  ]);
  openSheet();
  expect(afterDismiss).toHaveBeenCalledOnce();
  expect(sheet().props.open).toBe(true);
  expect(sheet().props.mode).toBe('sheet');
  expect(sheet().props.enableContentPanningGesture).toBe(false);
  const text = renderer.root.findByType('TextInput' as never);
  expect(text.props.value).toBe('First paragraph 🙏\nSecond paragraph');
  expect(text.props.editable).toBe(false);
  expect(text.props.showSoftInputOnFocus).toBe(false);
});

test('uses native selectable text on Android', () => {
  mocks.platform.OS = 'android';
  renderMenu();
  openSheet();
  const text = renderer.root.findByProps({ testID: 'SelectableMessageText' });
  expect(text.type).toBe('Text');
  expect(text.props.selectable).toBe(true);
});

test('copy all copies the displayed text, closes the sheet, and confirms success', async () => {
  renderMenu();
  openSheet();
  await act(async () => {
    await renderer.root
      .findByProps({ testID: 'CopyAllMessageText' })
      .props.onPress();
  });
  expect(mocks.copiedText).toBe('First paragraph 🙏\nSecond paragraph');
  expect(mocks.copy).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith({ message: 'Copied text' });
  expect(sheet().props.open).toBe(false);
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(renderer.root.findAllByType('ActionSheet' as never)).toHaveLength(0);
});

test('a quick reopen cancels cleanup from the previous dismissal', () => {
  renderMenu();
  openSheet();
  act(() => sheet().props.onOpenChange(false));
  openSheet();
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(sheet().props.open).toBe(true);
});

test('rejects an action token from a message edited while the menu was open', () => {
  renderMenu();
  const token = model.actions.find(
    (action) => action.id === 'selectText'
  )!.token;
  act(() =>
    renderer.update(
      <MessageTextSelectionProvider>
        <Menu message={{ ...post, content: [{ inline: ['Edited'] }] }} />
      </MessageTextSelectionProvider>
    )
  );
  act(() => model.performAction('selectText', token));
  expect(afterDismiss).not.toHaveBeenCalled();
});

test('does not add an unavailable action to desktop menus', () => {
  renderMenu(post, false);
  expect(model.actions.map((action) => action.id)).not.toContain('selectText');
});

test('does not offer selection for a message containing only an image', () => {
  renderMenu({
    ...post,
    content: [
      {
        block: {
          image: {
            src: 'https://example.com/a.png',
            alt: '',
            width: 10,
            height: 10,
          },
        },
      },
    ],
  });
  expect(model.actions.map((action) => action.id)).not.toContain('selectText');
});
