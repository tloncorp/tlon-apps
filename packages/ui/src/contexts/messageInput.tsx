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
};

const defaultState: MessageInputState = {
  attachments: [],
  addAttachment: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
  resetAttachments: () => {},
  attachAssets: () => {},
  waitForAttachmentUploads: async () => [],
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
  uploadAsset: uploadAsset,
  children,
}: PropsWithChildren<{
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

  const handleAddAttachment = useCallback(
    (attachment: Attachment) => {
      if (attachment.type === 'image') {
        uploadAsset(attachment.file);
      }
      setState((prev) => [...prev, attachment]);
    },
    [uploadAsset]
  );

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
