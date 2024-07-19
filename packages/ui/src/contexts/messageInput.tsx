import { ContentReference } from '@tloncorp/shared/dist/api';
import {
  UploadState,
  useUploadStates,
  waitForUploads,
} from '@tloncorp/shared/dist/store';
import { ImagePickerAsset } from 'expo-image-picker';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ReferenceAttachment = {
  type: 'reference';
  reference: ContentReference;
  path: string;
};

export type ImageAttachment = {
  type: 'image';
  file: ImagePickerAsset;
  uploadState?: UploadState;
};

export type UploadedImageAttachment = {
  type: 'image';
  file: ImagePickerAsset;
  uploadState: {
    status: 'complete';
    remoteUri: string;
  };
};

export type Attachment = ReferenceAttachment | ImageAttachment;
export type FinalizedAttachment = ReferenceAttachment | UploadedImageAttachment;

export type MessageInputState = {
  attachments: Attachment[];
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (attachment: Attachment) => void;
  clearAttachments: () => void;
  resetAttachments: (attachments: Attachment[]) => void;
  waitForAttachmentUploads: () => Promise<FinalizedAttachment[]>;
  attachAssets: (assets: ImagePickerAsset[]) => void;
  canUpload: boolean;
};

const defaultState: MessageInputState = {
  attachments: [],
  addAttachment: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
  resetAttachments: () => {},
  attachAssets: () => {},
  waitForAttachmentUploads: async () => [],
  canUpload: true,
};

const Context = createContext(defaultState);

export const useMessageInputContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useMessageInputContext` within an `MessageInputProvider` component.'
    );
  }

  return context;
};

export const MessageInputProvider = ({
  initialAttachments,
  uploadAsset,
  canUpload,
  children,
}: PropsWithChildren<{
  canUpload: boolean;
  uploadAsset: (asset: ImagePickerAsset) => Promise<void>;
  initialAttachments?: Attachment[];
}>) => {
  const [state, setState] = useState<Attachment[]>(initialAttachments ?? []);

  const assetUploadStates = useUploadStates(
    state
      .filter((a): a is ImageAttachment => a.type === 'image')
      .map((a) => a.file.uri)
  );

  const attachments = useMemo(() => {
    return state.map((a) => {
      if (a.type === 'image') {
        return {
          ...a,
          uploadState: assetUploadStates[a.file.uri],
        };
      }

      return a;
    });
  }, [assetUploadStates, state]);

  useEffect(() => {
    attachments.forEach((a) => {
      if (a.type === 'image' && !a.uploadState) {
        uploadAsset(a.file);
      }
    });
  }, [attachments, uploadAsset]);

  const handleAddAttachment = useCallback((attachment: Attachment) => {
    setState((prev) => [...prev, attachment]);
  }, []);

  const handleAttachAssets = useCallback(
    (assets: ImagePickerAsset[]) => {
      assets.forEach((asset) =>
        handleAddAttachment({ type: 'image', file: asset })
      );
    },
    [handleAddAttachment]
  );

  const handleRemoveAttachment = useCallback((attachment: Attachment) => {
    setState((prev) => prev.filter((a) => a !== attachment));
  }, []);

  const handleClearAttachments = useCallback(() => {
    setState([]);
  }, []);

  const handleResetAttachments = useCallback((attachments: Attachment[]) => {
    setState(attachments);
  }, []);

  const handleWaitForUploads = useCallback(async () => {
    const assetAttachments = state.filter(
      (a): a is ImageAttachment => a.type === 'image'
    );
    const completedUploads = await waitForUploads(
      assetAttachments.map((a) => a.file.uri)
    );
    const finalAttachments: FinalizedAttachment[] = attachments.map((a) => {
      if (a.type === 'image') {
        const finalizedAttachment = {
          ...a,
          uploadState: completedUploads[a.file.uri],
        };
        assertIsUploadedAssetAttachment(finalizedAttachment);
        return finalizedAttachment;
      } else {
        return a;
      }
    });
    return finalAttachments;
  }, [attachments, state]);

  return (
    <Context.Provider
      value={{
        attachments,
        attachAssets: handleAttachAssets,
        addAttachment: handleAddAttachment,
        removeAttachment: handleRemoveAttachment,
        clearAttachments: handleClearAttachments,
        resetAttachments: handleResetAttachments,
        waitForAttachmentUploads: handleWaitForUploads,
        canUpload,
      }}
    >
      {children}
    </Context.Provider>
  );
};

function assertIsUploadedAssetAttachment(
  attachment: unknown
): asserts attachment is UploadedImageAttachment {
  if (
    !attachment ||
    typeof attachment !== 'object' ||
    !('uploadState' in attachment) ||
    !attachment.uploadState ||
    typeof attachment.uploadState !== 'object' ||
    !('status' in attachment.uploadState) ||
    attachment.uploadState.status !== 'success'
  ) {
    console.log(attachment);
    throw new Error('Attachment is not an uploaded image attachment');
  }
}

export function useMappedImageAttachments<T extends Record<string, string>>(
  map: T
): { [K in keyof T]: ImageAttachment | undefined } {
  const mapHash = Object.entries(map).flat().join('');
  const { attachments } = useMessageInputContext();

  return useMemo(() => {
    return Object.fromEntries(
      Object.entries(map).map(([key, path]) => [
        key,
        attachments.find(
          (a): a is ImageAttachment => a.type === 'image' && a.file.uri === path
        ),
      ])
    ) as { [K in keyof T]: ImageAttachment | undefined };
    // Hash changes when map changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapHash, attachments]);
}
