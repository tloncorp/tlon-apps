import type { JSONContent } from '@tloncorp/api/urbit';
import type { Attachment } from '@tloncorp/shared';
import type { Post } from '@tloncorp/shared/db';
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
    clear: vi.fn(),
  },
  attachments: [] as Attachment[],
  attachmentListeners: new Set<() => void>(),
  addAttachment: vi.fn((attachment: Attachment) => {
    setAttachments([...mocks.attachments, attachment]);
    return true;
  }),
  resetAttachments: vi.fn((attachments: Attachment[]) =>
    setAttachments(attachments)
  ),
  clearAttachments: vi.fn(() => setAttachments([])),
  hydrateEditPost: vi.fn(),
  noop: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({}));
vi.mock('@tloncorp/api/urbit', () => ({}));
vi.mock('@tloncorp/shared', () => ({
  ALL_MENTION_ID: 'all',
  REF_REGEX: /NEVER_A_REFERENCE/,
  createDevLogger: () => ({ log: mocks.noop, error: mocks.noop }),
  useDebouncedValue: () => '',
  JSONToInlines: () => [],
  diaryMixedToJSON: () => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Edited post' }] },
    ],
  }),
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useMentionCandidates: () => ({ data: [] }),
}));
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
  TextInput: 'TextInput',
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
  useWindowDimensions: () => ({ height: 800, fontScale: 1 }),
}));
vi.mock('../../contexts/attachment', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAttachmentContext: () => ({
      attachments: useSyncExternalStore(
        (listener) => {
          mocks.attachmentListeners.add(listener);
          return () => mocks.attachmentListeners.delete(listener);
        },
        () => mocks.attachments
      ),
      addAttachment: mocks.addAttachment,
      clearAttachments: mocks.clearAttachments,
      resetAttachments: mocks.resetAttachments,
      removeAttachment: mocks.noop,
    }),
  };
});
vi.mock('../../contexts/scroll', () => ({
  useConversationComposerHeight: () => ({
    beginSend: mocks.noop,
    finishSend: mocks.noop,
    isSendCoordinated: () => false,
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
vi.mock('../MessageInput/helpers', () => ({
  hydrateEditPost: mocks.hydrateEditPost,
}));
vi.mock('./PasteableTextInput', () => ({
  PasteableTextInput: 'PasteableTextInput',
}));
vi.mock('./pastedImage', () => ({}));
vi.mock('./helpers', async () => {
  const { textAndMentionsToContent, contentToTextAndMentions } =
    await import('@tloncorp/api/client/content-helpers');
  return { textAndMentionsToContent, contentToTextAndMentions };
});

let renderer: ReactTestRenderer;
let frames: FrameRequestCallback[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.attachments = [];
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

function setAttachments(attachments: Attachment[]) {
  mocks.attachments = attachments;
  mocks.attachmentListeners.forEach((listener) => listener());
}

async function mount(
  overrides: Partial<React.ComponentProps<typeof BareChatInput>> = {}
) {
  await act(async () => {
    renderer = create(
      <BareChatInput
        channelId="chat"
        channelType="chat"
        groupMembers={[]}
        groupRoles={[]}
        shouldBlur={false}
        setShouldBlur={mocks.noop}
        sendPostFromDraft={mocks.noop}
        getDraft={async () => null}
        storeDraft={mocks.noop}
        clearDraft={mocks.noop}
        {...overrides}
      />,
      { createNodeMock: () => mocks.input }
    );
  });
}

const reference: Attachment = {
  type: 'reference',
  path: '/1/chan/chat/~zod/test/123',
  reference: {
    type: 'reference',
    referenceType: 'channel',
    channelId: 'chat/~zod/test',
    postId: '123',
  },
};

function draftStorage() {
  let saved: JSONContent | null = null;
  return {
    getDraft: vi.fn(async () => saved),
    storeDraft: vi.fn(async (draft: JSONContent) => {
      saved = JSON.parse(JSON.stringify(draft));
    }),
    clearDraft: vi.fn(async () => {
      saved = null;
    }),
  };
}

test.each(['ios', 'android'])(
  '%s: restores text and reference previews after visiting another conversation',
  async (platform) => {
    mocks.platform = platform;
    const first = draftStorage();
    const second = draftStorage();
    await mount(first);
    act(() => input().props.onChangeText('Unsent message'));
    act(() => {
      mocks.addAttachment(reference);
    });
    act(() => renderer.unmount());
    mocks.attachments = [];

    await mount(second);
    expect(mocks.attachments).toEqual([]);
    act(() => input().props.onChangeText('Another draft'));
    act(() => renderer.unmount());
    mocks.attachments = [];

    await mount(first);
    expect(mocks.attachments).toEqual([reference]);
    expect(await first.getDraft()).toMatchObject({
      content: [{ content: [{ text: 'Unsent message ' }] }],
      referenceAttachments: [reference],
    });
    expect(container().props.disableSend).toBe(false);
  }
);

test('restores a reference-only draft and keeps a removed reference removed', async () => {
  const storage = draftStorage();
  await mount(storage);
  act(() => {
    mocks.addAttachment(reference);
  });
  act(() => renderer.unmount());
  mocks.attachments = [];
  await mount(storage);
  expect(mocks.attachments).toEqual([reference]);
  expect(container().props.disableSend).toBe(false);

  act(() => setAttachments([]));
  act(() => renderer.unmount());
  await mount(storage);
  expect(mocks.attachments).toEqual([]);
  expect(container().props.disableSend).toBe(true);
});

test('does not overwrite a saved draft while its initial read is pending', async () => {
  let resolve!: (draft: JSONContent) => void;
  const storeDraft = vi.fn();
  const getDraft = () =>
    new Promise<JSONContent>((done) => {
      resolve = done;
    });
  await mount({ getDraft, storeDraft });
  expect(storeDraft).not.toHaveBeenCalled();
  await act(async () => resolve({ referenceAttachments: [reference] }));
  expect(mocks.attachments).toEqual([reference]);
  expect(storeDraft).toHaveBeenLastCalledWith({
    referenceAttachments: [reference],
  });
});

test('keeps text typed while the initial draft read is pending', async () => {
  let resolve!: (draft: JSONContent | null) => void;
  const storage = draftStorage();
  const getDraft = () =>
    new Promise<JSONContent | null>((done) => {
      resolve = done;
    });
  await mount({ ...storage, getDraft });
  act(() => input().props.onChangeText('Already typing'));
  await act(async () => resolve(null));
  expect(await storage.getDraft()).toMatchObject({
    content: [{ content: [{ text: 'Already typing ' }] }],
  });
});

test('loads an edited message after opening an empty conversation', async () => {
  const storage = draftStorage();
  await mount(storage);
  mocks.hydrateEditPost.mockReturnValue({
    story: [],
    attachments: [reference],
    isEmpty: false,
  });
  const props = renderer.root.findByType(BareChatInput)
    .props as React.ComponentProps<typeof BareChatInput>;
  const editingPost = makeEditingPost();
  await act(async () =>
    renderer.update(<BareChatInput {...props} editingPost={editingPost} />)
  );
  expect(mocks.hydrateEditPost).toHaveBeenCalledWith(
    editingPost,
    'references-media'
  );
  expect(mocks.attachments).toEqual([reference]);
  expect(container().props.disableSend).toBe(false);
});

function makeEditingPost(): Post {
  return {
    id: 'edited',
    content: '[]',
    authorId: '~zod',
    channelId: 'chat',
    receivedAt: 0,
    sentAt: 0,
    type: 'chat',
  };
}

test('keeps changes made and abandoned before the initial read completes', async () => {
  let resolve!: (draft: JSONContent | null) => void;
  const storage = draftStorage();
  const getDraft = () =>
    new Promise<JSONContent | null>((done) => {
      resolve = done;
    });
  await mount({ ...storage, getDraft });
  act(() => {
    input().props.onChangeText('Quick draft');
    mocks.addAttachment(reference);
  });
  act(() => renderer.unmount());
  await act(async () => resolve(null));
  mocks.attachments = [];
  await mount(storage);
  expect(mocks.attachments).toEqual([reference]);
  expect(await storage.getDraft()).toMatchObject({
    content: [{ content: [{ text: 'Quick draft ' }] }],
  });
});

test('completing an edit does not restore references while storage is clearing', async () => {
  mocks.hydrateEditPost.mockReturnValue({
    story: [],
    attachments: [reference],
    isEmpty: false,
  });
  const storage = draftStorage();
  let resolveClear!: () => Promise<void>;
  const clearDraft = () =>
    new Promise<void>((done) => {
      resolveClear = async () => {
        await storage.clearDraft();
        done();
      };
    });
  let props: React.ComponentProps<typeof BareChatInput>;
  const setEditingPost = (editingPost: Post | undefined) => {
    renderer.update(<BareChatInput {...props} editingPost={editingPost} />);
  };
  await mount({
    ...storage,
    clearDraft,
    editingPost: makeEditingPost(),
    setEditingPost,
    sendPostFromDraft: async () => {},
  });
  props = renderer.root.findByType(BareChatInput).props as React.ComponentProps<
    typeof BareChatInput
  >;
  await act(async () => {
    container().props.onPressEdit();
  });
  await act(async () => {
    await resolveClear();
  });
  expect(mocks.attachments).toEqual([]);
  expect(container().props.disableSend).toBe(true);
});

test('ignores an initial draft read that completes after leaving the conversation', async () => {
  let resolve!: (draft: JSONContent) => void;
  const getDraft = () =>
    new Promise<JSONContent>((done) => {
      resolve = done;
    });
  await mount({ getDraft });
  act(() => renderer.unmount());
  await mount(draftStorage());
  await act(async () => resolve({ referenceAttachments: [reference] }));
  expect(mocks.attachments).toEqual([]);
});

test('sending includes the restored reference and clears it from the next draft', async () => {
  const storage = draftStorage();
  await storage.storeDraft({ referenceAttachments: [reference] });
  const sendPostFromDraft = vi.fn(async () => {});
  await mount({ ...storage, sendPostFromDraft });
  await act(async () => container().props.onPressSend());
  expect(sendPostFromDraft).toHaveBeenCalledWith(
    expect.objectContaining({ attachments: [reference] }),
    expect.anything()
  );
  act(() => renderer.unmount());
  mocks.attachments = [];
  await mount(storage);
  expect(mocks.attachments).toEqual([]);
  expect(container().props.disableSend).toBe(true);
});

test('finishing a send leaves the next draft and its mentions intact', async () => {
  const storage = draftStorage();
  let finishSend!: () => void;
  const sendPostFromDraft = () =>
    new Promise<void>((done) => {
      finishSend = done;
    });
  await mount({ ...storage, sendPostFromDraft });
  act(() => input().props.onChangeText('First message'));
  await act(async () => {
    container().props.onPressSend();
  });
  act(() => input().props.onChangeText('~jam'));
  act(() =>
    container().props.onSelectMention({
      id: '~sampel-palnet',
      title: 'James M',
      type: 'contact',
      priority: 1,
    })
  );
  act(() => {
    mocks.addAttachment(reference);
  });
  const nextDraft = await storage.getDraft();
  expect(nextDraft).toMatchObject({
    content: [
      {
        content: [
          expect.objectContaining({
            type: 'mention',
            attrs: { id: '~sampel-palnet' },
          }),
        ],
      },
    ],
    referenceAttachments: [reference],
  });
  await act(async () => finishSend());
  expect(await storage.getDraft()).toEqual(nextDraft);
});

test('supports existing text-only drafts', async () => {
  const storage = draftStorage();
  await storage.storeDraft({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Old draft' }] },
    ],
  });
  await mount(storage);
  expect(container().props.disableSend).toBe(false);
  expect(mocks.attachments).toEqual([]);
});

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
