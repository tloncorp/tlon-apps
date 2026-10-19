import type { JSONContent } from '@tloncorp/api/urbit';
import type { Attachment } from '@tloncorp/shared';
import type { Channel, Post } from '@tloncorp/shared/db';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import BareChatInput from './index';
import {
  PostScreenView,
  PresentationalCarouselPostScreenContent,
} from '../PostScreenView';
import {
  AttachmentProvider,
  AttachmentDraftsProvider,
  useAttachmentContext,
} from '../../contexts/attachment';

const mocks = vi.hoisted(() => ({
  platform: 'ios',
  isWeb: false,
  realFileDrop: false,
  isWindowNarrow: true,
  uploadSubscriptions: 0,
  input: {
    focus: vi.fn(),
    setSelection: vi.fn(),
    setNativeProps: vi.fn(),
    clear: vi.fn(),
  },
  drafts: new Map<string, JSONContent>(),
  uploadStates: {},
  visiblePostIds: null as string[] | null,
  deferredRead: null as null | ((key: string) => Promise<JSONContent | null>),
  finalizeAndSendPost: vi.fn(async () => {}),
  hydrateEditPost: vi.fn(),
  transcribe: vi.fn(async () => null as string | null),
  imageSize: vi.fn(async () => [10, 10]),
  noop: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  findBareChannelPaths: () => [],
  getUneditableCites: () => [],
}));
vi.mock('@tloncorp/api/urbit', () => ({ getChannelType: () => 'notebook' }));
vi.mock('@tloncorp/shared', async () => ({
  Attachment: (await import('@tloncorp/api/types/attachment')).Attachment,
  configurationFromChannel: () => ({}),
  isChatChannel: () => false,
  hasUnreadActivity: () => false,
  makePrettyDayAndTime: () => ({ asString: '' }),
  ALL_MENTION_ID: 'all',
  REF_REGEX: /NEVER_A_REFERENCE/,
  createDevLogger: () => ({ log: mocks.noop, error: mocks.noop }),
  extractContentTypesFromPost: () => ({ story: [] }),
  getMd5: (uri: string) => uri,
  Transcription: {
    setupTranscriptionIfNeeded: async () => ({ canTranscribe: true }),
    transcribeAudioFileWithGlobalCache: mocks.transcribe,
  },
  useDebouncedValue: (value: unknown, delay: number) =>
    delay === 10 ? value : '',
  JSONToInlines: () => [],
  diaryMixedToJSON: () => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Edited post' }] },
    ],
  }),
}));
vi.mock('@tloncorp/shared/db', () => ({
  getThreadUnreadState: async () => null,
}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useMentionCandidates: () => ({ data: [] }),
  usePostDraftCallbacks: ({ draftKey }: { draftKey: string }) =>
    React.useMemo(
      () => ({
        getDraft: async () =>
          mocks.deferredRead
            ? mocks.deferredRead(draftKey)
            : (mocks.drafts.get(draftKey) ?? null),
        storeDraft: async (draft: JSONContent) => {
          mocks.drafts.set(draftKey, structuredClone(draft));
        },
        clearDraft: async () => {
          mocks.drafts.delete(draftKey);
        },
      }),
      [draftKey]
    ),
  draftKeyFor: {
    thread: ({ parentPostId }: { parentPostId: string }) => parentPostId,
    postEdit: ({ postId }: { postId: string }) => `edit-${postId}`,
  },
  useChannelPosts: () => ({
    posts,
    query: { fetchNextPage: mocks.noop, fetchPreviousPage: mocks.noop },
  }),
  useChannel: () => ({ data: channel }),
  useThreadPosts: () => ({ data: [], isLoading: false }),
  useLiveThreadUnreadByParentId: () => ({ data: null }),
  useShowDeleteMarkers: () => ({ data: false }),
  useThreadCatchupTelemetry: () => {},
  useUploadStates: () => {
    React.useEffect(() => {
      mocks.uploadSubscriptions += 1;
      return () => {
        mocks.uploadSubscriptions -= 1;
      };
    }, []);
    return mocks.uploadStates;
  },
  uploadAsset: vi.fn(async () => {}),
  waitForUploads: async () => ({}),
  finalizeAndSendPost: mocks.finalizeAndSendPost,
}));
vi.mock('@tloncorp/ui', () => ({
  Carousel: Object.assign(
    ({ children, ...props }: React.PropsWithChildren) =>
      React.createElement(
        'Carousel',
        props,
        React.Children.toArray(children).filter(
          (child) =>
            mocks.visiblePostIds === null ||
            mocks.visiblePostIds.includes(
              (child as React.ReactElement<{ parentPost: Post }>).props
                .parentPost.id
            )
        )
      ),
    { Item: 'CarouselItem' }
  ),
  HEADER_HEIGHT: 48,
  RawText: 'RawText',
  Text: 'Text',
  useGlobalSearch: () => ({ setIsOpen: mocks.noop }),
  useToast: () => mocks.noop,
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
  AppState: { currentState: 'active' },
  Alert: { alert: mocks.noop },
  Keyboard: { dismiss: mocks.noop },
  TextInput: 'TextInput',
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0 }),
}));
vi.mock('tamagui', () => ({
  View: 'View',
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  get isWeb() {
    return mocks.isWeb;
  },
  getFontSize: () => 16,
  getTokenValue: () => 8,
  getVariableValue: (value: unknown) => value,
  useTheme: () => ({ primaryText: '#000', secondaryText: '#999' }),
  useWindowDimensions: () => ({ height: 800, fontScale: 1 }),
}));
vi.mock('../../contexts/scroll', () => ({
  ScrollContextProvider: ({ children }: React.PropsWithChildren) => children,
  useConversationComposerHeight: () => ({
    beginSend: mocks.noop,
    finishSend: mocks.noop,
    isSendCoordinated: () => false,
  }),
}));
vi.mock('../../hooks/useKeyboardHeight', () => ({
  useKeyboardHeight: () => 0,
}));
vi.mock('../../utils', () => ({
  formatUserId: mocks.noop,
  useCanWrite: () => true,
  useIsWindowNarrow: () => mocks.isWindowNarrow,
  useIsAdmin: () => false,
  useChatTitle: () => '',
}));
vi.mock('../../utils/videoPreviewData', () => ({}));
vi.mock('../MentionPopup', () => ({}));
vi.mock('../MessageInput', () => ({ DEFAULT_MESSAGE_INPUT_HEIGHT: 44 }));
vi.mock('../MessageInput/AttachmentPreviewList', () => ({
  AttachmentPreviewList: 'AttachmentPreviewList',
}));
vi.mock('../MessageInput/MessageInputBase', () => ({
  MessageInputContainer: 'MessageInputContainer',
}));
vi.mock('../MessageInput/helpers', () => ({
  hydrateEditPost: mocks.hydrateEditPost,
}));
vi.mock('./PasteableTextInput', () => ({
  PasteableTextInput: 'PasteableTextInput',
}));
vi.mock('../../../utils/images', () => ({ imageSize: mocks.imageSize }));
vi.mock('./helpers', async () => {
  const { textAndMentionsToContent, contentToTextAndMentions } =
    await import('@tloncorp/api/client/content-helpers');
  return { textAndMentionsToContent, contentToTextAndMentions };
});

