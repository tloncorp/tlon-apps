import _ from 'lodash';
import { useCallback, useState } from 'react';
import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import {
  useAddNoteFeelMutation,
  useAddQuipFeelMutation,
} from '@/state/channel/channel';
import { Han, QuipCork } from '@/types/channel';
import { useIsMobile } from '@/logic/useMedia';
import QuipReaction from './QuipReaction';

interface QuipReactionsProps {
  whom: string;
  cork: QuipCork;
  time: string;
  noteId: string;
  han: Han;
  id?: string;
}

export default function QuipReactions({
  whom,
  cork,
  time,
  noteId,
  han,
  id,
}: QuipReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const feels = cork.feels ? _.invertBy(cork.feels) : {};
  const isParent = noteId === time;
  const nest = `${han}/${whom}`;
  const { mutateAsync: addQuipFeel } = useAddQuipFeelMutation();
  const { mutateAsync: addChatFeel } = useAddNoteFeelMutation();

  const onEmoji = useCallback(
    async (emoji: any) => {
      if (isParent) {
        await addChatFeel({
          nest,
          noteId,
          feel: emoji.shortcodes,
        });
      } else {
        addQuipFeel({
          nest,
          noteId,
          quipId: time,
          feel: emoji.shortcodes,
        });
      }
    },
    [time, noteId, addQuipFeel, addChatFeel, isParent, nest]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  if (!cork.feels) {
    return null;
  }

  return (
    <div id={id} className="my-2 flex items-center space-x-2">
      {Object.entries(feels).map(([feel, ships]) => (
        <QuipReaction
          han={han}
          key={feel}
          time={time}
          noteId={noteId}
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
