import _ from 'lodash';
import { useCallback, useState } from 'react';
import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import {
  useAddPostFeelMutation,
  useAddReplyFeelMutation,
} from '@/state/channel/channel';
import { ReplyCork } from '@/types/channel';
import { useIsMobile } from '@/logic/useMedia';
import { useIsDmOrMultiDm, useThreadParentId } from '@/logic/utils';
import { useAddDMReplyFeelMutation } from '@/state/chat';
import ReplyReaction from './ReplyReaction';

interface ReplyReactionsProps {
  whom: string;
  cork: ReplyCork;
  time: string;
  id?: string;
}

export default function ReplyReactions({
  whom,
  cork,
  time,
  id,
}: ReplyReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const feels = cork.feels ? _.invertBy(cork.feels) : {};
  const isParent = cork['parent-id'] === time;
  const nest = whom;
  const { mutateAsync: addReplyFeel } = useAddReplyFeelMutation();
  const { mutateAsync: addChatFeel } = useAddPostFeelMutation();
  const { mutateAsync: addDmReplyFeel } = useAddDMReplyFeelMutation();
  const isDMorMultiDm = useIsDmOrMultiDm(whom);
  const threardParentId = useThreadParentId(whom);

  const onEmoji = useCallback(
    async (emoji: any) => {
      if (isParent) {
        await addChatFeel({
          nest,
          postId: cork['parent-id'],
          feel: emoji.shortcodes,
        });
      } else if (isDMorMultiDm) {
        await addDmReplyFeel({
          whom,
          writId: threardParentId!,
          replyId: cork.id,
          feel: emoji.shortcodes,
        });
      } else {
        addReplyFeel({
          nest,
          postId: cork['parent-id'],
          replyId: cork.id,
          feel: emoji.shortcodes,
        });
      }
    },
    [
      cork,
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

  if (!cork.feels) {
    return null;
  }

  return (
    <div id={id} className="my-2 flex items-center space-x-2">
      {Object.entries(feels).map(([feel, ships]) => (
        <ReplyReaction
          key={feel}
          replyId={cork.id}
          noteId={cork['parent-id']}
          ships={ships}
          feel={feel}
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
