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
  useSyncExternalStore,
} from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { canAddAttachment } from './attachmentRules';

export type AttachmentState = {
  attachments: Attachment[];
  addAttachment: (attachment: Attachment) => boolean;
  removeAttachment: (attachment: Attachment) => void;
  clearAttachments: () => void;
  resetAttachments: (attachments: Attachment[]) => void;
  waitForAttachmentUploads: () => Promise<FinalizedAttachment[]>;
  attachAssets: (assets: Attachment.UploadIntent[]) => number;
  uploadAssets: (
    assets: Attachment.UploadIntent[],
    options?: { skipAddToAttachmentList?: boolean }
  ) => Promise<FinalizedAttachment[]>;
  runAttachmentTask: <T>(task: () => Promise<T>) => Promise<T>;
  canUpload: boolean;
};

const defaultState: AttachmentState = {
  attachments: [],
  addAttachment: () => false,
  removeAttachment: () => {},
  clearAttachments: () => {},
  resetAttachments: () => {},
  uploadAssets: async () => [],
  attachAssets: () => 0,
  waitForAttachmentUploads: async () => [],
  runAttachmentTask: (task) => task(),
  canUpload: true,
};

const Context = createContext(defaultState);
const PendingAttachmentTasksContext = createContext(false);

type AttachmentScopes = {
  request: (id: string) => () => void;
  get: (id: string) => AttachmentState | undefined;
  publish: (
    id: string,
    state: AttachmentState,
    hasPendingTasks: boolean
  ) => void;
  subscribe: (listener: () => void) => () => void;
  prune: (ids: string[]) => string[];
};
const ScopesContext = createContext<AttachmentScopes | null>(null);

