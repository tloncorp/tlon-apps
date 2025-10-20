import {
  Attachment,
  FileAsset,
  FileAttachment,
  FinalizedAttachment,
  ImageAttachment,
  UploadedFileAttachment,
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
  attachFiles: (files: FileAsset[]) => void;
  uploadAssets: (
    assets: ImagePickerAsset[]
  ) => Promise<UploadedImageAttachment[]>;
  uploadFiles: (files: FileAsset[]) => Promise<UploadedFileAttachment[]>;
  canUpload: boolean;
};

const defaultState: AttachmentState = {
  attachments: [],
  addAttachment: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
  resetAttachments: () => {},
  uploadAssets: async () => [],
  uploadFiles: async () => [],
  attachAssets: () => {},
  attachFiles: () => {},
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
  uploadFile,
  canUpload,
  children,
}: PropsWithChildren<{
  canUpload: boolean;
  uploadAsset: (asset: ImagePickerAsset, isWeb?: boolean) => Promise<void>;
  uploadFile?: (file: FileAsset, isWeb?: boolean) => Promise<void>;
  initialAttachments?: Attachment[];
}>) => {
  const [state, setState] = useState<Attachment[]>(initialAttachments ?? []);

  const assetUploadStates = useUploadStates(
    state
      .filter((a): a is ImageAttachment => a.type === 'image')
      .map((a) => a.file.uri)
  );

  const fileUploadStates = useUploadStates(
    state
      .filter((a): a is FileAttachment => a.type === 'file')
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

      if (a.type === 'file') {
        return {
          ...a,
          uploadState: fileUploadStates[a.file.uri],
        };
      }

      return a;
    });
  }, [assetUploadStates, fileUploadStates, state]);

  useEffect(() => {
    attachments.forEach((a) => {
      if (a.type === 'image' && !a.uploadState) {
        uploadAsset(a.file, isWeb);
      }
      if (a.type === 'file' && !a.uploadState && uploadFile) {
        uploadFile(a.file, isWeb);
      }
    });
  }, [attachments, uploadAsset, uploadFile]);

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

  const handleAttachFiles = useCallback(
    (files: FileAsset[]) => {
      files.forEach((file) =>
        handleAddAttachment({ type: 'file', file: file })
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

  const handleUploadFiles = useCallback(
    async (files: FileAsset[]): Promise<UploadedFileAttachment[]> => {
      if (!uploadFile) {
        return [];
      }

      const fileUris: string[] = [];

      const uploadPromises = files.map(async (file) => {
        await uploadFile(file, isWeb);
        fileUris.push(file.uri);
        return file;
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      setState((prev) => [
        ...prev,
        ...uploadedFiles.map((file) => ({
          type: 'file' as const,
          file: file,
        })),
      ]);

      const uploadStates = await waitForUploads(fileUris);

      return uploadedFiles
        .map((file) => ({
          type: 'file' as const,
          file: file,
          uploadState: uploadStates[file.uri],
        }))
        .filter(
          (attachment): attachment is UploadedFileAttachment =>
            attachment.uploadState?.status === 'success'
        );
    },
    [uploadFile]
  );

  return (
    <Context.Provider
      value={{
        attachments,
        attachAssets: handleAttachAssets,
        attachFiles: handleAttachFiles,
        addAttachment: handleAddAttachment,
        removeAttachment: handleRemoveAttachment,
        clearAttachments: handleClearAttachments,
        resetAttachments: handleResetAttachments,
        waitForAttachmentUploads: handleWaitForUploads,
        uploadAssets: handleUploadAssets,
        uploadFiles: handleUploadFiles,
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
