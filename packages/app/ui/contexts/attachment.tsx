import { Transcription, VoiceMemoAttachment } from '@tloncorp/shared';
import {
  Attachment,
  FinalizedAttachment,
  ImageAttachment,
  getMd5,
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
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { canAddAttachment } from './attachmentRules';

export type AttachmentState = {
  attachments: Attachment[];
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (attachment: Attachment) => void;
  clearAttachments: () => void;
  resetAttachments: (attachments: Attachment[]) => void;
  waitForAttachmentUploads: () => Promise<FinalizedAttachment[]>;
  attachAssets: (assets: Attachment.UploadIntent[]) => void;
  uploadAssets: (
    assets: Attachment.UploadIntent[],
    options?: { skipAddToAttachmentList?: boolean }
  ) => Promise<FinalizedAttachment[]>;
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

type AddAttachmentResult = {
  attachments: Attachment[];
  errorMessage: string | null;
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
    };
  }
  if (attachment.type === 'video') {
    return {
      attachments: [...prev.filter((att) => att.type !== 'video'), attachment],
      errorMessage: null,
    };
  }
  return {
    attachments: [...prev, attachment],
    errorMessage: null,
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
    const previous = stateRef.current;
    const next = addAttachmentToState(previous, attachment);
    if (next.errorMessage) {
      Alert.alert('Unable to attach', next.errorMessage);
    }
    stateRef.current = next.attachments;
    setState(next.attachments);
    revokeDetachedVideoPreviewUris(previous, next.attachments);
  }, []);

  const handleAttachAssets = useCallback(
    (uploadIntents: Attachment.UploadIntent[]) => {
      uploadIntents.forEach((uploadIntent) =>
        handleAddAttachment(Attachment.fromUploadIntent(uploadIntent))
      );
    },
    [handleAddAttachment]
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
  }, []);

  const handleClearAttachments = useCallback(() => {
    revokeDetachedVideoPreviewUris(stateRef.current, []);
    stateRef.current = [];
    setState([]);
  }, []);

  const handleResetAttachments = useCallback((attachments: Attachment[]) => {
    revokeDetachedVideoPreviewUris(stateRef.current, attachments);
    stateRef.current = attachments;
    setState(attachments);
  }, []);

  const handleWaitForUploads = useCallback(
    () => finalizeAttachments(state),
    [state]
  );

  const handleUploadAssets = useCallback(
    async (
      uploadIntents: Attachment.UploadIntent[],
      {
        skipAddToAttachmentList = false,
      }: { skipAddToAttachmentList?: boolean } = {}
    ): Promise<FinalizedAttachment[]> => {
      const assetUris: Attachment.UploadIntent.Key[] = [];

      const uploadPromises = uploadIntents.map(async (u) => {
        await uploadAsset(u, isWeb);
        assetUris.push(Attachment.UploadIntent.extractKey(u));
        return u;
      });

      const uploadedAssets = await Promise.all(uploadPromises);

      if (!skipAddToAttachmentList) {
        setState((prev) => [
          ...prev,
          ...uploadedAssets.map((asset) => Attachment.fromUploadIntent(asset)),
        ]);
      }

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

  useKickOffVoiceMemoTranscriptions({
    attachments: useMemo(
      () =>
        attachments.filter(
          (x): x is VoiceMemoAttachment => x.type === 'voicememo'
        ),
      [attachments]
    ),
    setTranscription: useCallback(({ attachment, transcription }) => {
      setState((prev) =>
        prev.map((a) => {
          if (a.type === 'voicememo' && a.localUri === attachment.localUri) {
            return { ...a, transcription: transcription ?? undefined };
          } else {
            return a;
          }
        })
      );
    }, []),
  });

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

function useKickOffVoiceMemoTranscriptions({
  attachments,
  setTranscription,
}: {
  attachments: VoiceMemoAttachment[];
  setTranscription: (opts: {
    attachment: VoiceMemoAttachment;
    transcription: string | null;
  }) => void;
}) {
  // set of md5s already kicked off
  const transcriptionTasksRef = useRef(new Set<string>());

  useEffect(() => {
    // kick off transcription of any new voice memo
    const unstartedVoiceMemos = attachments.filter((x) => {
      const md5 = getMd5(x.localUri);
      if (md5 == null) {
        // if we can't get an md5, we have to assume it's new and start a
        // transcription task for it
        return true;
      }
      return !transcriptionTasksRef.current.has(md5);
    });
    if (unstartedVoiceMemos.length === 0) {
      return;
    }

    // we're catching errors internally, no need to catch outer promise
    void (async () => {
      try {
        const result = await Transcription.setupTranscriptionIfNeeded();
        if (!result.canTranscribe) {
          return;
        }

        await Promise.allSettled(
          unstartedVoiceMemos.map(async (att) => {
            // mark task as in-progress (and do last-minute duplicate check)
            const md5 = getMd5(att.localUri);
            if (md5 != null) {
              if (transcriptionTasksRef.current.has(md5)) {
                // already started a task for this attachment, skip it
                return;
              }
              transcriptionTasksRef.current.add(md5);
            }

            const text = await Transcription.transcribeAudioFileWithGlobalCache(
              att.localUri
            );
            setTranscription({
              attachment: att,
              transcription: text,
            });
          })
        );
      } catch (e) {
        console.warn('Failed to get transcription permissions', e);
      }
    })();
  }, [attachments, setTranscription]);
}

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