/** Owns attachment lifetimes independently of virtualized composer views. */
export function AttachmentDraftsProvider({
  children,
  canUpload,
  uploadAsset,
}: PropsWithChildren<{
  canUpload: boolean;
  uploadAsset: (
    asset: Attachment.UploadIntent,
    isWeb?: boolean
  ) => Promise<void>;
}>) {
  const [ids, setIds] = useState<string[]>([]);
  const [retentionVersion, setRetentionVersion] = useState(0);
  const [scopes] = useState<AttachmentScopes>(() => {
    const states = new Map<string, AttachmentState>();
    const consumers = new Map<string, number>();
    const retained = new Set<string>();
    const listeners = new Set<() => void>();
    return {
      request: (id) => {
        consumers.set(id, (consumers.get(id) ?? 0) + 1);
        setIds((previous) =>
          previous.includes(id) ? previous : [...previous, id]
        );
        return () => {
          consumers.set(id, (consumers.get(id) ?? 1) - 1);
          setRetentionVersion((version) => version + 1);
        };
      },
      get: (id) => states.get(id),
      publish: (id, state, hasPendingTasks) => {
        states.set(id, state);
        const shouldRetain = state.attachments.length > 0 || hasPendingTasks;
        if (retained.has(id) !== shouldRetain) {
          if (shouldRetain) retained.add(id);
          else retained.delete(id);
          setRetentionVersion((version) => version + 1);
        }
        listeners.forEach((listener) => listener());
      },
      prune: (previous) => {
        const next = previous.filter((id) => {
          if ((consumers.get(id) ?? 0) > 0 || retained.has(id)) return true;
          states.delete(id);
          consumers.delete(id);
          return false;
        });
        return next.length === previous.length ? previous : next;
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
  // Wait for consumers and owners to publish their committed state before
  // collecting empty scopes. A layout switch can release and reacquire the
  // same scope in a single commit.
  useEffect(() => {
    setIds(scopes.prune);
  }, [ids, retentionVersion, scopes]);
  return (
    <ScopesContext.Provider value={scopes}>
      {ids.map((id) => (
        <AttachmentProvider
          key={id}
          canUpload={canUpload}
          uploadAsset={uploadAsset}
        >
          <PublishAttachmentScope id={id} scopes={scopes} />
        </AttachmentProvider>
      ))}
      {children}
    </ScopesContext.Provider>
  );
}

function PublishAttachmentScope({
  id,
  scopes,
}: {
  id: string;
  scopes: AttachmentScopes;
}) {
  const state = useContext(Context);
  const hasPendingTasks = useContext(PendingAttachmentTasksContext);
  useEffect(() => {
    scopes.publish(id, state, hasPendingTasks);
  }, [id, scopes, state, hasPendingTasks]);
  return null;
}

export function ScopedAttachmentProvider({
  id,
  children,
}: PropsWithChildren<{ id: string }>) {
  const scopes = useContext(ScopesContext);
  if (!scopes)
    throw new Error(
      'ScopedAttachmentProvider requires AttachmentDraftsProvider'
    );
  useEffect(() => {
    return scopes.request(id);
  }, [id, scopes]);
  const getSnapshot = useCallback(() => scopes.get(id), [id, scopes]);
  const state = useSyncExternalStore(
    scopes.subscribe,
    getSnapshot,
    getSnapshot
  );
  return state ? (
    <Context.Provider value={state}>{children}</Context.Provider>
  ) : null;
}

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
  const [pendingTasks, setPendingTasks] = useState(0);
  const stateRef = useRef(state);
  const previewUrisToRevokeRef = useRef(new Set<string>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const assetUploadStates = useUploadStates(
    useMemo(
      () =>
        Array.from(
          new Set(
            state.flatMap((a) => {
              const x = Attachment.toUploadIntent(a);
              if (x.needsUpload) {
                return [Attachment.UploadIntent.extractKey(x)];
              } else {
                return [];
              }
            })
          )
        ),
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

  useEffect(() => {
    attachments.flatMap(getVideoBlobPreviewUris).forEach((uri) => {
      previewUrisToRevokeRef.current.add(uri);
    });
  }, [attachments]);

  useEffect(() => {
    return () => {
      previewUrisToRevokeRef.current.forEach(revokeBlobUri);
      previewUrisToRevokeRef.current.clear();
    };
  }, []);

  const handleAddAttachment = useCallback((attachment: Attachment) => {
    const next = addAttachmentToState(stateRef.current, attachment);
    if (next.errorMessage) {
      Alert.alert('Unable to attach', next.errorMessage);
    }
    stateRef.current = next.attachments;
    setState(next.attachments);
    return next.errorMessage == null;
  }, []);

  const handleAttachAssets = useCallback(
    (uploadIntents: Attachment.UploadIntent[]) =>
      uploadIntents.reduce(
        (acceptedCount, uploadIntent) =>
          acceptedCount +
          Number(
            handleAddAttachment(Attachment.fromUploadIntent(uploadIntent))
          ),
        0
      ),
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
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const handleClearAttachments = useCallback(() => {
    stateRef.current = [];
    setState([]);
  }, []);

  const handleResetAttachments = useCallback((attachments: Attachment[]) => {
    stateRef.current = attachments;
    setState(attachments);
  }, []);

  const handleWaitForUploads = useCallback(
    () => finalizeAttachments(state),
    [state]
  );

  // Preparation (paste dimensions, video previews) must keep an otherwise
  // empty draft alive just like an upload does.
  const runAttachmentTask = useCallback(async <T,>(task: () => Promise<T>) => {
    setPendingTasks((count) => count + 1);
    try {
      return await task();
    } finally {
      setPendingTasks((count) => count - 1);
    }
  }, []);

  const handleUploadAssets = useCallback(
    async (
      uploadIntents: Attachment.UploadIntent[],
      {
        skipAddToAttachmentList = false,
      }: { skipAddToAttachmentList?: boolean } = {}
    ): Promise<FinalizedAttachment[]> => {
      return runAttachmentTask(async () => {
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
            ...uploadedAssets.map((asset) =>
              Attachment.fromUploadIntent(asset)
            ),
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
      });
    },
    [uploadAsset, runAttachmentTask]
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
        runAttachmentTask,
      }}
    >
      <PendingAttachmentTasksContext.Provider value={pendingTasks > 0}>
        {children}
      </PendingAttachmentTasksContext.Provider>
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
