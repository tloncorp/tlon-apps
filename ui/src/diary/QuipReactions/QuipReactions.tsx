import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useAddQuipFeelMutation } from '@/state/channel/channel';
import { Han, QuipCork } from '@/types/channel';
import _ from 'lodash';
import { useCallback, useState } from 'react';
import { useIsMobile } from '@/logic/useMedia';
import QuipReaction from './QuipReaction';

interface QuipReactionsProps {
  whom: string;
  cork: QuipCork;
  time: string;
  noteId: string;
  han: Han;
}

export default function QuipReactions({
  whom,
  cork,
  time,
  noteId,
  han,
}: QuipReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const feels = _.invertBy(cork.feels);
  const { mutateAsync: addQuipFeel } = useAddQuipFeelMutation();

  const onEmoji = useCallback(
    async (emoji: any) => {
      addQuipFeel({
        nest: `${han}/${whom}`,
        noteId,
        quipId: time,
        feel: emoji.shortcodes,
      });
    },
    [han, whom, time, noteId, addQuipFeel]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div className="my-2 flex items-center space-x-2">
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
