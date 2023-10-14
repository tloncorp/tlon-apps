import { useLocation, useParams } from 'react-router';
import cn from 'classnames';
import { AnimatePresence, Transition, motion } from 'framer-motion';
import { ChatStory, ChatWrit, isChatImage } from '@/types/chat';
import { useDismissNavigate } from '@/logic/routing';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import { useChatState } from '@/state/chat';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useEffect, useMemo, useState } from 'react';
import Picker from '@emoji-mart/react';
import useEmoji from '@/state/emoji';
import { useCurrentTheme } from '@/state/local';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatMessage from './ChatMessage';

function ChatOptionsMenu({ writ }: { writ: ChatWrit }) {
  return (
    <motion.div
      id="chatOptionsMenu"
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="relative left-12 mt-3 flex w-48 flex-col rounded-lg border border-gray-300 bg-gray-200 text-lg text-black"
    >
      <button
        className="border-b border-gray-300 py-3"
        onClick={() => {
          /* View Reactions */
        }}
      >
        View Reactions
      </button>
      <button
        className="border-b border-gray-300 py-3"
        onClick={() => {
          /* Start Thread */
        }}
      >
        Start Thread
      </button>
      <button
        className="border-b border-gray-300 py-3"
        onClick={() => {
          /* Copy Link */
        }}
      >
        Copy Link
      </button>
      <button
        className="border-b border-gray-300 py-3"
        onClick={() => {
          /* Delete */
        }}
      >
        Hide
      </button>
      <button
        className="py-3 text-red"
        onClick={() => {
          /* Hide */
        }}
      >
        Delete
      </button>
    </motion.div>
  );
}

