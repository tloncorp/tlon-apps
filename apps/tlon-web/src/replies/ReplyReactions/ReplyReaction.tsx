import * as Tooltip from '@radix-ui/react-tooltip';
import cn from 'classnames';
import { useCallback, useEffect } from 'react';

import ShipName from '@/components/ShipName';
import X16Icon from '@/components/icons/X16Icon';
import { useIsDmOrMultiDm, useThreadParentId } from '@/logic/utils';
import {
  useAddPostReactMutation,
  useAddReplyReactMutation,
  useDeletePostReactMutation,
  useDeleteReplyReactMutation,
} from '@/state/channel/channel';
import {
  useAddDMReplyReactMutation,
  useDeleteDMReplyReactMutation,
} from '@/state/chat';
import useEmoji from '@/state/emoji';

interface ReplyReactionProps {
  whom: string;
  react: string;
  ships: string[];
  replyId: string;
  noteId: string;
}

export default function ReplyReaction({
  whom,
  react,
  ships,
  replyId,
  noteId,
}: ReplyReactionProps) {
  const { load } = useEmoji();
  const isMine = ships.includes(window.our);
  const count = ships.length;
  const isParent = noteId === replyId;
  const whomParts = whom.split('/');
  const alreadyHaveHan =
    whomParts[0] === 'chat' ||
    whomParts[0] === 'heap' ||
    whomParts[0] === 'diary';
  const nest = alreadyHaveHan ? whom : `chat/${whom}`;
  const { mutateAsync: addReplyFeel } = useAddReplyReactMutation();
  const { mutateAsync: addChatFeel } = useAddPostReactMutation();
  const { mutateAsync: delReplyFeel } = useDeleteReplyReactMutation();
  const { mutateAsync: delChatFeel } = useDeletePostReactMutation();
  const { mutateAsync: addDmReplyFeel } = useAddDMReplyReactMutation();
  const { mutateAsync: delDmReplyFeel } = useDeleteDMReplyReactMutation();
  const isDMorMultiDm = useIsDmOrMultiDm(whom);
  const threardParentId = useThreadParentId(whom);

  useEffect(() => {
    load();
  }, [load]);

  const editReact = useCallback(async () => {
    if (isMine) {
      if (isParent) {
        await delChatFeel({ nest, postId: noteId });
      } else if (isDMorMultiDm) {
        await delDmReplyFeel({
          whom,
          writId: threardParentId!,
          replyId,
        });
      } else {
        await delReplyFeel({ nest, postId: noteId, replyId });
      }
    } else if (isParent) {
      await addChatFeel({ nest, postId: noteId, react });
    } else if (isDMorMultiDm) {
      await addDmReplyFeel({
        whom,
        writId: threardParentId!,
        replyId,
        react,
      });
    } else {
      await addReplyFeel({ nest, postId: noteId, replyId, react });
    }
  }, [
    isMine,
    react,
    noteId,
    replyId,
    addReplyFeel,
    delReplyFeel,
    delChatFeel,
    nest,
    isParent,
    addChatFeel,
    whom,
    isDMorMultiDm,
    addDmReplyFeel,
    threardParentId,
    delDmReplyFeel,
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
                      <div key={ship}>
                        <ShipName name={ship} showAlias />
                        {i + 1 === ships.length ? '' : ', '}
                      </div>
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
