import cn from 'classnames';
import React, { useCallback, useEffect } from 'react';
import _ from 'lodash';
import f from 'lodash/fp';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChatSeal } from '@/types/chat';
import { useChatState } from '@/state/chat';
import useEmoji from '@/state/emoji';
import X16Icon from '@/components/icons/X16Icon';
import ShipName from '@/components/ShipName';

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
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={0}>
            <Tooltip.Trigger>
              <button
                onClick={editFeel}
                className={cn(
                  'group relative flex items-center space-x-2 rounded border border-solid border-transparent bg-gray-50 px-2 py-1 text-sm font-semibold leading-4 text-gray-600 group-one-hover:border-gray-100',
                  isMine && 'bg-blue-softer group-one-hover:border-blue-soft'
                )}
                aria-label={
                  isMine ? 'Remove reaction' : `Add ${feel.replaceAll(':', '')}`
                }
              >
                <em-emoji shortcodes={feel} />
                <span className={cn(isMine && 'group-hover:opacity-0')}>
                  {count}
                </span>
                <X16Icon
                  className={cn(
                    'absolute right-1 hidden h-3 w-3',
                    isMine && 'group-hover:inline'
                  )}
                />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content asChild>
                <div className="pointer-events-none z-20 justify-items-center rounded">
                  <div className="z-[100] w-fit cursor-none rounded bg-gray-400 px-4 py-2">
                    <label className="whitespace-nowrap font-semibold text-white">
                      {ships.map((ship, i) => (
                        <>
                          <ShipName key={ship} name={ship} showAlias />
                          {i + 1 === ships.length ? '' : ', '}
                        </>
                      ))}
                    </label>
                  </div>
                  <Tooltip.Arrow asChild>
                    <svg
                      width="17"
                      height="8"
                      viewBox="0 0 17 8"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.5 0L0.5 0L7.08579 6.58579C7.86684 7.36684 9.13316 7.36684 9.91421 6.58579L16.5 0Z"
                        // fill="#999999"
                        className="fill-gray-400"
                      />
                    </svg>
                  </Tooltip.Arrow>
                </div>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </div>
  );
}