vi.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
vi.mock('../../../hooks/useAppStatus', () => ({ default: () => 'active' }));
vi.mock('../../../hooks/useUserActivity', () => ({
  useIsUserActive: () => true,
}));
vi.mock('../../../hooks/useChannelNavigation', () => ({
  useChannelNavigation: () => ({ navigateToRef: mocks.noop }),
}));
vi.mock('../../../navigation/utils', () => ({
  useRootNavigation: () => ({ navigateToChannel: mocks.noop }),
}));
vi.mock('../../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~zod',
}));
vi.mock('../../contexts/channel', () => ({
  ChannelProvider: ({ children }: React.PropsWithChildren) => children,
}));
vi.mock('../../contexts/navigation', () => ({
  NavigationProvider: ({ children }: React.PropsWithChildren) => children,
}));
vi.mock('../BigInput', () => ({ BigInput: 'BigInput' }));
vi.mock('../Channel/ChannelHeader', () => ({
  ChannelHeader: 'ChannelHeader',
  ChannelHeaderItemsProvider: ({ children }: React.PropsWithChildren) =>
    children,
}));
vi.mock('../Channel/ContextLens', () => ({
  useContextLensController: () => ({ contextLensAvailable: false }),
}));
vi.mock('../Channel/DraftInputView', () => ({
  ConversationComposerPlacement: 'ComposerPlacement',
}));
vi.mock('../Channel/ConversationLayout', () => ({
  ConversationLayout: 'ConversationLayout',
}));
vi.mock('../Channel/Scroller', () => ({}));
vi.mock('react-dropzone', () => ({
  useDropzone: ({
    onDrop,
    noDrag,
  }: {
    onDrop: (files: File[]) => void;
    noDrag: boolean;
  }) => ({
    getRootProps: () => ({ onDropFiles: onDrop, dropDisabled: noDrag }),
    getInputProps: () => ({}),
  }),
}));
vi.mock('../FileDrop', async () => {
  const { FileDrop } = await import('../FileDrop/FileDrop');
  return {
    FileDrop: (props: React.ComponentProps<typeof FileDrop>) =>
      React.createElement(mocks.realFileDrop ? FileDrop : 'FileDrop', props),
  };
});
vi.mock('../GroupPreviewSheet', () => ({
  GroupPreviewSheet: 'GroupPreviewSheet',
}));
vi.mock('../conversationScrollChrome', () => ({
  useConversationInsets: () => ({}),
}));
vi.mock('../DetailView', () => ({
  DetailView: ({ post }: { post: Post }) =>
    React.createElement('DetailView', {
      postId: post.id,
      attachments: useAttachmentContext(),
    }),
}));

