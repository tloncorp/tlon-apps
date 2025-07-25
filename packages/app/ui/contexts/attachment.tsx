import {
  Attachment,
  FinalizedAttachment,
  ImageAttachment,
  UploadedImageAttachment,
} from '@tloncorp/shared';
import {
  finalizeAttachments,
  useUploadStates,
  waitForUploads,
} from '@tloncorp/shared/store';
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
import { isWeb } from 'tamagui';

export type AttachmentState = {
  attachments: Attachment[];
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (attachment: Attachment) => void;
  clearAttachments: () => void;
  resetAttachments: (attachments: Attachment[]) => void;
  waitForAttachmentUploads: () => Promise<FinalizedAttachment[]>;
  attachAssets: (assets: ImagePickerAsset[]) => void;
  uploadAssets: (
    assets: ImagePickerAsset[]
  ) => Promise<UploadedImageAttachment[]>;
  canUpload: boolean;
};

const defaultState: AttachmentState = {
  attachments: [],
  addAttachment: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
  resetAttachments: () => {},
  uploadAssets: async () => [],
  attachAssets: () => {},
  waitForAttachmentUploads: async () => [],
  canUpload: true,
};

const Context = createContext(defaultState);

export const useAttachmentContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useAttachmentContext` within an `AttachmentProvider` component.'
    );
  }

  return context;
};

export const AttachmentProvider = ({
  initialAttachments,
  uploadAsset,
  canUpload,
  children,
}: PropsWithChildren<{
  canUpload: boolean;
  uploadAsset: (asset: ImagePickerAsset, isWeb?: boolean) => Promise<void>;
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
        uploadAsset(a.file, isWeb);
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
    setState((prev) =>
      prev.filter(
        (a) =>
          a !== attachment &&
          // TODO: unique attachment ids
          !(
            a.type === 'image' &&
            attachment.type === 'image' &&
            attachment.file.uri === a.file.uri
          )
      )
    );
  }, []);

  const handleClearAttachments = useCallback(() => {
    setState([]);
  }, []);

  const handleResetAttachments = useCallback((attachments: Attachment[]) => {
    setState(attachments);
  }, []);

  const handleWaitForUploads = useCallback(
    () => finalizeAttachments(state),
    [state]
  );

  const handleUploadAssets = useCallback(
    async (assets: ImagePickerAsset[]): Promise<UploadedImageAttachment[]> => {
      const assetUris: string[] = [];

      const uploadPromises = assets.map(async (asset) => {
        await uploadAsset(asset, isWeb);
        assetUris.push(asset.uri);
        return asset;
      });

      const uploadedAssets = await Promise.all(uploadPromises);

      setState((prev) => [
        ...prev,
        ...uploadedAssets.map((asset) => ({
          type: 'image' as const,
          file: asset,
        })),
      ]);

      const uploadStates = await waitForUploads(assetUris);

      return uploadedAssets
        .map((asset) => ({
          type: 'image' as const,
          file: asset,
          uploadState: uploadStates[asset.uri],
        }))
        .filter(
          (attachment): attachment is UploadedImageAttachment =>
            attachment.uploadState?.status === 'success'
        );
    },
    [uploadAsset]
  );

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
        uploadAssets: handleUploadAssets,
        canUpload,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export function useMappedImageAttachments<T extends Record<string, string>>(
  map: T
): { [K in keyof T]: ImageAttachment | undefined } {
  const mapHash = Object.entries(map).flat().join('');
  const { attachments } = useAttachmentContext();

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