function ReactionSheet({
  open,
  onOpenChange,
  onEmojiSelect,
}: {
  open: boolean;
  onOpenChange: (change: boolean) => void;
  onEmojiSelect: (shortcode: string) => void;
}) {
  const { data, load } = useEmoji();
  const currentTheme = useCurrentTheme();
  const emojisPerLine = Math.floor((window.innerWidth - 20) / 48);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const rgbValue = currentTheme === 'light' ? '255, 255, 255' : '0, 0, 0';
    document.documentElement.style.setProperty('--rgb-background', rgbValue);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log(JSON.stringify(mutation, null, 2));
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            console.log('checking node', node.nodeName);
            if (node.nodeName.toLowerCase() === 'em-emoji-picker') {
              console.log('found picker!');
              const picker = node as HTMLDivElement;
              const pickerContainer =
                document.getElementById('pickerContainer');
              console.log('height:', pickerContainer?.clientHeight);
              if (pickerContainer) {
                picker.style.height = `${pickerContainer.clientHeight}px`;
                observer.disconnect();
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [currentTheme]);

  return (
    <WidgetDrawer
      open={open}
      onOpenChange={onOpenChange}
      hideOverlay
      // snapPoints={[0.6, 0.8]} activeSnapPoint={currSnapPoint} setActiveSnapPoint={setSnapPoint}
      className={cn('h-[70vh]')}
    >
      <div
        id="pickerContainer"
        className="mx-4 mt-8 h-full"
        onTouchMove={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Picker
          data={data}
          autoFocus={false}
          previewPosition="none"
          navPosition="none"
          skinTonePosition="none"
          searchPosition="sticky"
          emojiButtonSize={48}
          emojiSize={32}
          perLine={emojisPerLine}
          dynamicWidth={true}
          theme={currentTheme}
          onEmojiSelect={({ shortcodes }: { shortcodes: string }) =>
            onEmojiSelect(shortcodes)
          }
        />
      </div>
    </WidgetDrawer>
  );
}

function QuickReactOption({
  shortcode,
  addFeel,
  transition,
}: {
  shortcode: string;
  addFeel: (code: string) => void;
  transition: Transition;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
      className="flex items-center justify-center p-2"
      onClick={() => addFeel(shortcode)}
    >
      <em-emoji shortcodes={shortcode} size="1.6em" />
    </motion.div>
  );
}

function EmojiQuickReact({
  addFeel,
  sheetOpenChange,
}: {
  addFeel: (shortcode: string) => void;
  sheetOpenChange: (open: boolean) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data, load } = useEmoji();
  const [currSnapPoint, setSnapPoint] = useState<number | string | null>(0.6);

  const pickEmoji = ({ shortcodes }: { shortcodes: string }) => {
    console.log(`picked: ${shortcodes}`);
    addFeel(shortcodes);
  };

  const openPicker = () => {
    sheetOpenChange(true);
    setPickerOpen(true);
  };

  const onOpenChange = (open: boolean) => {
    sheetOpenChange(open);
    setPickerOpen(open);
  };

  useEffect(() => {
    load();
  }, [load]);

  const onFocused = () => {
    console.log('on focus!');
    setSnapPoint(0.8);
  };

  return (
    <>
      <motion.div
        id="quickReactionMenu"
        initial={{ scale: 0, x: 0 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 200, duration: 0.005 }}
        className="mb-3 flex w-[280px] items-center justify-evenly rounded-[24px] bg-gray-200 py-2 px-3"
        onClick={(e) => e.stopPropagation()}
      >
        <QuickReactOption
          transition={{
            delay: 0.05,
            type: 'inertia',
            velocity: 300,
            power: 0.9,
            timeConstant: 150,
            restDelta: 1,
          }}
          shortcode=":+1:"
          addFeel={addFeel}
        />
        <QuickReactOption
          transition={{
            delay: 0.1,
            type: 'inertia',
            velocity: 300,
            power: 0.9,
            timeConstant: 150,
            restDelta: 1,
          }}
          shortcode=":heart:"
          addFeel={addFeel}
        />
        <QuickReactOption
          transition={{
            delay: 0.15,
            type: 'inertia',
            velocity: 300,
            power: 0.9,
            timeConstant: 150,
            restDelta: 1,
          }}
          shortcode=":cyclone:"
          addFeel={addFeel}
        />
        <QuickReactOption
          transition={{
            delay: 0.2,
            type: 'inertia',
            velocity: 300,
            power: 0.9,
            timeConstant: 150,
            restDelta: 1,
          }}
          shortcode=":seedling:"
          addFeel={addFeel}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.25,
            type: 'inertia',
            velocity: 300,
            power: 0.9,
            timeConstant: 150,
            restDelta: 1,
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 p-3"
          onClick={openPicker}
        >
          <ElipsisIcon className="h-8 w-8" />
        </motion.div>
      </motion.div>
      <ReactionSheet
        onEmojiSelect={addFeel}
        open={pickerOpen}
        onOpenChange={onOpenChange}
      />
    </>
  );
}

function getScaleFactor(targetHeight: number, height?: number) {
  let scale = 1;
  if (height) {
    if (height > targetHeight) {
      scale = targetHeight / height;
    }
  }
  return scale;
}

export default function ChatMessageFocus() {
  const params = useParams<{
    ship?: string;
    chName?: string;
    chShip?: string;
  }>();
  const location = useLocation();
  const dismiss = useDismissNavigate();
  const [showOptions, setShowOptions] = useState(true);

  const { writ, height } = location.state as {
    writ: ChatWrit;
    height?: number;
  };
  const { memo, seal } = writ;

  // we need to constrain the height of the focused message, 40% of window height is
  // arbitrarily chosen
  const messageTargetHeight = window.innerHeight * 0.4;
  const scaleFactor = useMemo(
    () => getScaleFactor(messageTargetHeight, height),
    [height, messageTargetHeight]
  );

  // if we scale the message, we need to resize it's relevant container element as well
  // since layout isn't affected by the transform
  const quickReactionElement = document.getElementById('quickReactionMenu');
  const messageContainerHeight =
    scaleFactor !== 1
      ? `${
          messageTargetHeight +
          (quickReactionElement ? quickReactionElement.clientHeight : 0)
        }px`
      : undefined;

  const overlayClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    dismiss();
  };

  const containerClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    dismiss();
  };

  const contentClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
  };

  const handleSheetChange = (open: boolean) => {
    if (open) {
      setShowOptions(false);
    } else {
      dismiss();
    }
  };

  const addFeel = async (shortcode: string) => {
    const whom = params.chShip
      ? `${params.chShip}/${params.chName}`
      : params.ship;
    await useChatState.getState().addFeel(whom!, writ.seal.id, shortcode);
    dismiss();
  };

  if ('story' in memo.content) {
    return (
      <>
        <div
          id="overlay"
          className="z-30 flex h-full w-full bg-black/20 backdrop-blur-md"
          onClick={overlayClick}
        />
        <div
          className="fixed inset-0 z-40 flex select-none flex-col items-center justify-center"
          onClick={containerClick}
        >
          <div
            className="mx-4 flex flex-col items-start  justify-center"
            style={{ height: messageContainerHeight }}
          >
            <div className={!showOptions ? 'invisible' : ''}>
              <EmojiQuickReact
                addFeel={addFeel}
                sheetOpenChange={handleSheetChange}
              />
            </div>
            <motion.div
              initial={{ opacity: 0, x: 0 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: scaleFactor,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
              id="focusedMessage"
              layoutId={seal.id}
              className="rounded-lg bg-white p-4"
              onClick={contentClick}
            >
              <Author className="mb-2" ship={memo.author} />
              <ChatContent
                story={memo.content.story}
                writId={writ.seal.id}
                className="select-auto"
              />
            </motion.div>
          </div>

          <div className={!showOptions ? 'invisible' : ''}>
            <ChatOptionsMenu writ={writ} />
          </div>
        </div>
      </>
    );
  }

  return null;
}