let renderer: ReactTestRenderer;
const posts = ['first', 'second'].map((id) => ({
  id,
  channelId: 'gallery',
  authorId: '~zod',
  receivedAt: 0,
  sentAt: 0,
  type: 'chat',
})) as Post[];
const channel = { id: 'gallery', type: 'gallery' } as Channel;
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
const otherReference: Attachment = {
  ...reference,
  path: '/1/chan/chat/~zod/test/456',
  reference: {
    type: 'reference',
    referenceType: 'channel',
    channelId: 'chat/~zod/test',
    postId: '456',
  },
};
const uploadAsset = vi.fn(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.drafts.clear();
  mocks.visiblePostIds = null;
  mocks.isWeb = false;
  mocks.realFileDrop = false;
  mocks.isWindowNarrow = true;
  mocks.deferredRead = null;
  uploadAsset.mockImplementation(async () => {});
  mocks.transcribe.mockImplementation(async () => null);
  mocks.imageSize.mockImplementation(async () => [10, 10]);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', mocks.noop);
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mountCarousel(editingPost?: Post) {
  await act(async () => {
    renderer = create(carouselScreen(editingPost), {
      createNodeMock: () => mocks.input,
    });
  });
}

function carouselScreen(editingPost?: Post, showCarousel = true) {
  return (
    <AttachmentProvider canUpload uploadAsset={uploadAsset}>
      <AttachmentDraftsProvider canUpload uploadAsset={uploadAsset}>
        {showCarousel && (
          <PresentationalCarouselPostScreenContent
            posts={posts}
            channel={channel}
            fetchNewerPage={mocks.noop}
            fetchOlderPage={mocks.noop}
            channelContext={{
              group: null,
              editingPost,
              negotiationMatch: true,
              onPressDelete: mocks.noop,
            }}
          />
        )}
      </AttachmentDraftsProvider>
    </AttachmentProvider>
  );
}
function attachmentState(
  index: number
): ReturnType<typeof useAttachmentContext> {
  return renderer.root.findAllByType('DetailView' as React.ElementType)[index]
    .props.attachments;
}
function composer(index: number) {
  return renderer.root.findAllByType(
    'MessageInputContainer' as React.ElementType
  )[index];
}

test('adding a reference affects only its carousel post, including after remount', async () => {
  await mountCarousel();
  expect(renderer.root.findAllByType(BareChatInput)).toHaveLength(2);
  act(() => {
    attachmentState(0).addAttachment(reference);
  });
  expect(attachmentState(1).attachments).toEqual([]);
  expect(mocks.drafts.get('first')).toMatchObject({
    referenceAttachments: [reference],
  });
  expect(mocks.drafts.get('second')).toMatchObject({
    referenceAttachments: [],
  });
  act(() => renderer.unmount());
  await mountCarousel();
  expect(attachmentState(0).attachments).toEqual([reference]);
  expect(attachmentState(1).attachments).toEqual([]);
});

test('restoring, removing and sending references keeps neighboring drafts intact', async () => {
  mocks.drafts.set('first', { referenceAttachments: [reference] });
  mocks.drafts.set('second', { referenceAttachments: [otherReference] });
  await mountCarousel();
  expect(attachmentState(0).attachments).toEqual([reference]);
  expect(attachmentState(1).attachments).toEqual([otherReference]);
  act(() => {
    attachmentState(0).removeAttachment(attachmentState(0).attachments[0]);
  });
  expect(mocks.drafts.get('first')).toMatchObject({ referenceAttachments: [] });
  expect(mocks.drafts.get('second')).toMatchObject({
    referenceAttachments: [otherReference],
  });
  act(() => {
    attachmentState(0).addAttachment(reference);
  });
  await act(async () => {
    await composer(0).props.onPressSend();
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(mocks.finalizeAndSendPost).toHaveBeenCalledWith(
    expect.objectContaining({
      replyToPostId: 'first',
      attachments: [reference],
    }),
    expect.anything()
  );
  expect(attachmentState(0).attachments).toEqual([]);
  expect(attachmentState(1).attachments).toEqual([otherReference]);
  expect(mocks.drafts.get('second')).toMatchObject({
    referenceAttachments: [otherReference],
  });
});

test('file drops go to the owning carousel post', async () => {
  await mountCarousel();
  const file = {
    type: 'image',
    asset: { uri: 'file:///test.png', width: 10, height: 10 },
  };
  act(() =>
    renderer.root
      .findAllByType('FileDrop' as React.ElementType)[1]
      .props.onAssetsDropped([file])
  );
  expect(attachmentState(0).attachments).toEqual([]);
  expect(attachmentState(1).attachments).toEqual([
    expect.objectContaining({ type: 'image', file: file.asset }),
  ]);
});

test('editing a reply does not hydrate or overwrite neighboring reply drafts', async () => {
  const neighborDraft = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Neighbor draft ' }],
      },
    ],
    referenceAttachments: [otherReference],
  };
  mocks.drafts.set('second', neighborDraft);
  mocks.hydrateEditPost.mockReturnValue({
    story: [],
    attachments: [reference],
    isEmpty: false,
  });
  const editingPost = {
    ...posts[0],
    id: 'reply',
    parentId: 'first',
    content: '[]',
  };
  await mountCarousel(editingPost);
  expect(mocks.hydrateEditPost).toHaveBeenCalledTimes(1);
  expect(attachmentState(0).attachments).toEqual([reference]);
  expect(attachmentState(1).attachments).toEqual([otherReference]);
  expect(mocks.drafts.get('second')).toMatchObject(neighborDraft);
  await act(async () => {
    await composer(0).props.onPressEdit();
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(mocks.finalizeAndSendPost).toHaveBeenCalledWith(
    expect.objectContaining({
      isEdit: true,
      editTargetPostId: 'reply',
      attachments: [reference],
    }),
    expect.anything()
  );
  expect(attachmentState(1).attachments).toEqual([otherReference]);
  expect(mocks.drafts.get('second')).toMatchObject(neighborDraft);
});

const mediaAttachments: Attachment[] = [
  { type: 'image', file: { uri: 'file:///draft.png', width: 10, height: 10 } },
  {
    type: 'file',
    localFile: 'file:///draft.pdf',
    size: 123,
    name: 'draft.pdf',
  },
  {
    type: 'video',
    localFile: 'file:///draft.mp4',
    size: 123,
    mimeType: 'video/mp4',
    posterUri: 'blob:preview',
  },
  { type: 'voicememo', localUri: 'file:///draft.m4a', size: 123, duration: 2 },
];

function postScreen() {
  return (
    <AttachmentProvider canUpload uploadAsset={uploadAsset}>
      <PostScreenView
        channel={channel}
        parentPost={posts[0]}
        group={null}
        negotiationMatch
        onPressDelete={mocks.noop}
        handleGoToUserProfile={mocks.noop}
        onGroupAction={mocks.noop}
        goToDm={mocks.noop}
      />
    </AttachmentProvider>
  );
}

test('cancelling a notebook parent edit clears only the edit draft', async () => {
  const replyDraft = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Unsent reply ' }] },
    ],
    referenceAttachments: [reference],
  };
  mocks.drafts.set('first', replyDraft);
  mocks.drafts.set('edit-first', {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Abandoned edit' }],
      },
    ],
  });
  function NotebookScreen() {
    const [editingPost, setEditingPost] = React.useState<Post | undefined>(
      posts[0]
    );
    return (
      <AttachmentProvider canUpload uploadAsset={uploadAsset}>
        <PostScreenView
          channel={{ ...channel, type: 'notebook' }}
          parentPost={posts[0]}
          group={null}
          negotiationMatch
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          onPressDelete={mocks.noop}
          handleGoToUserProfile={mocks.noop}
          onGroupAction={mocks.noop}
          goToDm={mocks.noop}
        />
      </AttachmentProvider>
    );
  }
  await act(async () => {
    renderer = create(<NotebookScreen />, {
      createNodeMock: () => mocks.input,
    });
  });
  expect(
    renderer.root.findAllByType('BigInput' as React.ElementType)
  ).toHaveLength(1);
  await act(async () => {
    renderer.root
      .findByType('ChannelHeader' as React.ElementType)
      .props.goBack();
  });
  expect(mocks.drafts.has('edit-first')).toBe(false);
  expect(mocks.drafts.get('first')).toEqual(replyDraft);
  expect(attachmentState(0).attachments).toEqual([reference]);
  expect(
    renderer.root.findAllByType('BigInput' as React.ElementType)
  ).toHaveLength(0);
});

