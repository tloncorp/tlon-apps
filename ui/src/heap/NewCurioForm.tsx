import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { useForm } from 'react-hook-form';
import { JSONContent } from '@tiptap/react';
import LinkIcon from '@/components/icons/LinkIcon';
import { useHeapPerms, useHeapState } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import { canWriteChannel, isValidUrl, nestToFlag } from '@/logic/utils';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups';
import Text16Icon from '@/components/icons/Text16Icon';
import useRequestState from '@/logic/useRequestState';
import {
  CurioInputMode,
  GRID,
  LINK,
  LIST,
  NewCurioFormSchema,
  TEXT,
} from '@/types/heap';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';
import { useHeapDisplayMode } from '@/state/settings';
import { useFileStore, useUploader } from '@/state/storage';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { PASTEABLE_IMAGE_TYPES } from '@/constants';
import HeapTextInput from './HeapTextInput';

export default function NewCurioForm() {
  const [inputMode, setInputMode] = useState<CurioInputMode>(LINK);
  const [draftLink, setDraftLink] = useState<string>();
  const [draftText, setDraftText] = useState<JSONContent>();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const dropZoneId = `new-curio-input-${chFlag}`;
  const { isDragging, isOver, droppedFiles } = useDragAndDrop(dropZoneId);
  const displayMode = useHeapDisplayMode(chFlag);
  const isGridMode = displayMode === GRID;
  const isListMode = displayMode === LIST;
  const isLinkMode = inputMode === LINK;
  const isTextMode = inputMode === TEXT;
  const perms = useHeapPerms(chFlag);
  const vessel = useVessel(flag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadKey = `${chFlag}-new-curio-input`;
  const uploader = useUploader(uploadKey);
  const mostRecentFile = uploader?.getMostRecent();
  const { register, handleSubmit, reset, watch, setValue } =
    useForm<NewCurioFormSchema>({
      defaultValues: {
        content: '',
      },
    });

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setUploadError(mostRecentFile.errorMessage);
    }

    if (mostRecentFile && mostRecentFile.status === 'success') {
      setValue('content', mostRecentFile.url, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [mostRecentFile, setValue]);

  const { isPending, setPending, setReady } = useRequestState();
  const onSubmit = useCallback(
    async ({ content }: NewCurioFormSchema) => {
      await useHeapState.getState().addCurio(chFlag, {
        title: '',
        content: { block: [], inline: [{ link: { href: content, content } }] },
        author: window.our,
        sent: Date.now(),
        replying: null,
      });
      captureGroupsAnalyticsEvent({
        name: 'post_item',
        groupFlag: flag,
        chFlag,
        channelType: 'heap',
        privacy,
      });

      setDraftLink(undefined);
      uploader?.clear();
      reset();
    },
    [flag, chFlag, privacy, reset, uploader]
  );

  const watchedContent = watch('content');
  const isValidInput = isValidUrl(watchedContent);

  // For Link mode, prevent newline entry + allow submit with Enter
  const onKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        if (isPending) {
          return;
        }

        if (isValidInput) {
          setPending();
          await handleSubmit(onSubmit)();
          setReady();
        }
      }
    },
    [handleSubmit, isPending, isValidInput, onSubmit, setPending, setReady]
  );

  const handleDrop = useCallback(
    (fileList: FileList) => {
      const localUploader = useFileStore.getState().getUploader(uploadKey);

      if (
        localUploader &&
        Array.from(fileList).some((f) => PASTEABLE_IMAGE_TYPES.includes(f.type))
      ) {
        localUploader.uploadFiles(fileList);
        useFileStore.getState().setUploadType(uploadKey, 'drag');
        return true;
      }

      return false;
    },
    [uploadKey]
  );

  useEffect(() => {
    if (droppedFiles && droppedFiles[dropZoneId]) {
      handleDrop(droppedFiles[dropZoneId]);
    }
  }, [droppedFiles, handleDrop, dropZoneId]);

  useEffect(() => {
    if (watchedContent) {
      setDraftLink(watchedContent);
    }
  }, [watchedContent]);

  if (!canWrite) {
    return null;
  }

  const modeToggle = (className?: string) => (
    <div className={cn('flex', className)}>
      <button
        type="button"
        className={cn(
          isLinkMode ? 'button' : 'secondary-button',
          isListMode && 'max-w-[120px] rounded-bl-none',
          'flex-1 rounded-r-none'
        )}
        onClick={() => setInputMode(LINK)}
      >
        <LinkIcon className="mr-1 h-4 w-4" />
        <span className="ml-1">Link</span>
      </button>
      <button
        type="button"
        className={cn(
          isTextMode ? 'button' : 'secondary-button',
          isListMode && 'max-w-[120px] rounded-br-none',
          'flex-1 rounded-l-none'
        )}
        onClick={() => setInputMode(TEXT)}
      >
        <Text16Icon className="mr-1 h-4 w-4" />
        <span className="ml-1">Text</span>
      </button>
    </div>
  );

  if (isGridMode && isDragging && isOver) {
    return (
      <div id={dropZoneId} className="virtuoso-grid-item aspect-h-1 aspect-w-1">
        <div
          id={dropZoneId}
          className="heap-block flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 p-1"
        >
          <div id={dropZoneId} className="text-sm font-bold">
            Drop Attachments Here
          </div>
        </div>
      </div>
    );
  }

  if (isListMode && isDragging && isOver) {
    return (
      <div id={dropZoneId} className="virtuoso-list-item">
        <div
          id={dropZoneId}
          className="heap-row flex h-[108px] items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 p-1"
        >
          <div id={dropZoneId} className="text-sm font-bold">
            Drop Attachments Here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      // sometimes a race condition causes the dropzone to be removed before the drop event fires
      id={dropZoneId}
      className={cn(isGridMode && 'virtuoso-grid-item aspect-h-1 aspect-w-1')}
    >
      {isListMode ? modeToggle() : null}
      <div
        className={cn(
          isGridMode ? 'heap-block flex-col p-1' : 'heap-row h-min flex-row',
          'flex cursor-auto'
        )}
      >
        {isGridMode ? modeToggle('mb-1') : null}
        {isLinkMode ? (
          <form onSubmit={handleSubmit(onSubmit)} className="relative flex-1">
            <textarea
              {...register('content')}
              className={cn(
                'mb-4 h-full w-full resize-none rounded-lg border-2 py-1 px-2 leading-5 text-gray-800 placeholder:align-text-top placeholder:font-semibold placeholder:text-gray-400 focus:outline-none',
                isListMode
                  ? 'min-h-[60px] rounded-tl-none border-gray-100 bg-white align-middle focus:border-gray-300'
                  : 'border-gray-50 bg-gray-50'
              )}
              placeholder="Paste Link Here"
              onKeyDown={onKeyDown}
              defaultValue={draftLink}
            />
            {uploader ? (
              <button
                title={'Upload an image'}
                className="button absolute bottom-3 left-3 whitespace-nowrap rounded-md px-2 py-1"
                aria-label="Add attachment"
                onClick={(e) => {
                  e.preventDefault();
                  uploader.prompt();
                }}
              >
                {mostRecentFile && mostRecentFile.status === 'loading' ? (
                  <LoadingSpinner secondary="black" className="h-4 w-4" />
                ) : (
                  'Upload Image'
                )}
              </button>
            ) : null}
            {uploadError ? (
              <div className="absolute mr-2">
                <UploadErrorPopover
                  errorMessage={uploadError}
                  setUploadError={setUploadError}
                />
              </div>
            ) : null}
            <input
              value={isPending ? 'Posting...' : 'Post'}
              type="submit"
              className="button absolute bottom-3 right-3 cursor-pointer rounded-md px-2 py-1"
              disabled={isPending || !isValidInput}
            />
          </form>
        ) : (
          <HeapTextInput
            draft={draftText}
            setDraft={setDraftText}
            flag={chFlag}
            groupFlag={flag}
            className={cn(
              isListMode ? 'flex-1' : 'h-full w-full overflow-y-hidden'
            )}
            inputClass={cn(
              isListMode
                ? 'border-gray-100 bg-white focus-within:border-gray-300 mb-12 focus:outline-none rounded-tl-none min-h-[60px]'
                : 'overflow-y-auto focus-within:border-white focus:outline-none bg-transparent mb-12'
            )}
          />
        )}
      </div>
    </div>
  );
}
