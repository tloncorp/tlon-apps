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
  refRegex: /NEVER_A_REFERENCE/ as RegExp,
  channels: [] as string[],
  getChannel: vi.fn<[{ id: string }], Promise<{ id: string } | null>>(),
  showToast: vi.fn(),
  jsonToInlines: vi.fn((_json: unknown) => []),
}));

vi.mock('@tloncorp/api', async () => {
  const {
    channelToContentReference,
    findBareChannelPaths,
    isReferenceBoundary,
    replaceBareChannelPath,
    toContentReference,
    uneditableCitesMessage,
  } = await import('@tloncorp/api/client/references');
  return {
    channelToContentReference,
    findBareChannelPaths,
    isReferenceBoundary,
    replaceBareChannelPath,
    toContentReference,
    uneditableCitesMessage,
  };
});
vi.mock('@tloncorp/api/urbit', async () => {
  const { pathToCite } = await import('@tloncorp/api/urbit/utils');
  return { pathToCite };
});
vi.mock('@tloncorp/shared', async () => ({
  ALL_MENTION_ID: 'all',
  extractContentTypesFromPost: (await import('@tloncorp/api/client/utils'))
    .extractContentTypesFromPost,
  get REF_REGEX() {
    return mocks.refRegex;
  },
  createDevLogger: () => ({ log: mocks.noop, error: mocks.noop }),
  useDebouncedValue: () => '',
  JSONToInlines: (json: unknown) => mocks.jsonToInlines(json),
  diaryMixedToJSON: () => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Edited post' }] },
    ],
  }),
}));
vi.mock('@tloncorp/shared/db', () => ({ getChannel: mocks.getChannel }));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useMentionCandidates: () => ({ data: [] }),
}));
vi.mock('@tloncorp/ui', () => ({
  HEADER_HEIGHT: 48,
  RawText: 'RawText',
  Text: 'Text',
  useGlobalSearch: () => ({ setIsOpen: mocks.noop }),
  useToast: () => mocks.showToast,
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
  mocks.refRegex = /NEVER_A_REFERENCE/;
  mocks.channels = [];
  mocks.getChannel.mockImplementation(async ({ id }) =>
    mocks.channels.includes(id) ? { id } : null
  );
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

// Native renders the controlled text as the input's decorated child.
function inputText() {
  return input().props.children.props.text;
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

test.each(['initial', 'reload'] as const)(
  'keeps a reference removed during a pending %s draft read removed',
  async (readKind) => {
    const storage = draftStorage();
    const draft = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Saved text ' }] },
      ],
      referenceAttachments: [reference],
    };
    await storage.storeDraft(draft);
    mocks.attachments = [reference];
    let finishRead!: (draft: JSONContent) => void;
    const delayedRead = () =>
      new Promise<JSONContent>((done) => {
        finishRead = done;
      });
    const getDraft = vi.fn(
      readKind === 'initial' ? delayedRead : storage.getDraft
    );
    const ref = React.createRef<React.ComponentRef<typeof BareChatInput>>();
    await mount({ ...storage, getDraft, ref });
    if (readKind === 'reload') {
      getDraft.mockImplementation(delayedRead);
      act(() => ref.current?.startDraft?.());
    }
    act(() => setAttachments([]));
    await act(async () => finishRead(draft));
    expect(mocks.attachments).toEqual([]);
    expect(await storage.getDraft()).toMatchObject({
      content: [{ content: [{ text: 'Saved text ' }] }],
      referenceAttachments: [],
    });
    act(() => renderer.unmount());
    await mount(storage);
    expect(mocks.attachments).toEqual([]);
  }
);

test.each([false, true])(
  'merges unrelated saved references when a new reference is added during hydration (then removed: %s)',
  async (removeNewReference) => {
    let finishRead!: (draft: JSONContent) => void;
    const storage = draftStorage();
    const getDraft = () =>
      new Promise<JSONContent>((done) => {
        finishRead = done;
      });
    await mount({ ...storage, getDraft });
    const added: Attachment = {
      ...reference,
      path: '/1/chan/chat/~zod/test/456',
    };
    act(() => {
      mocks.addAttachment(added);
    });
    if (removeNewReference) act(() => setAttachments([]));
    await act(async () =>
      finishRead({ referenceAttachments: [reference, added] })
    );
    expect(mocks.attachments).toEqual(
      removeNewReference ? [reference] : [added, reference]
    );
  }
);

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

test.each([false, true])(
  'leaving an edited reply does not replace the reply draft (existing draft: %s)',
  async (hasDraft) => {
    const storage = draftStorage();
    if (hasDraft) {
      await storage.storeDraft({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Unsent reply ' }],
          },
        ],
        referenceAttachments: [reference],
      });
    }
    await mount(storage);
    const saved = await storage.getDraft();
    const props = renderer.root.findByType(BareChatInput)
      .props as React.ComponentProps<typeof BareChatInput>;
    mocks.hydrateEditPost.mockReturnValue({
      story: [],
      attachments: [],
      isEmpty: false,
    });
    await act(async () =>
      renderer.update(
        <BareChatInput {...props} editingPost={makeEditingPost()} />
      )
    );
    act(() => input().props.onChangeText('Abandoned edit'));
    act(() => renderer.unmount());
    mocks.attachments = [];
    expect(await storage.getDraft()).toEqual(saved);
    await mount(storage);
    expect(await storage.getDraft()).toEqual(saved);
    expect(mocks.attachments).toEqual(hasDraft ? [reference] : []);
  }
);

