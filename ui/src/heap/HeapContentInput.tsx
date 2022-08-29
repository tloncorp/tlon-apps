import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import LinkIcon from '@/components/icons/LinkIcon';
import Text16Icon from '@/components/icons/Text16Icon';
import { useChannelFlag } from '@/hooks';
import { isLinkCurio, isValidUrl } from '@/logic/utils';
import { useHeapDisplayMode } from '@/state/heap/heap';
import {
  CurioFormSchema,
  CurioInputMode,
  EditCurioFormSchema,
  GRID,
  LINK,
  LIST,
  NewCurioFormSchema,
  TEXT,
} from '@/types/heap';
import { SubmitHandler, useFormContext } from 'react-hook-form';
import { JSONContent } from '@tiptap/core';
import HeapTextInput from './HeapTextInput';
import useCurioFromParams from './useCurioFromParams';

interface HeapContentInputProps {
  submissible?: boolean;
  submitting?: boolean;
  onSubmit:
    | SubmitHandler<NewCurioFormSchema>
    | SubmitHandler<EditCurioFormSchema>;
}

export default function HeapContentInput({
  submissible = false,
  submitting = false,
  onSubmit,
}: HeapContentInputProps) {
  const [draftLink, setDraftLink] = useState<string>();
  const [draftText, setDraftText] = useState<JSONContent>();
  const { register, watch, getValues } = useFormContext<CurioFormSchema>();
  const { curio } = useCurioFromParams();
  const defaultInputMode =
    curio && !isLinkCurio(curio.heart.content) ? TEXT : LINK;
  const [inputMode, setInputMode] = useState<CurioInputMode>(defaultInputMode);
  const chFlag = useChannelFlag() ?? '';
  const displayMode = useHeapDisplayMode(chFlag);
  const isGridMode = displayMode === GRID;
  const isLinkMode = inputMode === LINK;
  const isListMode = displayMode === LIST;
  const isTextMode = inputMode === TEXT;
  const watchedContent = watch('content');
  const isValidInput = isLinkMode
    ? isValidUrl(watchedContent)
    : watchedContent.length > 0;

  // For Link mode, prevent newline entry + allow submit with Enter
  const onKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        if (submitting || !submissible || !isValidInput) {
          return;
        }

        // @ts-expect-error TODO
        await onSubmit(getValues());
      }
    },
    [getValues, isValidInput, onSubmit, submissible, submitting]
  );

  const modeToggle = () => (
    <div className={cn('flex', isGridMode && 'p-1')}>
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

  useEffect(() => {
    if (watchedContent) {
      setDraftLink(watchedContent.toString());
    }
  }, [watchedContent]);

  return (
    <>
      {isListMode ? modeToggle() : null}
      <div
        className={cn(
          isGridMode ? 'heap-block flex-col' : 'heap-row h-min flex-row',
          'flex cursor-auto'
        )}
      >
        {isGridMode ? modeToggle() : null}
        {isLinkMode ? (
          <>
            <textarea
              {...register('content')}
              className="h-full w-full resize-none rounded-lg bg-gray-50 p-2 text-gray-800 placeholder:align-text-top placeholder:font-semibold placeholder:text-gray-400"
              placeholder="Paste Link Here"
              onKeyDown={onKeyDown}
              defaultValue={draftLink}
            />
            {submissible ? (
              <input
                value={submitting ? 'Posting...' : 'Post'}
                type="submit"
                className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
                disabled={submitting || !isValidInput}
              />
            ) : null}
          </>
        ) : (
          <HeapTextInput
            draft={draftText}
            setDraft={setDraftText}
            flag={chFlag}
          />
        )}
      </div>
    </>
  );
}
