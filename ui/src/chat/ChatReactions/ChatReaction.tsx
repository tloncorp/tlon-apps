import cn from 'classnames';
import React, { useCallback, useEffect } from 'react';
import _ from 'lodash';
import f from 'lodash/fp';
import { ChatSeal } from '@/types/chat';
import { useChatState } from '@/state/chat';
import useEmoji from '@/state/emoji';
import X16Icon from '@/components/icons/X16Icon';

interface ChatReactionProps {
  whom: string;
  seal: ChatSeal;
  feel: string;
  ships: string[];
}

export default function ChatReaction({
  whom,
  seal,
  feel,
  ships,
}: ChatReactionProps) {
  const { load } = useEmoji();
  const isMine = ships.includes(window.our);
  const count = ships.length;

  useEffect(() => {
    load();
  }, [load]);

  const editFeel = useCallback(() => {
    if (isMine) {
      useChatState.getState().delFeel(whom, seal.id);
    } else {
      useChatState.getState().addFeel(whom, seal.id, feel);
    }
  }, [isMine, whom, seal, feel]);

  return (
    <div>
      {count > 0 && (
        <button
          onClick={editFeel}
          className="group relative flex items-center space-x-2 rounded border border-solid border-transparent bg-gray-50 px-2 py-1 text-sm font-semibold leading-4 text-gray-600 group-one-hover:border-gray-100"
          aria-label={
            isMine ? 'Remove reaction' : `Add ${feel.replaceAll(':', '')}`
          }
        >
          <em-emoji shortcodes={feel} />
          <span className={cn(isMine && 'group-hover:opacity-0')}>{count}</span>
          <X16Icon
            className={cn(
              'absolute right-1 hidden h-3 w-3',
              isMine && 'group-hover:inline'
            )}
          />
        </button>
      )}
    </div>
  );
}