test('sending invalidates an initial draft read before the clear finishes', async () => {
  mocks.platform = 'android';
  const storage = draftStorage();
  let resolveRead!: (draft: JSONContent) => void;
  let resolveClear!: () => Promise<void>;
  const getDraft = () =>
    new Promise<JSONContent>((done) => {
      resolveRead = done;
    });
  const clearDraft = () =>
    new Promise<void>((done) => {
      resolveClear = async () => {
        await storage.clearDraft();
        done();
      };
    });
  await mount({
    ...storage,
    getDraft,
    clearDraft,
    sendPostFromDraft: async () => {},
  });
  act(() => input().props.onChangeText('Send before hydration'));
  await act(async () => container().props.onPressSend());
  await act(async () => resolveRead({ referenceAttachments: [reference] }));
  expect(mocks.attachments).toEqual([]);
  await act(async () => resolveClear());
  expect(mocks.attachments).toEqual([]);
  act(() => renderer.unmount());
  await mount(storage);
  expect(mocks.attachments).toEqual([]);
  expect(container().props.disableSend).toBe(true);
});

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

const channelLinkAttachment = {
  type: 'reference',
  path: '/1/chan/chat/~zod/test',
  reference: {
    type: 'reference',
    referenceType: 'channelLink',
    channelId: 'chat/~zod/test',
  },
};

async function mountWithChannelPaths(
  channels = ['chat/~zod/test'],
  overrides: Partial<React.ComponentProps<typeof BareChatInput>> = {}
) {
  const { REF_REGEX } = await import('@tloncorp/api/client/utils');
  mocks.refRegex = REF_REGEX;
  mocks.channels = channels;
  await mount(overrides);
}

// Lets pending channel lookups resolve and apply.
async function settle() {
  await act(async () => {});
}

async function typeText(text: string) {
  for (let i = 1; i <= text.length; i++) {
    act(() => input().props.onChangeText(text.slice(0, i)));
    await settle();
  }
}

test('pasting a bare channel path attaches a channel link reference', async () => {
  await mountWithChannelPaths();
  act(() => input().props.onChangeText('/1/chan/chat/~zod/test'));
  await settle();

  expect(mocks.attachments).toEqual([channelLinkAttachment]);
  expect(inputText()).toBe('');
});

test('typing a path never converts at a channel that is its prefix', async () => {
  await mountWithChannelPaths(['chat/~zod/te', 'chat/~zod/test']);
  await typeText('/1/chan/chat/~zod/test');

  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe('/1/chan/chat/~zod/test');
});

