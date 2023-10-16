import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import cn from 'classnames';
import { Transition, motion } from 'framer-motion';
import { ChatWrit } from '@/types/chat';
import { useDismissNavigate } from '@/logic/routing';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import ConfirmationModal from '@/components/ConfirmationModal';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ReactionDetails from '../ChatReactions/ReactionDetails';
import useChatMessage, { ChatMessage } from './useChatMessageActions';
import ReactionSheet from '../ChatReactions/EmojiPickerSheet';

interface ChatOptionsMenuProps {
  chatMessage: ChatMessage;
  showAllReactions: () => void;
  initiateDelete: () => void;
}
function ChatOptionsMenu({
  chatMessage,
  showAllReactions,
  initiateDelete,
}: ChatOptionsMenuProps) {
  const dismiss = useDismissNavigate();

  const handleCopy = () => {
    chatMessage.actions.copy();
    setTimeout(() => {
      dismiss();
    }, 1000);
  };

  const handleHideToggle = () => {
    if (chatMessage.state.isHidden) {
      chatMessage.actions.show();
    } else {
      chatMessage.actions.hide();
    }
    dismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      onClick={(e) => e.stopPropagation()}
      className="flex w-48 flex-col rounded-lg border border-gray-200 bg-gray-100 text-lg"
    >
      <button
        className="border-b border-gray-200 py-3"
        onClick={showAllReactions}
      >
        View Reactions
      </button>
      {chatMessage.context.canReply && (
        <button
          className="border-b border-gray-200 py-3"
          onClick={chatMessage.actions.reply}
        >
          Reply
        </button>
      )}
      {!chatMessage.context.inThread && (
        <button
          className="border-b border-gray-200 py-3"
          onClick={chatMessage.actions.goToThread}
        >
          Start Thread
        </button>
      )}
      {chatMessage.context.canCopy && (
        <button className="border-b border-gray-200 py-3" onClick={handleCopy}>
          {chatMessage.state.didCopy ? 'Copied!' : 'Copy Link'}
        </button>
      )}
      {chatMessage.context.canHide && (
        <button
          className="border-b border-gray-200 py-3"
          onClick={handleHideToggle}
        >
          {chatMessage.state.isHidden ? 'Show Message' : 'Hide Message'}
        </button>
      )}
      {chatMessage.context.canDelete && (
        <button className="py-3 text-red" onClick={initiateDelete}>
          Delete
        </button>
      )}
    </motion.div>
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
  openPicker,
}: {
  addFeel: (shortcode: string) => void;
  openPicker: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0, x: 0 }}
      animate={{ scale: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 200, duration: 0.005 }}
      className="flex w-[280px] items-center justify-evenly rounded-[24px] bg-white py-2 px-3"
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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 p-3"
        onClick={openPicker}
      >
        <ElipsisIcon className="h-8 w-8" />
      </motion.div>
    </motion.div>
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
    name?: string;
    chShip?: string;
    chName?: string;
    idShip?: string;
    idTime?: string;
  }>();
  const location = useLocation();
  const dismiss = useDismissNavigate();

  const [showPicker, setShowPicker] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showOptions = !showPicker && !showAllReactions && !showDeleteConfirm;
  const showMessage = !showDeleteConfirm;

  const { writ, height } = location.state as {
    writ: ChatWrit;
    height?: number;
  };
  const { memo, seal } = writ;
  const chatMessage = useChatMessage(writ);

  // we need to constrain the height of the focused message, 40% of window height is
  // arbitrarily chosen
  const messageTargetHeight = Math.round(window.innerHeight * 0.3);
  const scaleFactor = useMemo(
    () => getScaleFactor(messageTargetHeight, height),
    [height, messageTargetHeight]
  );

  // if we scale the message, the layout doesn't update automatically, so we
  // need to measure and position manually
  const quickReactionEl = document.getElementById('quickReactionMenu');
  const messageContainerEl = document.getElementById('focusedMessageContainer');
  const authorEl = document.getElementById('author');
  const messageContentEl = document.getElementById('focusedMessageContent');
  const optionsMenuEl = document.getElementById('chatOptionsMenu');

  let messageContainerHeight = '0px';
  let messageContentTop = '0px';
  if (authorEl && messageContentEl && messageContainerEl && scaleFactor !== 1) {
    const contentRec = messageContentEl!.getBoundingClientRect();
    messageContainerHeight = `${Math.round(
      contentRec.bottom - contentRec.top + authorEl.clientHeight
    )}px`;
    messageContentTop = `${authorEl.clientHeight}px`;
  }

  const focusedMessageMargin = 14;
  let quickReactTop = '0px';
  let quickReactLeft = '18px';
  if (messageContainerEl && quickReactionEl) {
    const fmRect = messageContainerEl!.getBoundingClientRect();
    quickReactTop = `${Math.round(
      fmRect.top - quickReactionEl.clientHeight - focusedMessageMargin
    )}px`;
    quickReactLeft = `${fmRect.left}px`;
  }

  const optionsMenuTopMargin = 14;
  let optionsMenuTop = '0px';
  let optionsMenuLeft = '0px';
  if (messageContainerEl && optionsMenuEl) {
    const fmRect = messageContainerEl!.getBoundingClientRect();
    optionsMenuTop = `${Math.round(fmRect.bottom + optionsMenuTopMargin)}px`;
    optionsMenuLeft = `${Math.round(fmRect.right) - 192}px`;
  }

  const overlayClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    dismiss();
  };

  const containerClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    dismiss();
  };

  const addFeel = async (shortcode: string) => {
    await chatMessage.actions.react(shortcode);
    dismiss();
  };

  const delMessage = async () => {
    try {
      await chatMessage.actions.del();
    } finally {
      dismiss();
    }
  };

  if ('story' in memo.content) {
    return (
      <>
        <div
          id="overlay"
          className="fixed z-30 h-full w-full bg-black/20 backdrop-blur-md"
          onClick={overlayClick}
        />

        <div
          className="z-40 h-full w-full select-none"
          onClick={containerClick}
        >
          <div
            id="quickReactionMenu"
            className={
              !showOptions || !messageContainerEl ? 'invisible' : 'absolute'
            }
            style={{ top: quickReactTop, left: quickReactLeft }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiQuickReact
              addFeel={addFeel}
              openPicker={() => setShowPicker(true)}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, x: 0 }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
            layoutId={seal.id}
            onClick={(e) => e.stopPropagation()}
          >
            {scaleFactor === 1 ? (
              <div className="absolute top-[35%] flex w-full justify-start">
                <div
                  id="focusedMessageContainer"
                  className="ml-6 flex min-w-[280px] max-w-[80%] flex-col items-start justify-center rounded-xl bg-white p-4"
                >
                  <Author className="mb-2" ship={memo.author} hideRoles />
                  <div id="focusedMessageContent">
                    <ChatContent
                      story={memo.content.story}
                      writId={writ.seal.id}
                      className="select-auto"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                id="focusedMessageContainer"
                className={cn(
                  'absolute top-[20%] ml-6 flex w-[300px] flex-col rounded-xl bg-white'
                )}
                style={{ height: messageContainerHeight }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  id="author"
                  className="flex items-center justify-start pt-4 pl-4"
                >
                  <Author className="" ship={memo.author} hideRoles />
                </div>
                <div className="flex flex-1 items-center justify-center overflow-hidden">
                  <div
                    id="focusedMessageContent"
                    className="pt-3 pb-4"
                    style={{ transform: `scale(${scaleFactor})` }}
                  >
                    <ChatContent
                      story={memo.content.story}
                      writId={writ.seal.id}
                      className="select-auto"
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          <div
            id="chatOptionsMenu"
            className={
              !showOptions || !messageContainerEl ? 'invisible' : 'absolute'
            }
            style={{ top: optionsMenuTop, left: optionsMenuLeft }}
            onClick={(e) => e.stopPropagation()}
          >
            <ChatOptionsMenu
              chatMessage={chatMessage}
              showAllReactions={() => setShowAllReactions(true)}
              initiateDelete={() => setShowDeleteConfirm(true)}
            />
          </div>

          {showAllReactions && (
            <div>
              <ReactionDetails
                open={showAllReactions}
                onOpenChange={setShowAllReactions}
                feels={writ.seal.feels}
              />
            </div>
          )}

          {showPicker && (
            <ReactionSheet
              onEmojiSelect={addFeel}
              open={showPicker}
              onOpenChange={setShowPicker}
            />
          )}

          {showDeleteConfirm && (
            <ConfirmationModal
              title="Delete Message"
              message="Are you sure you want to delete this message?"
              onConfirm={delMessage}
              open={showDeleteConfirm}
              setOpen={setShowDeleteConfirm}
              confirmText="Delete"
              loading={chatMessage.state.isDeleting}
            />
          )}
        </div>
      </>
    );
  }

  return null;
}
