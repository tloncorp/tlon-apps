import cn from 'classnames';
import React, { useCallback, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChatSeal } from '@/types/chat';
import { useChatState, useIsDmOrMultiDm } from '@/state/chat';
import useEmoji from '@/state/emoji';
import X16Icon from '@/components/icons/X16Icon';
import ShipName from '@/components/ShipName';
import { useRouteGroup } from '@/state/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import {
  useAddNoteFeelMutation,
  useAddQuipFeelMutation,
  useDeleteNoteFeelMutation,
  useDeleteQuipFeelMutation,
} from '@/state/channel/channel';
import { useIsInThread, useThreadParentId } from '@/logic/utils';

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
  const inThread = useIsInThread();
  const threadParentId = useThreadParentId();
  const groupFlag = useRouteGroup();
  const { privacy } = useGroupPrivacy(groupFlag);
  const isDMOrMultiDM = useIsDmOrMultiDm(whom);
  const { mutate: addChatFeel } = useAddNoteFeelMutation();
  const { mutate: delChatFeel } = useDeleteNoteFeelMutation();
  const { mutate: addQuipFeel } = useAddQuipFeelMutation();
  const { mutate: delQuipFeel } = useDeleteQuipFeelMutation();
  const nest = `chat/${whom}`;
  const { load } = useEmoji();
  const isMine = ships.includes(window.our);
  const count = ships.length;
  const totalShips = ships.length;

  useEffect(() => {
    load();
  }, [load]);

  const editFeel = useCallback(() => {
    if (isMine) {
      if (isDMOrMultiDM) {
        useChatState.getState().delFeelToDm(whom, seal.id);
      } else if (inThread) {
        delQuipFeel({
          nest,
          noteId: threadParentId!,
          quipId: seal.id,
        });
      } else {
        delChatFeel({
          nest,
          noteId: seal.id,
        });
      }
    } else {
      if (isDMOrMultiDM) {
        useChatState.getState().addFeelToDm(whom, seal.id, feel);
      } else if (inThread) {
        addQuipFeel({
          nest,
          noteId: threadParentId!,
          quipId: seal.id,
          feel,
        });
      } else {
        addChatFeel({
          nest,
          noteId: seal.id,
          feel,
        });
      }
      captureGroupsAnalyticsEvent({
        name: 'react_item',
        groupFlag,
        chFlag: whom,
        channelType: 'chat',
        privacy,
      });
    }
  }, [
    isMine,
    whom,
    groupFlag,
    privacy,
    seal,
    feel,
    inThread,
    threadParentId,
    delChatFeel,
    delQuipFeel,
    nest,
    isDMOrMultiDM,
    addChatFeel,
    addQuipFeel,
  ]);

  return (
    <div>
      {count > 0 && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={editFeel}
              className={cn(
                'group relative flex items-center space-x-2 rounded border border-solid border-transparent px-2 py-1 text-sm font-semibold leading-4 text-gray-600',
                {
                  'bg-gray-50 sm:group-one-hover:bg-gray-200': !isMine,
                  'bg-blue-softer sm:group-one-hover:border-blue-soft': isMine,
                }
              )}
              aria-label={
                isMine ? 'Remove reaction' : `Add ${feel.replaceAll(':', '')}`
              }
            >
              <em-emoji shortcodes={feel} />
              <span className={cn(isMine && 'sm:group-hover:opacity-0')}>
                {count}
              </span>
              <X16Icon
                className={cn(
                  'absolute right-1 hidden h-3 w-3',
                  isMine && 'sm:group-hover:inline'
                )}
              />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content asChild>
              <div className="pointer-events-none z-20 justify-items-center rounded">
                <div className="z-[100] w-fit cursor-none rounded bg-gray-400 px-4 py-2">
                  <label className="whitespace-nowrap font-semibold text-white">
                    {ships
                      .filter((_ship, i) => i < 3)
                      .map((ship, i) => (
                        <span key={`${ship}-${i}`}>
                          <ShipName name={ship} showAlias />
                          {i + 1 === ships.length ? '' : ', '}
                        </span>
                      ))}
                    {totalShips > 3 && (
                      <span>
                        {' '}
                        and {totalShips - 3}{' '}
                        {totalShips === 4 ? 'other' : 'others'}
                      </span>
                    )}
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
      )}
    </div>
  );
}
