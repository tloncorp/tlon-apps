import ShipName from '@/components/ShipName';
import X16Icon from '@/components/icons/X16Icon';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsDmOrMultiDm } from '@/logic/utils';
import {
  useAddPostReactMutation,
  useDeletePostReactMutation,
} from '@/state/channel/channel';
import { useAddDmReactMutation, useDelDmReactMutation } from '@/state/chat';
import useEmoji from '@/state/emoji';
import { useRouteGroup } from '@/state/groups';
import { PostSeal, ReplySeal } from '@/types/channel';
import * as Tooltip from '@radix-ui/react-tooltip';
import cn from 'classnames';
import React, { useCallback, useEffect } from 'react';

interface ChatReactionProps {
  whom: string;
  seal: PostSeal | ReplySeal;
  react: string;
  ships: string[];
}

export default function ChatReaction({
  whom,
  seal,
  react,
  ships,
}: ChatReactionProps) {
  const groupFlag = useRouteGroup();
  const { privacy } = useGroupPrivacy(groupFlag);
  const isDMOrMultiDM = useIsDmOrMultiDm(whom);
  const { mutate: addChatReact } = useAddPostReactMutation();
  const { mutate: delChatReact } = useDeletePostReactMutation();
  const { mutate: addDmReact } = useAddDmReactMutation();
  const { mutate: delDmReact } = useDelDmReactMutation();
  const nest = `chat/${whom}`;
  const { load } = useEmoji();
  const isMine = ships.includes(window.our);
  const count = ships.length;
  const totalShips = ships.length;

  useEffect(() => {
    load();
  }, [load]);

  const editReact = useCallback(() => {
    if (isMine) {
      if (isDMOrMultiDM) {
        delDmReact({ whom, id: seal.id });
      } else {
        delChatReact({
          nest,
          postId: seal.id,
        });
      }
    } else {
      if (isDMOrMultiDM) {
        addDmReact({ whom, id: seal.id, react });
      } else {
        addChatReact({
          nest,
          postId: seal.id,
          react,
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
    react,
    delChatReact,
    addDmReact,
    delDmReact,
    nest,
    isDMOrMultiDM,
    addChatReact,
  ]);

  return (
    <div>
      {count > 0 && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={editReact}
              className={cn(
                'group relative flex items-center space-x-2 rounded border border-solid border-transparent px-2 py-1 text-sm font-semibold leading-4 text-gray-600',
                {
                  'bg-gray-50 sm:group-one-hover:bg-gray-200': !isMine,
                  'bg-blue-softer sm:group-one-hover:border-blue-soft': isMine,
                }
              )}
              aria-label={
                isMine ? 'Remove reaction' : `Add ${react.replaceAll(':', '')}`
              }
            >
              <em-emoji shortcodes={react} />
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
