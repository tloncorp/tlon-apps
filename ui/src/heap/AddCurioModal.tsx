import { useState, useEffect, useCallback, useMemo } from 'react';
import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useAddCurioMutation } from '@/state/heap/heap';
import { JSONContent } from '@tiptap/react';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { createCurioHeart } from '@/logic/heap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
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
  clearDraggedFile: () => void;
}

export default function AddCurioModal({
  open,
  setOpen,
  flag,
  chFlag,
  draggedFile,
  clearDraggedFile,
}: AddCurioModalProps) {
  const [status, setStatus] = useState<'initial' | 'loading' | 'error'>(
    'initial'
  );
  const dropZoneId = useMemo(() => `new-curio-input-${chFlag}`, [chFlag]);
  const uploadKey = useMemo(() => `new-curio-input-${chFlag}`, [chFlag]);
  const [mode, setMode] = useState<'preview' | 'input'>('input');
  const isMobile = useIsMobile();
  const [content, setContent] = useState<JSONContent>();
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const uploader = useUploader(uploadKey);
  const mostRecentFile = uploader?.getMostRecent();
  const { mutate } = useAddCurioMutation();
  const { privacy } = useGroupPrivacy(flag);

  const isEmpty = !content && !draggedFile && !pastedFile;

  const reset = useCallback(() => {
    setMode('input');
    setContent(undefined);
    setPreviewUrl('');
    setStatus('initial');
    if (draggedFile) {
      clearDraggedFile();
    }
    if (pastedFile) {
      setPastedFile(null);
    }
  }, [clearDraggedFile, draggedFile, pastedFile]);

  const onChange = useCallback((editorUpdate: EditorUpdate) => {
    setContent(editorUpdate.json);

    const normalizedText = editorUpdate.text.trim();
    if (canPreview(normalizedText)) {
      setPreviewUrl(normalizedText);
      setMode('preview');
    }
  }, []);

  const onOpenChange = useCallback(
    (newOpenState: boolean) => {
      if (!newOpenState) {
        reset();
        clearDraggedFile();
      }
      setOpen(newOpenState);
    },
    [setOpen, reset, clearDraggedFile]
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
      setPreviewUrl(URL.createObjectURL(file));
      return () => URL.revokeObjectURL(previewUrl);
    }
  }, [draggedFile, pastedFile, previewUrl]);

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      console.error(`Error uploading file`, mostRecentFile.errorMessage);
      setStatus('error');
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
      if (!uploader) return;
      const uploadFile = Array.from(files).find((file) =>
        PASTEABLE_IMAGE_TYPES.includes(file.type)
      );
      if (uploadFile) {
        setPastedFile(uploadFile);
      } else {
        // TODO: warn file type not supported
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
      const localUploader = useFileStore.getState().getUploader(uploadKey);
      const file = draggedFile || pastedFile;
      try {
        if (localUploader) {
          await localUploader.uploadFiles([file!]);
          useFileStore.getState().setUploadType(uploadKey, 'drag');
        } else {
          // TODO: warn that unable
        }
      } catch (e: any) {
        console.error(`Error initiating the upload`);
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

      <section className="align-center mt-6 mb-6 flex w-full justify-center">
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
            disabled={status === 'loading' || isEmpty}
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