test('a typed channel path converts once followed by a space', async () => {
  await mountWithChannelPaths(['chat/~zod/te', 'chat/~zod/test']);
  await typeText('see /1/chan/chat/~zod/test ');

  expect(mocks.attachments).toEqual([channelLinkAttachment]);
  expect(inputText()).toBe('see  ');
});

test('trailing punctuation stays out of the channel path', async () => {
  await mountWithChannelPaths();
  act(() => input().props.onChangeText('see /1/chan/chat/~zod/test.'));
  await settle();

  expect(mocks.attachments).toEqual([channelLinkAttachment]);
  expect(inputText()).toBe('see .');
});

test('a channel path naming an unknown channel stays text', async () => {
  await mountWithChannelPaths();
  act(() => input().props.onChangeText('/1/chan/chat/~zod/other '));
  await settle();

  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe('/1/chan/chat/~zod/other ');
});

test('an unknown channel is looked up once', async () => {
  await mountWithChannelPaths();
  act(() => input().props.onChangeText('/1/chan/chat/~zod/other '));
  await settle();
  act(() => input().props.onChangeText('/1/chan/chat/~zod/other hi'));
  await settle();

  expect(mocks.getChannel).toHaveBeenCalledTimes(1);
  expect(mocks.attachments).toEqual([]);
});

test('a channel path inside a URL stays text', async () => {
  await mountWithChannelPaths();
  act(() =>
    input().props.onChangeText('https://example.com/1/chan/chat/~zod/test ')
  );
  await settle();

  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe('https://example.com/1/chan/chat/~zod/test ');
});

test('a lookup that returns after the path was edited away does nothing', async () => {
  await mountWithChannelPaths();
  let finishLookup!: () => void;
  mocks.getChannel.mockImplementationOnce(
    ({ id }) =>
      new Promise((done) => {
        finishLookup = () => done({ id });
      })
  );
  act(() => input().props.onChangeText('/1/chan/chat/~zod/test '));
  act(() => input().props.onChangeText('/1/chan/chat/~zod/tes'));
  await act(async () => finishLookup());

  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe('/1/chan/chat/~zod/tes');
});

test('native keeps the text left around a converted path', async () => {
  await mountWithChannelPaths();
  vi.useFakeTimers();
  try {
    act(() => input().props.onChangeText('see /1/chan/chat/~zod/test '));
    await settle();
    act(() => {
      vi.runAllTimers();
    });
    act(() => frames.splice(0).forEach((callback) => callback(0)));

    expect(inputText()).toBe('see  ');
    expect(mocks.input.clear).not.toHaveBeenCalled();
    expect(mocks.input.setNativeProps).not.toHaveBeenCalled();
    expect(mocks.input.setSelection).toHaveBeenLastCalledWith(5, 5);
  } finally {
    vi.useRealTimers();
  }
});

test('native keeps the text and the card after a pasted reference, and the next keystroke does not attach it again', async () => {
  await mountWithChannelPaths();
  vi.useFakeTimers();
  try {
    act(() => input().props.onChangeText('see /1/group/~zod/test hi'));
    await settle();
    act(() => {
      vi.runAllTimers();
    });
    act(() => frames.splice(0).forEach((callback) => callback(0)));

    expect(inputText()).toBe('see  hi');
    expect(mocks.input.clear).not.toHaveBeenCalled();
    expect(mocks.input.setNativeProps).not.toHaveBeenCalled();
    expect(mocks.input.setSelection).toHaveBeenLastCalledWith(7, 7);

    act(() => input().props.onChangeText('see  hi!'));
    await settle();

    expect(mocks.addAttachment).toHaveBeenCalledTimes(1);
    expect(mocks.attachments).toHaveLength(1);
    expect(inputText()).toBe('see  hi!');
  } finally {
    vi.useRealTimers();
  }
});