test.each(mediaAttachments)(
  '$type stays attached across carousel/single layout changes and is sent',
  async (attachment) => {
    await act(async () => {
      renderer = create(postScreen(), { createNodeMock: () => mocks.input });
    });
    await act(async () => {
      attachmentState(0).addAttachment(attachment);
    });
    const saved = attachmentState(0).attachments;
    await act(async () => {
      mocks.isWindowNarrow = false;
      renderer.update(postScreen());
    });
    expect(renderer.root.findAllByType(BareChatInput)).toHaveLength(1);
    expect(attachmentState(0).attachments).toEqual(saved);
    await act(async () => {
      mocks.isWindowNarrow = true;
      renderer.update(postScreen());
    });
    expect(attachmentState(0).attachments).toEqual(saved);
    expect(attachmentState(1).attachments).toEqual([]);
    await act(async () => {
      mocks.isWindowNarrow = false;
      renderer.update(postScreen());
    });
    await act(async () => {
      composer(0).props.onPressSend();
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(mocks.finalizeAndSendPost).toHaveBeenCalledWith(
      expect.objectContaining({ replyToPostId: 'first', attachments: saved }),
      expect.anything()
    );
  }
);

test('a file dropped in the wide layout is retained in the carousel', async () => {
  mocks.isWindowNarrow = false;
  await act(async () => {
    renderer = create(postScreen(), { createNodeMock: () => mocks.input });
  });
  const drops = renderer.root
    .findAllByType('FileDrop' as React.ElementType)
    .filter((drop) => drop.props.dropEnabled !== false);
  expect(drops).toHaveLength(1);
  await act(async () => {
    drops[0].props.onAssetsDropped([
      {
        type: 'image',
        asset: { uri: 'file:///dropped.png', width: 10, height: 10 },
      },
    ]);
  });
  const saved = attachmentState(0).attachments;
  expect(saved).toHaveLength(1);
  await act(async () => {
    mocks.isWindowNarrow = true;
    renderer.update(postScreen());
  });
  expect(attachmentState(0).attachments).toEqual(saved);
  expect(attachmentState(1).attachments).toEqual([]);
});

test('empty offscreen drafts release their upload subscriptions and can reopen', async () => {
  mocks.visiblePostIds = ['first'];
  await mountCarousel();
  const initialSubscriptions = mocks.uploadSubscriptions;
  for (const id of ['second', 'first', 'second']) {
    await act(async () => {
      mocks.visiblePostIds = [id];
      renderer.update(carouselScreen());
    });
    expect(mocks.uploadSubscriptions).toBe(initialSubscriptions);
    expect(attachmentState(0).attachments).toEqual([]);
  }
  await act(async () => renderer.update(carouselScreen(undefined, false)));
  expect(mocks.uploadSubscriptions).toBe(1); // The outer screen provider only.
});

test('an offscreen draft is released after its last attachment is cleared', async () => {
  mocks.visiblePostIds = ['first'];
  await mountCarousel();
  act(() => {
    attachmentState(0).addAttachment(reference);
  });
  const first = attachmentState(0);
  await act(async () => {
    mocks.visiblePostIds = ['second'];
    renderer.update(carouselScreen());
  });
  expect(mocks.uploadSubscriptions).toBe(3);
  await act(async () => first.clearAttachments());
  expect(mocks.uploadSubscriptions).toBe(2);
});

test('a failed upload releases its empty offscreen draft', async () => {
  let failUpload!: (reason: Error) => void;
  uploadAsset.mockImplementation(
    () =>
      new Promise<void>((_, reject) => {
        failUpload = reject;
      })
  );
  mocks.visiblePostIds = ['first'];
  await mountCarousel();
  let upload!: Promise<unknown>;
  await act(async () => {
    upload = attachmentState(0)
      .uploadAssets([
        {
          type: 'image',
          asset: { uri: 'file:///failed.png', width: 10, height: 10 },
        },
      ])
      .catch(() => {});
    mocks.visiblePostIds = ['second'];
    renderer.update(carouselScreen());
  });
  expect(mocks.uploadSubscriptions).toBe(3);
  await act(async () => {
    failUpload(new Error('Upload failed'));
    await upload;
  });
  expect(mocks.uploadSubscriptions).toBe(2);
});

test.each([false, true])(
  'pasted image preparation survives unmount (StrictMode: %s)',
  async (strict) => {
    let finishSize!: (size: number[]) => void;
    mocks.imageSize.mockImplementation(
      () =>
        new Promise<number[]>((resolve) => {
          finishSize = resolve;
        })
    );
    const screen = () =>
      strict ? (
        <React.StrictMode>{carouselScreen()}</React.StrictMode>
      ) : (
        carouselScreen()
      );
    mocks.visiblePostIds = ['first'];
    await act(async () => {
      renderer = create(screen(), { createNodeMock: () => mocks.input });
    });
    const nativeInput = renderer.root.findByType(
      'PasteableTextInput' as React.ElementType
    );
    await act(async () => {
      nativeInput.props.onPasteFiles([
        {
          fileName: 'pasted.png',
          fileSize: 123,
          type: 'image/png',
          uri: 'file:///pasted.png',
        },
      ]);
      mocks.visiblePostIds = ['second'];
      renderer.update(screen());
    });
    expect(mocks.uploadSubscriptions).toBe(3);
    await act(async () => finishSize([640, 480]));
    await act(async () => {
      mocks.visiblePostIds = ['first'];
      renderer.update(screen());
    });
    expect(attachmentState(0).attachments).toEqual([
      expect.objectContaining({
        type: 'image',
        file: expect.objectContaining({
          uri: 'file:///pasted.png',
          width: 640,
          height: 480,
        }),
      }),
    ]);
    expect(mocks.uploadSubscriptions).toBe(2);
  }
);

test.each(['paste', 'drop', 'paste error', 'drop error'])(
  'web %s preparation keeps an empty scope alive until it settles',
  async (kind) => {
    const images: { onload: () => void; onerror: (error: Error) => void }[] =
      [];
    vi.stubGlobal(
      'Image',
      class {
        width = 640;
        height = 480;
        onload = () => {};
        onerror = (_error: Error) => {};
        constructor() {
          images.push(this);
        }
      }
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pasted-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let paste!: (event: unknown) => Promise<void>;
    vi.stubGlobal('document', {
      addEventListener: (event: string, listener: typeof paste) => {
        if (event === 'paste') paste = listener;
      },
      removeEventListener: () => {},
    });
    mocks.isWeb = true;
    mocks.realFileDrop = true;
    mocks.visiblePostIds = ['first'];
    await mountCarousel();
    const file = new File(['image'], 'pasted.png', { type: 'image/png' });
    let preparation!: Promise<unknown>;
    await act(async () => {
      if (kind.startsWith('paste')) {
        preparation = paste({
          clipboardData: {
            items: [{ type: file.type, getAsFile: () => file }],
          },
        });
      } else {
        const drop = renderer.root
          .findAllByType('View' as React.ElementType)
          .find((view) => view.props.onDropFiles && !view.props.dropDisabled)!;
        preparation = drop.props.onDropFiles([file]);
      }
      preparation = preparation.catch(() => {});
      mocks.visiblePostIds = ['second'];
      renderer.update(carouselScreen());
    });
    expect(mocks.uploadSubscriptions).toBe(3);
    await act(async () => {
      if (kind.endsWith('error')) images[0].onerror(new Error('Invalid image'));
      else images[0].onload();
      await preparation;
    });
    expect(mocks.uploadSubscriptions).toBe(kind.endsWith('error') ? 2 : 3);
    await act(async () => {
      mocks.visiblePostIds = ['first'];
      renderer.update(carouselScreen());
    });
    expect(attachmentState(0).attachments).toHaveLength(
      kind.endsWith('error') ? 0 : 1
    );
  }
);

test.each(mediaAttachments)(
  '$type survives virtualized cell unmount and parent-edit transitions',
  async (attachment) => {
    await mountCarousel();
    await act(async () => {
      attachmentState(0).addAttachment(attachment);
    });
    const savedAttachments = attachmentState(0).attachments;
    await act(async () => {
      mocks.visiblePostIds = ['second'];
      renderer.update(carouselScreen());
    });
    expect(renderer.root.findAllByType(BareChatInput)).toHaveLength(1);
    expect(attachmentState(0).attachments).toEqual([]);
    await act(async () => {
      mocks.visiblePostIds = null;
      renderer.update(carouselScreen());
    });
    expect(attachmentState(0).attachments).toEqual(savedAttachments);
    // Parent editing temporarily replaces the entire carousel on this screen.
    await act(async () => renderer.update(carouselScreen(undefined, false)));
    expect(renderer.root.findAllByType(BareChatInput)).toHaveLength(0);
    await act(async () => renderer.update(carouselScreen()));
    expect(attachmentState(0).attachments).toEqual(savedAttachments);
    expect(attachmentState(1).attachments).toEqual([]);
  }
);

test('an upload finishing while its carousel cell is absent remains attached', async () => {
  let finishUpload!: () => void;
  uploadAsset.mockImplementation(
    () =>
      new Promise<void>((done) => {
        finishUpload = done;
      })
  );
  await mountCarousel();
  let upload!: Promise<unknown>;
  act(() => {
    upload = attachmentState(0).uploadAssets([
      {
        type: 'image',
        asset: { uri: 'file:///uploaded.png', width: 10, height: 10 },
      },
    ]);
  });
  await act(async () => {
    mocks.visiblePostIds = ['second'];
    renderer.update(carouselScreen());
  });
  await act(async () => {
    finishUpload();
    await upload;
  });
  await act(async () => {
    mocks.visiblePostIds = null;
    renderer.update(carouselScreen());
  });
  expect(attachmentState(0).attachments).toEqual([
    expect.objectContaining({
      type: 'image',
      file: expect.objectContaining({ uri: 'file:///uploaded.png' }),
    }),
  ]);
  expect(attachmentState(1).attachments).toEqual([]);
});

test('voice transcription completes while its carousel cell is absent', async () => {
  let finishTranscription!: (text: string) => void;
  mocks.transcribe.mockImplementation(
    () =>
      new Promise<string>((done) => {
        finishTranscription = done;
      })
  );
  await mountCarousel();
  await act(async () => {
    attachmentState(0).addAttachment(mediaAttachments[3]);
  });
  await act(async () => {
    mocks.visiblePostIds = ['second'];
    renderer.update(carouselScreen());
  });
  await act(async () => finishTranscription('Recorded reply'));
  await act(async () => {
    mocks.visiblePostIds = null;
    renderer.update(carouselScreen());
  });
  expect(attachmentState(0).attachments).toEqual([
    expect.objectContaining({
      type: 'voicememo',
      transcription: 'Recorded reply',
    }),
  ]);
  expect(mocks.transcribe).toHaveBeenCalledTimes(1);
  expect(attachmentState(1).attachments).toEqual([]);
});

test('retained attachments do not overwrite text during a brief cell revisit', async () => {
  const draft = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Unsent reply ' }] },
    ],
    referenceAttachments: [reference],
  };
  mocks.drafts.set('first', draft);
  await mountCarousel();
  await act(async () => {
    mocks.visiblePostIds = ['second'];
    renderer.update(carouselScreen());
  });
  let finishRead!: (value: JSONContent) => void;
  mocks.deferredRead = () =>
    new Promise<JSONContent>((done) => {
      finishRead = done;
    });
  await act(async () => {
    mocks.visiblePostIds = null;
    renderer.update(carouselScreen());
  });
  expect(mocks.drafts.get('first')).toEqual(draft);
  await act(async () => {
    mocks.visiblePostIds = ['second'];
    renderer.update(carouselScreen());
  });
  await act(async () => finishRead(draft));
  expect(mocks.drafts.get('first')).toEqual(draft);
});
