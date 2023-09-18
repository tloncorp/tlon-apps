import { useState, useEffect, useCallback, useMemo } from 'react';
import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useAddCurioMutation } from '@/state/heap/heap';
import { JSONContent } from '@tiptap/react';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { createCurioHeart } from '@/logic/heap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { tipTapToString } from '@/logic/tiptap';
import { useFileStore, useUploader } from '@/state/storage';
import { PASTEABLE_IMAGE_TYPES } from '@/constants';
import NewCurioInput, { EditorUpdate } from './NewCurioInput';
import CurioPreview, { canPreview } from './CurioPreview';

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
  const { mutate } = useAddCurioMutation();
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
      const heart = createCurioHeart(input);

      mutate(
        { flag: chFlag, heart },
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
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setStatus('error');
      setErrorMessage(mostRecentFile.errorMessage);
    }

    if (
      mostRecentFile &&
      mostRecentFile.status === 'success' &&
      mostRecentFile.url
    ) {
      addCurio(mostRecentFile.url);
    }
  }, [mostRecentFile, addCurio]);

  const onPastedFiles = useCallback(
    (files: FileList) => {
      if (!uploader) {
        setErrorMessage('Remote storage must be enabled to upload files.');
        return;
      }
      const uploadFile = Array.from(files).find((file) =>
        PASTEABLE_IMAGE_TYPES.includes(file.type)
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

      <section className="align-center align-center mt-6 mb-6 flex w-full flex-col justify-center">
        {mode === 'input' ? (
          <div className="flex w-full">
            <NewCurioInput
              onChange={onChange}
              onPastedFiles={onPastedFiles}
              uploadKey={uploadKey}
            />
          </div>
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
