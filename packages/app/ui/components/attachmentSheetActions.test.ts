import { describe, expect, test, vi } from 'vitest';

import { createAttachmentSheetActionGroups } from './attachmentSheetActions';

function getActionTitles({
  mediaType,
  platformOS,
  useVideoInMediaPicker,
}: {
  mediaType: 'image' | 'all';
  platformOS: string;
  useVideoInMediaPicker: boolean;
}) {
  return createAttachmentSheetActionGroups({
    createAssetFromClipboard: vi.fn(),
    hasClipboardImage: false,
    isWeb: false,
    mediaType,
    onClearAttachments: undefined,
    pickImage: vi.fn(),
    platformOS,
    showClearOption: false,
    startFilePicker: vi.fn(),
    startRecordingVoiceMemo: vi.fn(),
    takePhoto: vi.fn(),
    takePhotoOrVideo: vi.fn(),
    takeVideo: vi.fn(),
    useVideoInMediaPicker,
  }).flatMap((group) => group.actions.map((action) => action.title));
}

describe('createAttachmentSheetActionGroups', () => {
  test('splits android media capture into photo and video actions', () => {
    const titles = getActionTitles({
      mediaType: 'all',
      platformOS: 'android',
      useVideoInMediaPicker: true,
    });

    expect(titles).toEqual([
      'Media Library',
      'Capture photo',
      'Capture video',
      'Upload a File',
      'Voice Memo',
    ]);
  });

  test('shows only capture photo for android image-only sheets', () => {
    const titles = getActionTitles({
      mediaType: 'image',
      platformOS: 'android',
      useVideoInMediaPicker: false,
    });

    expect(titles).toEqual(['Photo Library', 'Capture photo']);
  });

  test('keeps the combined capture action on ios', () => {
    const titles = getActionTitles({
      mediaType: 'all',
      platformOS: 'ios',
      useVideoInMediaPicker: true,
    });

    expect(titles).toContain('Capture Photo or Video');
    expect(titles).not.toContain('Capture photo');
    expect(titles).not.toContain('Capture video');
  });
});
