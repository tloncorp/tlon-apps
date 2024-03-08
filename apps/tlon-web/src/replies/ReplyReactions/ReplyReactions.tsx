import { ReplySeal } from '@tloncorp/shared/dist/urbit/channel';
import _ from 'lodash';
import { useCallback, useState } from 'react';

import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useIsMobile } from '@/logic/useMedia';
import { useIsDmOrMultiDm, useThreadParentId } from '@/logic/utils';
import {
  useAddPostReactMutation,
  useAddReplyReactMutation,
} from '@/state/channel/channel';
import { useAddDMReplyReactMutation } from '@/state/chat';

import ReplyReaction from './ReplyReaction';

interface ReplyReactionsProps {
  whom: string;
  seal: ReplySeal;
  time: string;
  id?: string;
}

export default function ReplyReactions({
  whom,
  seal,
  time,
  id,
}: ReplyReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const reacts = seal.reacts ? _.invertBy(seal.reacts) : {};
  const isParent = seal['parent-id'] === time;
  const nest = whom;
  const { mutateAsync: addReplyFeel } = useAddReplyReactMutation();
  const { mutateAsync: addChatFeel } = useAddPostReactMutation();
  const { mutateAsync: addDmReplyFeel } = useAddDMReplyReactMutation();
  const isDMorMultiDm = useIsDmOrMultiDm(whom);
  const threardParentId = useThreadParentId(whom);

  const onEmoji = useCallback(
    async (emoji: any) => {
      if (isParent) {
        await addChatFeel({
          nest,
          postId: seal['parent-id'],
          react: emoji.shortcodes,
        });
      } else if (isDMorMultiDm) {
        await addDmReplyFeel({
          whom,
          writId: threardParentId!,
          replyId: seal.id,
          react: emoji.shortcodes,
        });
      } else {
        addReplyFeel({
          nest,
          postId: seal['parent-id'],
          replyId: seal.id,
          react: emoji.shortcodes,
        });
      }
    },
    [
      seal,
      addReplyFeel,
      addChatFeel,
      isParent,
      nest,
      whom,
      isDMorMultiDm,
      addDmReplyFeel,
      threardParentId,
    ]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  if (!seal.reacts) {
    return null;
  }

  return (
    <div id={id} className="my-2 flex items-center space-x-2">
      {Object.entries(reacts).map(([react, ships]) => (
        <ReplyReaction
          key={react}
          replyId={seal.id}
          noteId={seal['parent-id']}
          ships={ships}
          react={react}
          whom={whom}
        />
      ))}
      {!isMobile && (
        <EmojiPicker
          open={pickerOpen}
          setOpen={setPickerOpen}
          onEmojiSelect={onEmoji}
        >
          <button
            className="appearance-none border-none bg-transparent"
            onClick={openPicker}
            aria-label="Add Reaction"
          >
            <AddReactIcon className="h-6 w-6 text-gray-400" />
          </button>
        </EmojiPicker>
      )}
    </div>
  );
}
