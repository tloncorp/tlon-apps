import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { intersection } from 'lodash';
import { useForm } from 'react-hook-form';
import LinkIcon from '@/components/icons/LinkIcon';
import {
  useHeapDisplayMode,
  useHeapPerms,
  useHeapState,
} from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import { isValidUrl, nestToFlag } from '@/logic/utils';
import { useRouteGroup, useVessel } from '@/state/groups';
import Text16Icon from '@/components/icons/Text16Icon';
import useRequestState from '@/logic/useRequestState';
import { JSONContent } from '@tiptap/react';
import { GRID, LIST, NewCurioFormSchema } from '@/types/heap';
import HeapTextInput from './HeapTextInput';

const LINK = 'link';
const TEXT = 'text';
type InputMode = typeof LINK | typeof TEXT;

export default function NewCurioForm() {
  const [inputMode, setInputMode] = useState<InputMode>(LINK);
  const [draftLink, setDraftLink] = useState<string>();
  const [draftText, setDraftText] = useState<JSONContent>();
  const flag = useRouteGroup();
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const displayMode = useHeapDisplayMode(flag);
  const isGridMode = displayMode === GRID;
  const isListMode = displayMode === LIST;
  const isLinkMode = inputMode === LINK;
  const isTextMode = inputMode === TEXT;
  const perms = useHeapPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    intersection(perms.writers, vessel.sects).length !== 0;

  const { register, handleSubmit, reset, watch } = useForm<NewCurioFormSchema>({
    defaultValues: {
      content: '',
    },
  });
  const { isPending, setPending, setReady } = useRequestState();
  const onSubmit = useCallback(
    async ({ content }: NewCurioFormSchema) => {
      await useHeapState.getState().addCurio(chFlag, {
        title: null,
        content: [content],
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

  const modeToggle = () => (
    <div className={cn('flex', isGridMode && 'p-1')}>
      <button
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
    <div>
      {isListMode ? modeToggle() : null}
      <div
        className={cn(
          isGridMode ? 'heap-block flex-col' : 'heap-row h-min flex-row',
          'flex cursor-auto'
        )}
      >
        {isGridMode ? modeToggle() : null}
        {isLinkMode ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="relative flex-1 p-1"
          >
            <textarea
              {...register('content')}
              className="h-full w-full resize-none rounded-lg bg-gray-50 p-2 text-gray-800 placeholder:align-text-top placeholder:font-semibold placeholder:text-gray-400"
              placeholder="Paste Link Here"
              onKeyDown={onKeyDown}
              defaultValue={draftLink}
            />
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
          />
        )}
      </div>
    </div>
  );
}
