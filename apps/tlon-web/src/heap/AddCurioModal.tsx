import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { PASTEABLE_MEDIA_TYPES } from '@/constants';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { createCurioHeart } from '@/logic/heap';
import { tipTapToString } from '@/logic/tiptap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
import { useAddPostMutation } from '@/state/channel/channel';
import { useFileStore, useUploader } from '@/state/storage';
import { JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import CurioPreview, { canPreview } from './CurioPreview';
import NewCurioInput, { EditorUpdate } from './NewCurioInput';

interface AddCurioModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  flag: string;
  chFlag: string;
  draggedFile: File | null;
  clearDragState: () => void;
  dragErrorMessage?: string;
}

export default function AddCurioModal({
  open,
  setOpen,
  flag,
  chFlag,
  draggedFile,
  clearDragState,
  dragErrorMessage,
}: AddCurioModalProps) {
  const nest = `heap/${chFlag}`;
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<'initial' | 'loading' | 'error'>(
    'initial'
  );
  const dropZoneId = useMemo(() => `new-curio-input-${chFlag}`, [chFlag]);
  const uploadKey = useMemo(() => `new-curio-input-${chFlag}`, [chFlag]);
  const [mode, setMode] = useState<'preview' | 'input'>('input');
  const [errorMessage, setErrorMessage] = useState('');
  const [content, setContent] = useState<JSONContent>();
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const uploader = useUploader(uploadKey);
  const mostRecentFile = uploader?.getMostRecent();
  const { mutate } = useAddPostMutation(nest);
  const loading = !!(mostRecentFile && mostRecentFile.status === 'loading');
  const { privacy } = useGroupPrivacy(flag);

  const isEmpty =
    !(content && tipTapToString(content)) && !draggedFile && !pastedFile;
  const errorForDisplay = errorMessage || dragErrorMessage;

  const reset = useCallback(() => {
    setMode('input');
    setContent(undefined);
    setPreviewUrl('');
    setStatus('initial');
    clearDragState();
    setPastedFile(null);
    setErrorMessage('');
  }, [clearDragState]);

  const onChange = useCallback(
    (editorUpdate: EditorUpdate) => {
      setContent(editorUpdate.json);
      setErrorMessage('');
      clearDragState();

      const normalizedText = editorUpdate.text.trim();
      if (canPreview(normalizedText)) {
        setPreviewUrl(normalizedText);
        setMode('preview');
      }
    },
    [clearDragState]
  );

  const onOpenChange = useCallback(
    (newOpenState: boolean) => {
      if (!newOpenState) {
        reset();
        clearDragState();
      }
      setOpen(newOpenState);
    },
    [setOpen, reset, clearDragState]
  );

  const addCurio = useCallback(
    async (input: JSONContent | string) => {
      const heart = await createCurioHeart(input);
      const cacheId = {
        sent: heart.sent,
        author: window.our,
      };

      mutate(
        {
          essay: heart,
          cacheId,
        },
        {
          onSuccess: () => {
            captureGroupsAnalyticsEvent({
              name: 'post_item',
              groupFlag: flag,
              chFlag,
              channelType: 'heap',
              privacy,
            });
          },
          onSettled: () => {
            uploader?.clear();
            setStatus('initial');
            onOpenChange(false);
          },
        }
      );
    },
    [flag, chFlag, mutate, privacy, onOpenChange, uploader]
  );

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    const file = draggedFile || pastedFile;
    if (file) {
      setMode('preview');
      const blobUrl = URL.createObjectURL(file);
      setPreviewUrl(blobUrl);
      return () => URL.revokeObjectURL(blobUrl);
    }
  }, [draggedFile, pastedFile]);

  useEffect(() => {
    async function addUpload() {
      try {
        setStatus('loading');
        await addCurio(mostRecentFile!.url);
      } finally {
        uploader?.clear();
        setStatus('initial');
        onOpenChange(false);
      }
    }
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setStatus('error');
      setErrorMessage(mostRecentFile.errorMessage);
      uploader?.clear();
    }

    if (
      mostRecentFile &&
      mostRecentFile.status === 'success' &&
      mostRecentFile.url
    ) {
      addUpload();
    }
  }, [mostRecentFile, addCurio, onOpenChange, uploader]);

  const onPastedFiles = useCallback(
    (files: FileList) => {
      if (!uploader) {
        setErrorMessage('Remote storage must be enabled to upload files.');
        return;
      }
      const uploadFile = Array.from(files).find((file) =>
        PASTEABLE_MEDIA_TYPES.includes(file.type)
      );

      if (uploadFile) {
        setPastedFile(uploadFile);
      } else if (files.length > 0) {
        setErrorMessage('Only images can be uploaded.');
      }
    },
    [uploader]
  );

  const postBlock = useCallback(async () => {
    if (isEmpty) return;
    setStatus('loading');

    if (mode === 'input') {
      addCurio(content!);
      return;
    }

    if (mode === 'preview' && !draggedFile && !pastedFile) {
      addCurio(previewUrl);
      return;
    }

    if (draggedFile || pastedFile) {
      const file = draggedFile || pastedFile;
      try {
        if (uploader) {
          await uploader.uploadFiles([file!]);
          useFileStore.getState().setUploadType(uploadKey, 'drag');
        }
      } catch (e: any) {
        setErrorMessage('Error initiating file upload.');
        setStatus('error');
      }
    }
  }, [
    draggedFile,
    mode,
    content,
    addCurio,
    isEmpty,
    pastedFile,
    previewUrl,
    uploadKey,
    uploader,
  ]);

  return (
    <Dialog
      id={dropZoneId}
      open={open}
      onOpenChange={() => onOpenChange(false)}
      containerClass="w-[500px] h-full overflow-auto focus-visible:border-none focus:outline-none"
      className="top-32"
    >
      <header className="mb-3 flex items-center">
        <h2 className="text-lg font-bold">Post New Block</h2>
      </header>

      <section className="align-center align-center mb-6 mt-6 flex w-full flex-col justify-center">
        {mode === 'input' ? (
          <NewCurioInput
            onChange={onChange}
            onPastedFiles={onPastedFiles}
            placeholder={
              isMobile
                ? 'Paste a link or type to post text'
                : 'Drag media to upload, or start typing to post text'
            }
          />
        ) : (
          <CurioPreview url={previewUrl} />
        )}
        <div
          hidden={errorForDisplay === ''}
          className="text-md mt-4 pl-2 text-center font-medium text-red"
        >
          {errorForDisplay}
        </div>
      </section>

      <footer className="mt-4 flex items-center justify-between space-x-2">
        {uploader && (
          <button
            className="button"
            disabled={loading || !isEmpty}
            onClick={() => {
              uploader.prompt();
            }}
          >
            {loading ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                <span>Uploading...</span>
              </>
            ) : (
              'Upload'
            )}
          </button>
        )}
        <div className="ml-auto flex items-center space-x-2">
          <button
            className="secondary-button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            onClick={() => postBlock()}
            className="button"
            disabled={['loading', 'error'].includes(status) || isEmpty}
            data-testid="block-post-button"
          >
            {status === 'loading' ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : status === 'error' ? (
              'Error'
            ) : (
              'Post'
            )}
          </button>
        </div>
      </footer>
    </Dialog>
  );
}
