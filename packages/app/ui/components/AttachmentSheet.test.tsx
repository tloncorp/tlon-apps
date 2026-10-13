import React, { useImperativeHandle } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import type { ActionGroup } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';
import { BigInput } from './BigInput';
import { InputToolbar } from './MessageInput/InputToolbar';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  narrow: true,
  camera: vi.fn(async () => ({ canceled: true })),
  library: vi.fn(async () => ({ canceled: true })),
  file: vi.fn(async () => ({ uploadIntents: [] })),
  requestCamera: vi.fn(async () => ({ granted: true })),
  requestLibrary: vi.fn(async () => ({ granted: true })),
}));

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  Attachment: {
    UploadIntent: { fromImagePickerAsset: (asset: unknown) => asset },
  },
  PLACEHOLDER_ASSET_URI: 'placeholder',
  createDevLogger: () => ({ trackError: vi.fn(), log: vi.fn() }),
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: Object.assign(() => null, { Frame: 'button' }),
  Icon: () => null,
  Image: () => null,
  Text: 'Text',
  View: 'View',
  useIsWindowNarrow: () => mocks.narrow,
  useToast: () => vi.fn(),
}));
vi.mock('@tloncorp/api/urbit', () => ({}));
vi.mock('../../lib/featureFlags', () => ({ useFeatureFlag: () => [false] }));
vi.mock('./Channel/ChannelHeader', () => ({
  useRegisterChannelHeaderItem: () => {},
}));
vi.mock('./MarkdownEditor', () => ({ MarkdownEditor: () => null }));
vi.mock('./MessageInput', () => ({
  MessageInput: ({ ref }: { ref: React.Ref<unknown> }) => {
    useImperativeHandle(ref, () => ({ editor: {} }));
    return null;
  },
}));
vi.mock('./MessageInput/InputToolbar', () => ({ InputToolbar: () => null }));
vi.mock('./MessageInput/toolbarActions', () => ({ DEFAULT_TOOLBAR_ITEMS: [] }));
vi.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: 'View',
}));
vi.mock('expo-image-picker', () => ({
  useCameraPermissions: () => [null, mocks.requestCamera],
  useMediaLibraryPermissions: () => [null, mocks.requestLibrary],
  launchCameraAsync: mocks.camera,
  launchImageLibraryAsync: mocks.library,
}));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  Alert: { alert: vi.fn() },
  TouchableOpacity: 'button',
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock('tamagui', () => ({
  isWeb: false,
  Input: 'Input',
  XStack: 'View',
  getTokenValue: () => 16,
  useTheme: () => ({
    background: { val: '#fff' },
    primaryText: { val: '#000' },
    border: { val: '#ddd' },
  }),
}));
vi.mock('../../utils/filepicker', () => ({
  pickFile: mocks.file,
  normalizeUploadIntents: async (uploadIntents: unknown[]) => ({
    uploadIntents,
  }),
}));
vi.mock('../../utils/files', () => ({}));
vi.mock('../../utils/imagePickerAsset', () => ({}));
vi.mock('../contexts/attachment', () => ({
  useAttachmentContext: () => ({
    attachments: [],
    attachAssets: vi.fn(),
    clearAttachments: vi.fn(),
    removeAttachment: vi.fn(),
  }),
}));
vi.mock('./draftInputs/shared', () => ({ useDraftInputContext: () => null }));
vi.mock('./StorageQuotaIndicator', () => ({
  useStorageInfoQuery: () => ({ isSuccess: false }),
  StorageQuotaIndicator: () => null,
}));
vi.mock('./ListItem', () => ({ ListItem: { MainContent: () => null } }));
vi.mock('./AudioRecorder', () => ({
  AudioRecorder: () => null,
  AudioRecorderSheet: () => null,
}));
vi.mock('./ActionSheet', async () => {
  const { Passthrough, Empty, createActionGroups } =
    await import('../../test/sheetTestUtils');
  return {
    ActionSheet: Object.assign(Passthrough, {
      Header: Passthrough,
      Content: Passthrough,
      SimpleActionGroupList: Empty,
    }),
    createActionGroups,
  };
});

setupReactTestEnvironment();
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.platform.OS = 'ios';
  mocks.narrow = true;
});
afterEach(() => {
  vi.useRealTimers();
});

