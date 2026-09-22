import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import BareChatInput from './index';

const mocks = vi.hoisted(() => ({
  platform: 'ios',
  input: {
    focus: vi.fn(),
    setSelection: vi.fn(),
    setNativeProps: vi.fn(),
  },
  attachments: [],
  noop: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({}));
vi.mock('@tloncorp/api/urbit', () => ({}));
vi.mock('@tloncorp/shared', () => ({
  ALL_MENTION_ID: 'all',
  REF_REGEX: /NEVER_A_REFERENCE/,
  createDevLogger: () => ({ log: mocks.noop, error: mocks.noop }),
  useDebouncedValue: () => '',
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@tloncorp/ui', () => ({
  HEADER_HEIGHT: 48,
  RawText: 'RawText',
  Text: 'Text',
  useGlobalSearch: () => ({ setIsOpen: mocks.noop }),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
  Keyboard: { dismiss: mocks.noop },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0 }),
}));
vi.mock('tamagui', () => ({
  View: 'View',
  YStack: 'YStack',
  isWeb: false,
  getFontSize: () => 16,
  getTokenValue: () => 8,
  getVariableValue: (value: unknown) => value,
  useTheme: () => ({ primaryText: '#000', secondaryText: '#999' }),
  useWindowDimensions: () => ({ height: 800 }),
}));
vi.mock('../../contexts/attachment', () => ({
  useAttachmentContext: () => ({
    attachments: mocks.attachments,
    addAttachment: mocks.noop,
    clearAttachments: mocks.noop,
    resetAttachments: mocks.noop,
    removeAttachment: mocks.noop,
  }),
}));
vi.mock('../../hooks/useKeyboardHeight', () => ({
  useKeyboardHeight: () => 0,
}));
vi.mock('../../utils', () => ({ formatUserId: mocks.noop }));
vi.mock('../../utils/videoPreviewData', () => ({}));
vi.mock('../MentionPopup', () => ({}));
vi.mock('../MessageInput', () => ({ DEFAULT_MESSAGE_INPUT_HEIGHT: 44 }));
vi.mock('../MessageInput/AttachmentPreviewList', () => ({}));
vi.mock('../MessageInput/MessageInputBase', () => ({
  MessageInputContainer: 'MessageInputContainer',
}));
vi.mock('../MessageInput/helpers', () => ({}));
vi.mock('./PasteableTextInput', () => ({
  PasteableTextInput: 'PasteableTextInput',
}));
vi.mock('./pastedImage', () => ({}));
vi.mock('./helpers', () => ({ textAndMentionsToContent: mocks.noop }));

let renderer: ReactTestRenderer;
let frames: FrameRequestCallback[];

beforeEach(() => {
  vi.clearAllMocks();
  frames = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

function input() {
  return renderer.root.findByType('PasteableTextInput' as React.ElementType);
}

function container() {
  return renderer.root.findByType('MessageInputContainer' as React.ElementType);
}

async function mount() {
  await act(async () => {
    renderer = create(
      <BareChatInput
        {...({
          channelId: 'chat',
          groupRoles: [],
          getDraft: async () => null,
          storeDraft: mocks.noop,
          setShouldBlur: mocks.noop,
        } as React.ComponentProps<typeof BareChatInput>)}
      />,
      { createNodeMock: () => mocks.input }
    );
  });
}

test.each(['ios', 'android'])(
  '%s: select a mention, then continue typing',
  async (platform) => {
    mocks.platform = platform;
    await mount();
    act(() => input().props.onChangeText('~jam'));
    act(() =>
      container().props.onSelectMention({
        id: '~sampel-palnet',
        title: 'James M',
        type: 'contact',
        priority: 1,
      })
    );

    expect(container().props.isMentionModeActive).toBe(false);
    expect(mocks.input.setSelection).not.toHaveBeenCalled();
    act(() => frames.splice(0).forEach((callback) => callback(0)));
    const end = '@James M '.length;
    expect(mocks.input.setSelection).toHaveBeenCalledWith(end, end);
    expect(mocks.input.setNativeProps).not.toHaveBeenCalled();

    // Native reports the resulting text after space and continued typing.
    act(() => input().props.onChangeText('@James M  hello'));
    expect(container().props.isMentionModeActive).toBe(false);
    expect(
      renderer.root.findByProps({ testID: 'SelectedMention-~sampel-palnet' })
        .props.children
    ).toBe('@James M');
  }
);

test.each(['ios', 'android'])(
  '%s: slash commands also place the caret after the separator',
  async (platform) => {
    mocks.platform = platform;
    await mount();
    act(() => input().props.onChangeText('/sta'));
    act(() =>
      container().props.onSelectSlashCommand({
        command: '/status',
        title: 'Status',
        priority: 1,
      })
    );
    act(() => frames.splice(0).forEach((callback) => callback(0)));
    expect(mocks.input.setSelection).toHaveBeenCalledWith(8, 8);
    expect(mocks.input.setNativeProps).not.toHaveBeenCalled();
  }
);
