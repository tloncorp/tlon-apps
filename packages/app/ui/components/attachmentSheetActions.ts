type Accent = 'positive' | 'negative' | 'neutral' | 'disabled';

type Action = {
  title: string;
  description?: string;
  action?: () => void;
};

type ActionGroup = {
  accent: Accent;
  actions: Action[];
};

type CreateActionInput = Action | false | null | undefined;
type CreateActionGroupsInput =
  | [Accent, ...CreateActionInput[]]
  | false
  | null
  | undefined;

function createActionGroups(...inputs: CreateActionGroupsInput[]): ActionGroup[] {
  return inputs
    .filter((input): input is [Accent, ...CreateActionInput[]] => !!input)
    .map(([accent, ...actions]) => ({
      accent,
      actions: actions.filter((action): action is Action => !!action),
    }));
}

type AttachmentActionSheetOptions = {
  createAssetFromClipboard: () => void;
  hasClipboardImage: boolean;
  isWeb: boolean;
  mediaType: 'image' | 'all';
  onClearAttachments?: () => void;
  pickImage: () => void;
  platformOS: string;
  showClearOption?: boolean;
  startFilePicker: () => void;
  startRecordingVoiceMemo: () => void;
  takePhoto: () => void;
  takePhotoOrVideo: () => void;
  takeVideo: () => void;
  useVideoInMediaPicker: boolean;
};

export function createAttachmentSheetActionGroups({
  createAssetFromClipboard,
  hasClipboardImage,
  isWeb,
  mediaType,
  onClearAttachments,
  pickImage,
  platformOS,
  showClearOption,
  startFilePicker,
  startRecordingVoiceMemo,
  takePhoto,
  takePhotoOrVideo,
  takeVideo,
  useVideoInMediaPicker,
}: AttachmentActionSheetOptions): ActionGroup[] {
  const showCaptureActions = !isWeb;
  const showSplitAndroidCaptureActions =
    platformOS === 'android' && useVideoInMediaPicker;

  return createActionGroups(
    [
      'neutral',
      {
        title: useVideoInMediaPicker
          ? isWeb
            ? 'Upload Media'
            : 'Media Library'
          : isWeb
            ? 'Upload an Image'
            : 'Photo Library',
        description: isWeb
          ? useVideoInMediaPicker
            ? 'Upload an image or video from your computer'
            : 'Upload an image from your computer'
          : useVideoInMediaPicker
            ? 'Choose a photo or video from your library'
            : 'Choose a photo from your library',
        action: pickImage,
      },
      showCaptureActions &&
        !showSplitAndroidCaptureActions && {
          title: useVideoInMediaPicker ? 'Capture Photo or Video' : 'Capture photo',
          description: useVideoInMediaPicker
            ? 'Use your camera to capture a photo or video'
            : 'Use your camera to capture a photo',
          action: useVideoInMediaPicker ? takePhotoOrVideo : takePhoto,
        },
      showSplitAndroidCaptureActions && {
        title: 'Capture photo',
        description: 'Use your camera to capture a photo',
        action: takePhoto,
      },
      showSplitAndroidCaptureActions && {
        title: 'Capture video',
        description: 'Use your camera to capture a video',
        action: takeVideo,
      },
      !isWeb &&
        hasClipboardImage && {
          title: 'Paste from Clipboard',
          description: 'Use the image currently in your clipboard',
          action: createAssetFromClipboard,
        },
      mediaType === 'all' && {
        title: 'Upload a File',
        description: 'Upload files from your device',
        action: startFilePicker,
      },
      mediaType === 'all' &&
        !isWeb && {
          title: 'Voice Memo',
          description: 'Record an audio message',
          action: startRecordingVoiceMemo,
        },
    ],
    showClearOption && [
      'negative',
      {
        title: 'Clear',
        description: 'Remove attached media',
        action: onClearAttachments,
      },
    ]
  );
}
