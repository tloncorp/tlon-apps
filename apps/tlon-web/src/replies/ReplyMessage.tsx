/* eslint-disable react/no-unused-prop-types */
// eslint-disable-next-line import/no-cycle
import { Editor } from '@tiptap/core';
import {
  Reply,
  Story,
  Unread,
  constructStory,
  emptyReply,
} from '@tloncorp/shared/dist/urbit/channel';
import { DMUnread } from '@tloncorp/shared/dist/urbit/dms';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import cn from 'classnames';
import { format } from 'date-fns';
import debounce from 'lodash/debounce';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useInView } from 'react-intersection-observer';
import { useSearchParams } from 'react-router-dom';
import { useEventListener } from 'usehooks-ts';

import ChatContent from '@/chat/ChatContent/ChatContent';
import Author from '@/chat/ChatMessage/Author';
import DateDivider from '@/chat/ChatMessage/DateDivider';
import ReactionDetails from '@/chat/ChatReactions/ReactionDetails';
import {
  useChatDialog,
  useChatHovering,
  useChatInfo,
  useChatStore,
} from '@/chat/useChatStore';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import CheckIcon from '@/components/icons/CheckIcon';
import DoubleCaretRightIcon from '@/components/icons/DoubleCaretRightIcon';
import { JSONToInlines, diaryMixedToJSON } from '@/logic/tiptap';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import { nestToFlag, useIsDmOrMultiDm, whomIsNest } from '@/logic/utils';
import {
  useEditReplyMutation,
  useIsEdited,
  useMarkReadMutation,
  usePostToggler,
  useTrackedPostStatus,
} from '@/state/channel/channel';
import {
  useMarkDmReadMutation,
  useMessageToggler,
  useTrackedMessageStatus,
} from '@/state/chat';

import ReplyMessageOptions from './ReplyMessageOptions';
import ReplyReactions from './ReplyReactions/ReplyReactions';

export interface ReplyMessageProps {
  whom: string;
  time: BigInteger;
  reply: Reply;
  newAuthor?: boolean;
  newDay?: boolean;
  hideOptions?: boolean;
  isLast?: boolean;
  isLinked?: boolean;
  isScrolling?: boolean;
  showReply?: boolean;
}

function amUnread(unread?: Unread | DMUnread, parent?: string, id?: string) {
  if (!unread || !parent || !id) {
    return false;
  }

  const thread = unread.threads[parent];
  if (typeof thread === 'object') {
    return thread.id === id;
  }

  return thread === id;
}

const mergeRefs =
  (...refs: any[]) =>
  (node: any) => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      /* eslint-disable-next-line no-param-reassign */
      ref.current = node;
    });
  };