test('native leaves text it could not convert alone', async () => {
  await mountWithChannelPaths();
  vi.useFakeTimers();
  try {
    act(() => input().props.onChangeText('/1/chan/chat/~zod/other '));
    await settle();
    act(() => {
      vi.runAllTimers();
    });

    expect(inputText()).toBe('/1/chan/chat/~zod/other ');
    expect(mocks.input.clear).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test('native clears its buffer when a converted path was all the text', async () => {
  await mountWithChannelPaths();
  vi.useFakeTimers();
  try {
    act(() => input().props.onChangeText('/1/chan/chat/~zod/test'));
    await settle();
    act(() => {
      vi.runAllTimers();
    });

    expect(mocks.input.clear).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test('sending leaves a channel path typed as the last word as text', async () => {
  mocks.platform = 'android';
  const sendPostFromDraft = vi.fn(async () => {});
  await mountWithChannelPaths(['chat/~zod/test'], {
    ...draftStorage(),
    sendPostFromDraft,
  });
  await typeText('see /1/chan/chat/~zod/test');

  await act(async () => container().props.onPressSend());

  expect(sendPostFromDraft).toHaveBeenCalledWith(
    expect.objectContaining({ attachments: [] }),
    expect.anything()
  );
  expect(JSON.stringify(mocks.jsonToInlines.mock.lastCall)).toContain(
    'see /1/chan/chat/~zod/test'
  );
  expect(mocks.getChannel).not.toHaveBeenCalledWith({ id: 'chat/~zod/test' });
});

test('a post path converts without a channel lookup', async () => {
  await mountWithChannelPaths([]);
  act(() =>
    input().props.onChangeText(
      '/1/chan/chat/~zod/other/msg/170141184506535164684262900635183087616'
    )
  );

  expect(mocks.attachments).toEqual([
    expect.objectContaining({
      reference: expect.objectContaining({
        referenceType: 'channel',
        channelId: 'chat/~zod/other',
      }),
    }),
  ]);
  expect(mocks.getChannel).not.toHaveBeenCalled();
});

test('a post path inside a URL stays text', async () => {
  await mountWithChannelPaths([]);
  const url =
    'https://example.com/1/chan/chat/~zod/other/msg/170141184506535164684262900635183087616';
  act(() => input().props.onChangeText(url));

  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe(url);
});

test('a post path is removed where it was found, not from a URL before it', async () => {
  await mountWithChannelPaths([]);
  const path =
    '/1/chan/chat/~zod/other/msg/170141184506535164684262900635183087616';
  act(() => input().props.onChangeText(`https://example.com${path} ${path}`));

  expect(mocks.attachments).toHaveLength(1);
  expect(inputText()).toBe(`https://example.com${path} `);
});

test('a post path after opening punctuation converts', async () => {
  await mountWithChannelPaths([]);
  act(() =>
    input().props.onChangeText(
      'see (/1/chan/chat/~zod/other/msg/170141184506535164684262900635183087616 x'
    )
  );

  expect(mocks.attachments).toHaveLength(1);
  expect(inputText()).toBe('see ( x');
});

test('a channel path after opening punctuation converts', async () => {
  await mountWithChannelPaths();
  act(() => input().props.onChangeText('see "/1/chan/chat/~zod/test" x'));
  await settle();

  expect(mocks.attachments).toEqual([channelLinkAttachment]);
  expect(inputText()).toBe('see "" x');
});

test('a channel path pasted before a mention keeps the mention', async () => {
  await mountWithChannelPaths();
  act(() => input().props.onChangeText('@Al'));
  act(() =>
    container().props.onSelectMention({
      id: 'all',
      title: 'All',
      type: 'group',
      priority: 8,
    })
  );
  const path = '/1/chan/chat/~zod/test';
  act(() => input().props.onChangeText(`${path} @All `));
  await settle();

  expect(mocks.attachments).toEqual([channelLinkAttachment]);
  expect(inputText()).toBe(' @All ');
  expect(input().props.children.props.mentions).toEqual([
    { id: 'all', display: '@All', start: 1, end: 5 },
  ]);
});

test.each([
  ['an unknown cite', { future: {} }, 'Upgrade your app to edit this post'],
  // Stored before this build parsed bare notes-channel cites, so the row
  // holds the raw cite rather than a reference the edit can rebuild.
  [
    'a cite stored unparsed',
    { chan: { nest: 'notes/~zod/notes', where: '/' } },
    "This post has a reference that can't be edited",
  ],
])(
  'saving an edit of a post with %s keeps the edit',
  async (_, cite, message) => {
    mocks.platform = 'android';
    mocks.hydrateEditPost.mockReturnValue({
      story: [],
      attachments: [],
      isEmpty: false,
    });
    const sendPostFromDraft = vi.fn(async () => {});
    const setEditingPost = vi.fn();
    await mount({
      ...draftStorage(),
      editingPost: {
        ...makeEditingPost(),
        content: JSON.stringify([{ block: { cite } }]),
      },
      setEditingPost,
      sendPostFromDraft,
    });
    expect(inputText()).toBe('Edited post');

    await act(async () => container().props.onPressEdit());

    expect(sendPostFromDraft).not.toHaveBeenCalled();
    expect(setEditingPost).not.toHaveBeenCalled();
    expect(mocks.clearAttachments).not.toHaveBeenCalled();
    expect(inputText()).toBe('Edited post');
    expect(container().props.sendError).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message })
    );
  }
);

test('a lookup that returns after the send leaves the composer empty', async () => {
  mocks.platform = 'android';
  const sendPostFromDraft = vi.fn(async () => {});
  await mountWithChannelPaths(['chat/~zod/test'], {
    ...draftStorage(),
    sendPostFromDraft,
  });
  let finishLookup!: () => void;
  mocks.getChannel.mockImplementationOnce(
    ({ id }) =>
      new Promise((done) => {
        finishLookup = () => done({ id });
      })
  );
  act(() => input().props.onChangeText('/1/chan/chat/~zod/test hello'));
  await act(async () => container().props.onPressSend());
  expect(sendPostFromDraft).toHaveBeenCalledWith(
    expect.objectContaining({ attachments: [] }),
    expect.anything()
  );

  await act(async () => finishLookup());

  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe('');
});

test('a typed channel path stays text beside a video', async () => {
  const video: Attachment = {
    type: 'video',
    localFile: 'file:///clip.mp4',
    size: 1000,
    mimeType: 'video/mp4',
    name: 'clip.mp4',
    width: 100,
    height: 100,
    duration: 1,
    posterUri: 'file:///poster.jpg',
  };
  mocks.attachments = [video];
  await mountWithChannelPaths();
  await typeText('see /1/chan/chat/~zod/test ');

  expect(mocks.attachments).toEqual([video]);
  expect(inputText()).toBe('see /1/chan/chat/~zod/test ');
});

test('a channel path stays text when the provider refuses the card', async () => {
  await mountWithChannelPaths();
  mocks.addAttachment.mockImplementationOnce(() => false);
  await typeText('see /1/chan/chat/~zod/test ');

  expect(mocks.addAttachment).toHaveBeenCalledTimes(1);
  expect(mocks.attachments).toEqual([]);
  expect(inputText()).toBe('see /1/chan/chat/~zod/test ');
});

test.each([
  ['before', 'see  hello'.length, 'see /1/chan/chat/~zod/test hello'.length],
  ['after', 3, 3],
])(
  'native keeps the caret where it was when a path %s it converts',
  async (_where, expected, caret) => {
    await mountWithChannelPaths();
    act(() =>
      input().props.onSelectionChange({
        nativeEvent: { selection: { start: caret, end: caret } },
      })
    );
    act(() => input().props.onChangeText('see /1/chan/chat/~zod/test hello'));
    await settle();
    act(() => frames.splice(0).forEach((callback) => callback(0)));

    expect(inputText()).toBe('see  hello');
    expect(mocks.input.setSelection).toHaveBeenLastCalledWith(
      expected,
      expected
    );
  }
);
