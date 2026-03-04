import {
  Attachment,
  FinalizedAttachment,
  ImageAttachment,
} from '@tloncorp/shared';
import {
  finalizeAttachments,
  useUploadStates,
  waitForUploads,
} from '@tloncorp/shared/store';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isWeb } from 'tamagui';

import { canAddAttachment } from './attachmentRules';

export type AttachmentState = {
  attachments: Attachment[];
  attachmentErrorMessage: string | null;
  setAttachmentErrorMessage: (message: string | null) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (attachment: Attachment) => void;
  clearAttachments: () => void;
  resetAttachments: (attachments: Attachment[]) => void;
  waitForAttachmentUploads: () => Promise<FinalizedAttachment[]>;
  attachAssets: (assets: Attachment.UploadIntent[]) => void;
  uploadAssets: (
    assets: Attachment.UploadIntent[]
  ) => Promise<FinalizedAttachment[]>;
  canUpload: boolean;
};

const defaultState: AttachmentState = {
  attachments: [],
  attachmentErrorMessage: null,
  setAttachmentErrorMessage: () => {},
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

type AddAttachmentResult = {
  attachments: Attachment[];
  errorMessage: string | null;
  removedForReplacement: Attachment[];
};

function addAttachmentToState(
  prev: Attachment[],
  attachment: Attachment
): AddAttachmentResult {
  const validation = canAddAttachment(prev, attachment);
  if (!validation.ok) {
    return {
      attachments: prev,
      errorMessage: validation.reason,
      removedForReplacement: [],
    };
  }
  if (attachment.type === 'video') {
    const removedForReplacement = prev.filter((att) => att.type === 'video');
    return {
      attachments: [...prev.filter((att) => att.type !== 'video'), attachment],
      errorMessage: null,
      removedForReplacement,
    };
  }
  return {
    attachments: [...prev, attachment],
    errorMessage: null,
    removedForReplacement: [],
  };
}

function isBlobUri(uri: string | undefined): uri is string {
  return !!uri && uri.startsWith('blob:');
}

function getVideoBlobPreviewUris(attachment: Attachment): string[] {
  if (attachment.type !== 'video') {
    return [];
  }
  const uris = [
    attachment.posterUri,
    attachment.uploadState?.status === 'success'
      ? attachment.uploadState.posterUri
      : undefined,
  ];
  return uris.filter(isBlobUri);
}

function revokeBlobUri(uri: string) {
  if (!isWeb || typeof URL.revokeObjectURL !== 'function') {
    return;
  }
  try {
    URL.revokeObjectURL(uri);
  } catch {
    // Ignore failures when URLs are already revoked.
  }
}

function revokeDetachedVideoPreviewUris(
  previous: Attachment[],
  next: Attachment[]
) {
  const retainedUris = new Set(next.flatMap(getVideoBlobPreviewUris));
  previous.flatMap(getVideoBlobPreviewUris).forEach((uri) => {
    if (!retainedUris.has(uri)) {
      revokeBlobUri(uri);
    }
  });
}

export const AttachmentProvider = ({
  initialAttachments,
  uploadAsset,
  canUpload,
  children,
}: PropsWithChildren<{
  canUpload: boolean;
  uploadAsset: (
    asset: Attachment.UploadIntent,
    isWeb?: boolean
  ) => Promise<void>;
  initialAttachments?: Attachment[];
}>) => {
  const [state, setState] = useState<Attachment[]>(initialAttachments ?? []);
  const [attachmentErrorMessage, setAttachmentErrorMessage] = useState<
    string | null
  >(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const assetUploadStates = useUploadStates(
    useMemo(
      () =>
        state.flatMap((a) => {
          const x = Attachment.toUploadIntent(a);
          if (x.needsUpload) {
            return [Attachment.UploadIntent.extractKey(x)];
          } else {
            return [];
          }
        }),
      [state]
    )
  );

  const attachments = useMemo(() => {
    return state.map((a) => {
      const x = Attachment.toUploadIntent(a);
      if (x.needsUpload) {
        return {
          ...a,
          uploadState: assetUploadStates[Attachment.UploadIntent.extractKey(x)],
        };
      }
      return a;
    });
  }, [assetUploadStates, state]);

  useEffect(() => {
    attachments.forEach((a) => {
      const x = Attachment.toUploadIntent(a);
      if (!x.needsUpload) {
        return;
      }
      if (assetUploadStates[Attachment.UploadIntent.extractKey(x)] != null) {
        // already uploading
        return;
      }
      uploadAsset(x, isWeb);
    });
  }, [attachments, uploadAsset, assetUploadStates]);

  const handleAddAttachment = useCallback((attachment: Attachment) => {
    const next = addAttachmentToState(stateRef.current, attachment);
    setAttachmentErrorMessage(next.errorMessage);
    stateRef.current = next.attachments;
    setState(next.attachments);
    if (next.removedForReplacement.length > 0) {
      revokeDetachedVideoPreviewUris(next.removedForReplacement, next.attachments);
    }
  }, []);

  const handleAttachAssets = useCallback(
    (uploadIntents: Attachment.UploadIntent[]) => {
      let nextAttachments = stateRef.current;
      let nextError: string | null = null;
      let removedForReplacement: Attachment[] = [];

      uploadIntents.forEach((uploadIntent) => {
        const result = addAttachmentToState(
          nextAttachments,
          Attachment.fromUploadIntent(uploadIntent)
        );
        nextAttachments = result.attachments;
        nextError = result.errorMessage;
        removedForReplacement = [
          ...removedForReplacement,
          ...result.removedForReplacement,
        ];
      });

      setAttachmentErrorMessage(nextError);
      stateRef.current = nextAttachments;
      setState(nextAttachments);
      if (removedForReplacement.length > 0) {
        revokeDetachedVideoPreviewUris(removedForReplacement, nextAttachments);
      }
    },
    []
  );

  const handleRemoveAttachment = useCallback((attachment: Attachment) => {
    const removedUploadInfo = Attachment.toUploadIntent(attachment);
    const previousState = stateRef.current;
    const nextState = previousState.filter((a) => {
      // remove identical attachments
      if (a === attachment) {
        return false;
      }

      if (removedUploadInfo.needsUpload) {
        const itemUploadInfo = Attachment.toUploadIntent(a);

        // remove attachments pointing to the same data
        if (
          itemUploadInfo.needsUpload &&
          Attachment.UploadIntent.equivalent(itemUploadInfo, removedUploadInfo)
        ) {
          return false;
        }
      }
      return true;
    });
    revokeDetachedVideoPreviewUris(previousState, nextState);
    stateRef.current = nextState;
    setState(nextState);
    setAttachmentErrorMessage(null);
  }, []);

  const handleClearAttachments = useCallback(() => {
    revokeDetachedVideoPreviewUris(stateRef.current, []);
    stateRef.current = [];
    setState([]);
    setAttachmentErrorMessage(null);
  }, []);

  const handleResetAttachments = useCallback((attachments: Attachment[]) => {
    revokeDetachedVideoPreviewUris(stateRef.current, attachments);
    stateRef.current = attachments;
    setState(attachments);
    setAttachmentErrorMessage(null);
  }, []);

  const handleWaitForUploads = useCallback(
    () => finalizeAttachments(state),
    [state]
  );

  const handleUploadAssets = useCallback(
    async (
      uploadIntents: Attachment.UploadIntent[]
    ): Promise<FinalizedAttachment[]> => {
      const assetUris: Attachment.UploadIntent.Key[] = [];

      const uploadPromises = uploadIntents.map(async (u) => {
        await uploadAsset(u, isWeb);
        assetUris.push(Attachment.UploadIntent.extractKey(u));
        return u;
      });

      const uploadedAssets = await Promise.all(uploadPromises);

      setState((prev) => [
        ...prev,
        ...uploadedAssets.map((asset) => Attachment.fromUploadIntent(asset)),
      ]);

      const uploadStates = await waitForUploads(assetUris);

      const out: FinalizedAttachment[] = [];
      for (const asset of uploadedAssets) {
        const uploadState =
          uploadStates[Attachment.UploadIntent.extractKey(asset)];
        const finalized = Attachment.toSuccessfulFinalizedAttachment(
          Attachment.fromUploadIntent(asset),
          uploadState ?? null
        );
        if (finalized) {
          out.push(finalized);
        }
      }
      return out;
    },
    [uploadAsset]
  );

  return (
    <Context.Provider
      value={{
        attachments,
        attachmentErrorMessage,
        setAttachmentErrorMessage,
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