const hiddenMessage: Story = [
  {
    inline: [
      {
        italics: ['You have hidden or flagged this message.'],
      },
    ],
  },
];
const ReplyMessage = React.memo<
  ReplyMessageProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, ReplyMessageProps>(
    (
      {
        whom,
        time,
        reply,
        newAuthor = false,
        newDay = false,
        hideOptions = false,
        isLast = false,
        isLinked = false,
        isScrolling = false,
        showReply = false,
      }: ReplyMessageProps,
      ref
    ) => {
      // we pass `whom` as a channel flag for chat, nest for diary/heap
      // because we use flags in unreads
      const nest = whomIsNest(whom) ? whom : `chat/${whom}`;
      const [searchParms, setSearchParams] = useSearchParams();
      const isEditing = searchParms.get('editReply') === reply.seal.id;
      const isEdited = useIsEdited(reply);
      const { seal, memo } = reply.seal.id ? reply : emptyReply;
      const container = useRef<HTMLDivElement>(null);
      const isThreadOp = seal['parent-id'] === seal.id;
      const isMobile = useIsMobile();
      const isThreadOnMobile = isMobile;
      const chatInfo = useChatInfo(whom);
      const isDMOrMultiDM = useIsDmOrMultiDm(whom);
      const unread = chatInfo?.unread;
      const isUnread = amUnread(unread?.unread, seal['parent-id'], seal.id);
      const { hovering, setHovering } = useChatHovering(whom, seal.id);
      const { open: pickerOpen } = useChatDialog(whom, seal.id, 'picker');
      const { mutate: markChatRead } = useMarkReadMutation();
      const { mutate: markDmRead } = useMarkDmReadMutation();
      const { mutate: editReply } = useEditReplyMutation();
      const { isHidden: isMessageHidden } = useMessageToggler(seal.id);
      const { isHidden: isPostHidden } = usePostToggler(seal.id);
      const isHidden = useMemo(
        () => isMessageHidden || isPostHidden,
        [isMessageHidden, isPostHidden]
      );
      const { ref: viewRef } = useInView({
        threshold: 1,
        onChange: useCallback(
          (inView: boolean) => {
            // if no tracked unread we don't need to take any action
            if (!unread) {
              return;
            }

            const { unread: brief, seen } = unread;
            /* the first fire of this function
               which we don't to do anything with. */
            if (!inView && !seen) {
              return;
            }

            const { seen: markSeen, delayedRead } = useChatStore.getState();

            /* once the unseen marker comes into view we need to mark it
               as seen and start a timer to mark it read so it goes away.
               we ensure that the brief matches and hasn't changed before
               doing so. we don't want to accidentally clear unreads when
               the state has changed
            */
            if (inView && isUnread && !seen) {
              markSeen(whom);
              delayedRead(whom, () => {
                if (isDMOrMultiDM) {
                  markDmRead({ whom });
                } else {
                  markChatRead({ nest: `chat/${whom}` });
                }
              });
            }
          },
          [unread, whom, isDMOrMultiDM, markChatRead, markDmRead, isUnread]
        ),
      });

      const msgStatus = useTrackedMessageStatus({
        author: window.our,
        sent: memo.sent,
      });

      const status = useTrackedPostStatus({
        author: window.our,
        sent: memo.sent,
      });
      const isDelivered = msgStatus === 'delivered' && status === 'delivered';
      const isSent = msgStatus === 'sent' || status === 'sent';
      const isPending = msgStatus === 'pending' || status === 'pending';

      const isReplyOp = chatInfo?.replying === seal.id;

      const unix = new Date(daToUnix(time));

      const hover = useRef(false);
      const setHover = useRef(
        debounce(() => {
          if (hover.current) {
            setHovering(true);
          }
        }, 100)
      );
      const onOver = useCallback(() => {
        // If we're already hovering, don't do anything
        // If we're the thread op and this isn't on mobile, don't do anything
        // This is necessary to prevent the hover from appearing
        // in the thread when the user hovers in the main scroll window.
        if (hover.current === false && (!isThreadOp || isThreadOnMobile)) {
          hover.current = true;
          setHover.current();
        }
      }, [isThreadOp, isThreadOnMobile]);
      const onOut = useRef(
        debounce(
          () => {
            hover.current = false;
            setHovering(false);
          },
          50,
          { leading: true }
        )
      );

      const [optionsOpen, setOptionsOpen] = useState(false);
      const [reactionDetailsOpen, setReactionDetailsOpen] = useState(false);
      const { action, actionId, handlers } = useLongPress({ withId: true });

      useEffect(() => {
        if (!isMobile) {
          return;
        }

        if (action === 'longpress') {
          if (actionId === 'reactions-target') {
            setReactionDetailsOpen(true);
          } else {
            setOptionsOpen(true);
          }
        }
      }, [action, actionId, isMobile]);

      useEffect(() => {
        if (isMobile) {
          return;
        }

        // If we're the thread op, don't show options.
        // Options are shown for the threadOp in the main scroll window.
        setOptionsOpen(
          (hovering || pickerOpen) &&
            !hideOptions &&
            !isScrolling &&
            !isThreadOp
        );
      }, [
        isMobile,
        hovering,
        pickerOpen,
        hideOptions,
        isScrolling,
        isThreadOp,
      ]);

      const onSubmit = useCallback(
        async (editor: Editor) => {
          // const now = Date.now();
          const editorJson = editor.getJSON();
          const inlineContent = JSONToInlines(editorJson);
          const content = constructStory(inlineContent);

          if (content.length === 0) {
            return;
          }

          editReply({
            nest,
            postId: seal['parent-id'],
            replyId: seal.id,
            memo: {
              ...memo,
              author: window.our,
              content,
            },
          });

          setSearchParams({}, { replace: true });
        },
        [editReply, nest, seal, memo, setSearchParams]
      );

      const messageEditor = useMessageEditor({
        whom: seal.id,
        content: diaryMixedToJSON(memo.content),
        uploadKey: 'chat-editor-should-not-be-used-for-uploads',
        allowMentions: true,
        onEnter: useCallback(
          ({ editor }) => {
            onSubmit(editor);
            return true;
          },
          [onSubmit]
        ),
      });

      useEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isEditing) {
          setSearchParams({}, { replace: true });
        }
      });

      useEffect(() => {
        if (messageEditor && !messageEditor.isDestroyed && isEditing) {
          messageEditor.commands.focus('end');
        }
      }, [isEditing, messageEditor]);

      if (!reply) {
        return null;
      }

      return (
        <div
          ref={mergeRefs(ref, container)}
          className={cn('flex flex-col break-words', {
            'pt-3': newAuthor,
            'pb-2': isLast,
          })}
          onMouseEnter={onOver}
          onMouseLeave={onOut.current}
          data-testid="chat-message"
          id="chat-message-target"
          {...handlers}
        >
          {unread && isUnread ? (
            <DateDivider
              date={unix}
              unreadCount={unread.unread.threads[seal['parent-id']]?.count || 0}
              ref={viewRef}
            />
          ) : null}
          {newDay && !isUnread ? <DateDivider date={unix} /> : null}
          {newAuthor ? (
            <Author ship={memo.author} date={unix} hideRoles />
          ) : null}
          <div className="group-one relative z-0 flex w-full select-none sm:select-auto">
            <ReplyMessageOptions
              open={optionsOpen}
              onOpenChange={setOptionsOpen}
              whom={whom}
              reply={reply}
              showReply={showReply}
              openReactionDetails={() => setReactionDetailsOpen(true)}
            />
            <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 sm:group-one-hover:opacity-100">
              {format(unix, 'HH:mm')}
            </div>
            <div
              className={cn(
                'wrap-anywhere flex w-full',
                isEditing && 'bg-gray-50 rounded-2xl py-3 pl-12 pr-3'
              )}
            >
              {isEditing && messageEditor && !messageEditor.isDestroyed ? (
                <div className="flex w-full min-w-0 grow flex-col space-y-2 rounded py-1 px-2 sm:group-one-hover:bg-gray-50">
                  {messageEditor && !messageEditor.isDestroyed && (
                    <MessageEditor
                      editor={messageEditor}
                      className="bg-gray-900/10"
                      inputClassName="bg-gray-900/10"
                    />
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Editing message</span>
                    <button
                      className="text-gray-600"
                      onClick={() => setSearchParams({}, { replace: true })}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'flex w-full min-w-0 grow flex-col space-y-2 rounded py-1 pl-3 pr-2 sm:group-one-hover:bg-gray-50',
                    isReplyOp && 'bg-gray-50',
                    isPending && 'text-gray-400',
                    isLinked && 'bg-blue-softer'
                  )}
                >
                  {isHidden ? (
                    <ChatContent
                      story={hiddenMessage}
                      isScrolling={isScrolling}
                      writId={seal.id}
                    />
                  ) : memo.content ? (
                    <ChatContent
                      story={memo.content}
                      isScrolling={isScrolling}
                      writId={seal.id}
                    />
                  ) : null}
                  {seal.reacts && Object.keys(seal.reacts).length > 0 && (
                    <>
                      <ReplyReactions
                        id="reactions-target"
                        seal={seal}
                        whom={whom}
                        time={time.toString()}
                      />
                      <ReactionDetails
                        open={reactionDetailsOpen}
                        onOpenChange={setReactionDetailsOpen}
                        reactions={seal.reacts}
                      />
                    </>
                  )}
                </div>
              )}
              <div
                className={cn(
                  'relative flex items-end rounded-r sm:group-one-hover:bg-gray-50',
                  {
                    'w-10': isEdited && isDelivered,
                    'w-5': !isEdited,
                  }
                )}
              >
                {!isDelivered && !isEditing && (
                  <DoubleCaretRightIcon
                    className="absolute bottom-2 left-0 h-5 w-5"
                    primary={isSent ? 'text-black' : 'text-gray-200'}
                    secondary="text-gray-200"
                  />
                )}
                {isEdited && !isEditing && (
                  <span className="text-xs text-gray-400">Edited</span>
                )}
              </div>
            </div>
            {isEditing && messageEditor && messageEditor.getText() !== '' && (
              <div className="flex flex-col justify-end ml-2.5">
                <button
                  onClick={() => onSubmit(messageEditor)}
                  className="h-8 w-8 bg-blue rounded-full flex items-center justify-center text-white"
                >
                  <CheckIcon className="h-5 w-5 text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
  )
);

export default ReplyMessage;
