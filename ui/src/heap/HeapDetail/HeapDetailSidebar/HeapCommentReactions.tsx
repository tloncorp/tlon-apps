import _ from 'lodash';
import { useCallback, useState } from 'react';
import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useAddCurioFeelMutation } from '@/state/heap/heap';
import { CurioSeal } from '@/types/heap';
import { useIsMobile } from '@/logic/useMedia';
import HeapCommentReaction from './HeapCommentReaction';

interface HeapCommentReactionsProps {
  whom: string;
  seal: CurioSeal;
  time: string;
  replying?: string;
}

export default function HeapCommentReactions({
  whom,
  seal,
  time,
  replying,
}: HeapCommentReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const addFeelMutation = useAddCurioFeelMutation();
  const feels = _.invertBy(seal.feels);

  const onEmoji = useCallback(
    async (emoji: { shortcodes: string }) => {
      addFeelMutation.mutate({
        flag: whom,
        time,
        feel: emoji.shortcodes,
        replying,
      });
      setPickerOpen(false);
    },
    [whom, time, addFeelMutation, replying]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div className="mt-2 flex items-center space-x-2">
      {Object.entries(feels).map(([feel, ships]) => (
        <HeapCommentReaction
          key={feel}
          seal={seal}
          ships={ships}
          feel={feel}
          whom={whom}
          time={time}
          replying={replying}
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