function renderSheet() {
  let tree: ReturnType<typeof create>;
  let open = true;
  const onOpenChange = vi.fn((next: boolean) => {
    open = next;
  });
  const element = () => (
    <AttachmentSheet
      isOpen={open}
      onOpenChange={onOpenChange}
      mediaType="all"
    />
  );
  act(() => {
    tree = create(element());
  });
  return {
    tree: tree!,
    onOpenChange,
    choose(title: string) {
      const groups = tree.root.find((node) => node.props.actionGroups != null)
        .props.actionGroups as ActionGroup[];
      const action = groups
        .flatMap((group) => group.actions)
        .find((action) => action.title === title);
      if (!action?.action) throw new Error(`Missing action: ${title}`);
      act(() => {
        action.action?.();
        tree.update(element());
      });
    },
    completeDismissal() {
      act(() => {
        tree.root
          .find((node) => node.props.onNativeDismissed != null)
          .props.onNativeDismissed();
      });
    },
    recorderOpen() {
      return tree.root.find((node) => node.props.audioRecorderProps != null)
        .props.open;
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

describe('AttachmentSheet modal handoffs', () => {
  it.each([
    ['Capture Photo or Video', mocks.camera],
    ['Media Library', mocks.library],
    ['Upload a File', mocks.file],
  ] as const)(
    'defers %s until native dismissal completes',
    async (title, picker) => {
      const sheet = renderSheet();
      sheet.choose(title);
      expect(sheet.onOpenChange).toHaveBeenCalledWith(false);
      expect(picker).not.toHaveBeenCalled();
      // Advancing time alone must never launch a modal during dismissal.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(picker).not.toHaveBeenCalled();
      sheet.completeDismissal();
      expect(picker).toHaveBeenCalledTimes(1);
      await act(async () => {});
      sheet.completeDismissal();
      expect(picker).toHaveBeenCalledTimes(1);
      sheet.unmount();
    }
  );

  it('does not mount recording controls as open before dismissal completes', () => {
    const sheet = renderSheet();
    sheet.choose('Voice Memo');
    expect(sheet.recorderOpen()).toBe(false);
    sheet.completeDismissal();
    expect(sheet.recorderOpen()).toBe(true);
    sheet.unmount();
  });

  it.each(['web'])(
    'keeps the file picker synchronous on %s',
    async (platform) => {
      mocks.platform.OS = platform;
      const sheet = renderSheet();
      sheet.choose('Upload a File');
      expect(mocks.file).toHaveBeenCalledTimes(1);
      await act(async () => {});
      sheet.unmount();
    }
  );

  it.each([
    ['Capture photo', mocks.camera],
    ['Media Library', mocks.library],
  ] as const)(
    'waits for Android dismissal before %s',
    async (title, picker) => {
      mocks.platform.OS = 'android';
      const sheet = renderSheet();
      sheet.choose(title);
      expect(picker).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(picker).not.toHaveBeenCalled();
      sheet.completeDismissal();
      expect(picker).toHaveBeenCalledTimes(1);
      await act(async () => {});
      sheet.unmount();
    }
  );

  it('does not wait for a native event on the wide-window dialog', async () => {
    mocks.narrow = false;
    const sheet = renderSheet();
    sheet.choose('Media Library');
    expect(mocks.library).toHaveBeenCalledTimes(1);
    await act(async () => {});
    sheet.unmount();
  });

  it.each([0, 1])(
    'keeps notebook picker %s mounted through dismissal',
    async (index) => {
      let tree: ReturnType<typeof create>;
      act(() => {
        tree = create(
          <BigInput
            channelId="notebook"
            channelType="notebook"
            sendPostFromDraft={vi.fn()}
            setShouldBlur={vi.fn()}
            shouldBlur={false}
            groupMembers={[]}
            groupRoles={[]}
            storeDraft={vi.fn(async () => {})}
            clearDraft={vi.fn(async () => {})}
            getDraft={vi.fn(async () => null)}
          />
        );
      });
      expect(tree!.root.findAllByType(AttachmentSheet)).toHaveLength(0);
      act(() => {
        if (index === 0) {
          tree.root
            .findAllByType('button')
            .find(
              (button) =>
                button.findAll((node) =>
                  node.children.includes('Add header image')
                ).length > 0
            )!
            .props.onPress();
        } else {
          tree.root
            .findAllByType('button')
            .find((button) => button.props.right === 16)!
            .props.onPress();
        }
      });
      if (index === 1) {
        act(() => {
          const items = tree.root.findAllByType(InputToolbar)[0].props.items;
          items
            .find((item: { icon: string }) => item.icon === 'Camera')
            .onPress({ editorState: { selection: { from: 0, to: 0 } } })();
        });
      }
      // Opening either menu must not eagerly create the other one.
      expect(tree!.root.findAllByType(AttachmentSheet)).toHaveLength(1);
      const sheet = () => tree.root.findByType(AttachmentSheet);
      expect(sheet().props.isOpen).toBe(true);
      const groups = sheet().find((node) => node.props.actionGroups != null)
        .props.actionGroups as ActionGroup[];
      act(() =>
        groups[0].actions
          .find((action) => action.title === 'Photo Library')
          ?.action?.()
      );
      expect(sheet().props.isOpen).toBe(false);
      expect(mocks.library).not.toHaveBeenCalled();
      act(() =>
        sheet()
          .find((node) => node.props.onNativeDismissed != null)
          .props.onNativeDismissed()
      );
      expect(mocks.library).toHaveBeenCalledTimes(1);
      await act(async () => {});
      act(() => tree.unmount());
    }
  );
});
