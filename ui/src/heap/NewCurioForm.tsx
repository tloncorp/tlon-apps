import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { useForm } from 'react-hook-form';
import LinkIcon from '@/components/icons/LinkIcon';
import { useHeapPerms, useHeapState } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import { canWriteChannel, isValidUrl, nestToFlag } from '@/logic/utils';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups';
import Text16Icon from '@/components/icons/Text16Icon';
import useRequestState from '@/logic/useRequestState';
import { JSONContent } from '@tiptap/react';
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
import { useUploader } from '@/state/storage';
import HeapTextInput from './HeapTextInput';

export default function NewCurioForm() {
  const [inputMode, setInputMode] = useState<CurioInputMode>(LINK);
  const [draftLink, setDraftLink] = useState<string>();
  const [draftText, setDraftText] = useState<JSONContent>();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const displayMode = useHeapDisplayMode(chFlag);
  const isGridMode = displayMode === GRID;
  const isListMode = displayMode === LIST;
  const isLinkMode = inputMode === LINK;
  const isTextMode = inputMode === TEXT;
  const perms = useHeapPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploader = useUploader('new-curio-input');
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

      setDraftLink(undefined);
      reset();
    },
    [chFlag, reset]
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

  return (
    <div className={cn(isGridMode && 'aspect-h-1 aspect-w-1')}>
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
              className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
              disabled={isPending || !isValidInput}
            />
          </form>
        ) : (
          <HeapTextInput
            draft={draftText}
            setDraft={setDraftText}
            flag={chFlag}
            className={cn(
              isListMode ? 'flex-1' : 'h-full w-full overflow-y-hidden'
            )}
            inputClass={cn(
              isListMode
                ? 'border-gray-100 bg-white focus-within:border-gray-300 mb-4 focus:outline-none rounded-tl-none min-h-[60px]'
                : 'border-gray-50 overflow-y-auto focus-within:border-gray-50 bg-gray-50 focus-within:bg-gray-50 focus:outline-none'
            )}
          />
        )}
      </div>
    </div>
  );
}
