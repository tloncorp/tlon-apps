/* eslint-disable react/no-unused-prop-types */
import { Editor } from '@tiptap/react';
import {
  Post,
  Story,
  Unread,
  constructStory,
} from '@tloncorp/shared/dist/urbit/channel';
import { DMUnread } from '@tloncorp/shared/dist/urbit/dms';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import cn from 'classnames';
import { format, formatDistanceToNow, formatRelative, isToday } from 'date-fns';
import debounce from 'lodash/debounce';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useInView } from 'react-intersection-observer';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';
import { useEventListener } from 'usehooks-ts';

import ChatContent from '@/chat/ChatContent/ChatContent';
import Author from '@/chat/ChatMessage/Author';
import ChatMessageOptions from '@/chat/ChatMessage/ChatMessageOptions';
import DateDivider from '@/chat/ChatMessage/DateDivider';
import ChatReactions from '@/chat/ChatReactions/ChatReactions';
import Avatar from '@/components/Avatar';
import MessageEditor, { useMessageEditor } from '@/components/MessageEditor';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import CheckIcon from '@/components/icons/CheckIcon';
import DoubleCaretRightIcon from '@/components/icons/DoubleCaretRightIcon';
import { JSONToInlines, diaryMixedToJSON } from '@/logic/tiptap';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import { useIsDmOrMultiDm, whomIsDm, whomIsMultiDm } from '@/logic/utils';
import {
  useEditPostMutation,
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

import ReactionDetails from '../ChatReactions/ReactionDetails';
import { getUnreadStatus, threadIsOlderThanLastRead } from '../unreadUtils';
import {
  useChatDialog,
  useChatDialogs,
  useChatHovering,
  useChatInfo,
  useChatStore,
} from '../useChatStore';

export interface ChatMessageProps {
  whom: string;
  time: BigInteger;
  writ: Post;
  // it's necessary to pass in the replyCount because if it's nested
  // it won't trigger a re-render
  replyCount?: number;
  newAuthor?: boolean;
  newDay?: boolean;
  hideReplies?: boolean;
  hideOptions?: boolean;
  isLast?: boolean;
  isLinked?: boolean;
  isScrolling?: boolean;
}

function getUnreadDisplay(
  unread: Unread | DMUnread | undefined,
  id: string
): 'none' | 'top' | 'thread' {
  if (!unread) {
    return 'none';
  }

  const { unread: mainChat, threads } = unread;
  const { hasMainChatUnreads } = getUnreadStatus(unread);
  const threadIsOlder = threadIsOlderThanLastRead(unread, id);
  const hasThread = !!threads[id];

  // if we have a thread, only mark it as explicitly unread
  // if it's not nested under main chat unreads
  if (hasThread && (!hasMainChatUnreads || threadIsOlder)) {
    return 'thread';
  }

  // if this message is the oldest unread in the main chat,
  // show the divider
  if (hasMainChatUnreads && mainChat!.id === id) {
    return 'top';
  }

  return 'none';
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

const ChatMessage = React.memo<
  ChatMessageProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, ChatMessageProps>(
    (
      {
        whom,
        time,
        writ,
        replyCount = 0,
        newAuthor = false,
        newDay = false,
        hideReplies = false,
        hideOptions = false,
        isLast = false,
        isLinked = false,
        isScrolling = false,
      }: ChatMessageProps,
      ref
    ) => {
      const [searchParms, setSearchParams] = useSearchParams();
      const isEditing = searchParms.get('edit') === writ.seal.id;
      const isEdited = useIsEdited(writ);
      const { seal, essay } = writ;
      const container = useRef<HTMLDivElement>(null);
      const { idShip, idTime } = useParams<{
        idShip: string;
        idTime: string;
      }>();
      const isThread = !!idShip && !!idTime;
      const threadOpId = isThread ? `${idShip}/${idTime}` : '';
      const isThreadOp = threadOpId === seal.id && hideReplies;
      const isMobile = useIsMobile();
      const isThreadOnMobile = isThread && isMobile;
      const isDMOrMultiDM = useIsDmOrMultiDm(whom);
      const chatInfo = useChatInfo(whom);
      const unread = chatInfo?.unread;
      const unreadDisplay = useMemo(
        () => getUnreadDisplay(unread?.unread, seal.id),
        [unread, seal.id]
      );
      const { hovering, setHovering } = useChatHovering(whom, seal.id);
      const { open: pickerOpen } = useChatDialog(whom, seal.id, 'picker');
      const { mutate: markChatRead } = useMarkReadMutation();
      const { mutate: markDmRead } = useMarkDmReadMutation();
      const { mutate: editPost } = useEditPostMutation();
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
            if (inView && unreadDisplay === 'top' && !seen) {
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
          [unreadDisplay, unread, whom, isDMOrMultiDM, markChatRead, markDmRead]
        ),
      });

      const cacheId = {
        author: window.our,
        sent: essay.sent,
      };
      const msgStatus = useTrackedMessageStatus(cacheId);
      const trackedPostStatus = useTrackedPostStatus(cacheId);

      const isDelivered =
        msgStatus === 'delivered' && trackedPostStatus === 'delivered';
      const isSent = msgStatus === 'sent' || trackedPostStatus === 'sent';
      const isPending =
        msgStatus === 'pending' || trackedPostStatus === 'pending';

      const isReplyOp = chatInfo?.replying === seal.id;

      const unix = new Date(daToUnix(time));

      const replyAuthors = seal.meta.lastRepliers;
      const lastReplyTime = seal.meta.lastReply
        ? new Date(seal.meta.lastReply)
        : null;

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
      const dialogs = useChatDialogs(whom, writ.seal.id);
      const hasDialogsOpen = useMemo(
        () => Object.values(dialogs).some((open) => open),
        [dialogs]
      );
      const [reactionDetailsOpen, setReactionDetailsOpen] = useState(false);
      const { action, actionId, handlers } = useLongPress({ withId: true });

      const handleReactionDetailsOpened = useCallback(() => {
        setReactionDetailsOpen(true);
      }, []);

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

          editPost({
            nest: `chat/${whom}`,
            time: seal.id,
            essay: {
              ...essay,
              author: window.our,
              content,
            },
          });

          setSearchParams({}, { replace: true });
        },
        [editPost, whom, seal.id, essay, setSearchParams]
      );

      const messageEditor = useMessageEditor({
        whom: writ.seal.id,
        content: diaryMixedToJSON(essay.content),
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

      if (!writ) {
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
          {unread && unreadDisplay === 'top' ? (
            <DateDivider
              date={unix}
              unreadCount={unread.unread.unread?.count || 0}
              ref={viewRef}
            />
          ) : null}
          {newDay && unreadDisplay === 'none' ? (
            <DateDivider date={unix} />
          ) : null}
          {newAuthor ? (
            <Author ship={essay.author} date={unix} hideRoles={isThread} />
          ) : null}
          <div
            className={cn(
              'group-one relative z-0 flex w-full select-none sm:select-auto'
            )}
          >
            {isDelivered && !isEditing && (
              <ChatMessageOptions
                open={optionsOpen || (hasDialogsOpen && !isMobile)}
                onOpenChange={setOptionsOpen}
                hideThreadReply={hideReplies}
                whom={whom}
                writ={writ}
                hideReply={whomIsDm(whom) || whomIsMultiDm(whom) || hideReplies}
                openReactionDetails={handleReactionDetailsOpened}
              />
            )}
            <div className="-ml-1 mr-1 w-[31px] whitespace-nowrap py-2 text-xs font-semibold text-gray-400 opacity-0 sm:group-one-hover:opacity-100">
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
                    'flex w-full min-w-0 grow flex-col space-y-2 rounded py-1 pl-2 pr-2 sm:group-one-hover:bg-gray-50',
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
                  ) : essay.content ? (
                    <ChatContent
                      story={essay.content}
                      isScrolling={isScrolling}
                      writId={seal.id}
                    />
                  ) : null}
                  {Object.keys(seal.reacts).length > 0 && (
                    <>
                      <ChatReactions
                        id="reactions-target"
                        seal={seal}
                        whom={whom}
                      />
                      <ReactionDetails
                        open={reactionDetailsOpen}
                        onOpenChange={setReactionDetailsOpen}
                        reactions={seal.reacts}
                      />
                    </>
                  )}
                  {replyCount > 0 && !hideReplies ? (
                    <NavLink
                      to={`message/${seal.id}`}
                      className={({ isActive }) =>
                        cn(
                          'default-focus group -ml-2 whitespace-nowrap rounded p-2 text-sm font-semibold text-gray-800',
                          isActive
                            ? 'is-active bg-gray-50 [&>div>div>.reply-avatar]:outline-gray-50'
                            : '',
                          isLinked
                            ? '[&>div>div>.reply-avatar]:outline-blue-100 dark:[&>div>div>.reply-avatar]:outline-blue-900'
                            : ''
                        )
                      }
                    >
                      <div className="flex items-center">
                        <div className="mr-2 flex flex-row-reverse">
                          {replyAuthors.map((ship, i) => (
                            <div
                              key={ship + i}
                              className={cn(
                                'reply-avatar relative h-6 w-6 rounded bg-white outline outline-2 outline-white sm:group-one-focus-within:outline-gray-50 sm:group-one-hover:outline-gray-50',
                                i !== 0 && '-mr-3'
                              )}
                            >
                              <Avatar key={ship} ship={ship} size="xs" />
                            </div>
                          ))}
                        </div>

                        <span
                          className={cn(
                            unreadDisplay === 'thread' ? 'text-blue' : 'mr-2'
                          )}
                        >
                          {replyCount} {replyCount > 1 ? 'replies' : 'reply'}{' '}
                        </span>
                        {unreadDisplay === 'thread' ? (
                          <UnreadIndicator
                            className="h-6 w-6 text-blue transition-opacity"
                            aria-label="Unread replies in this thread"
                          />
                        ) : null}
                        <span className="text-gray-400">
                          <span className="hidden sm:inline-block">
                            Last reply&nbsp;
                          </span>
                          <span className="inline-block first-letter:capitalize sm:first-letter:normal-case">
                            {lastReplyTime &&
                              (isToday(lastReplyTime)
                                ? `${formatDistanceToNow(lastReplyTime)} ago`
                                : formatRelative(lastReplyTime, new Date()))}
                          </span>
                        </span>
                      </div>
                    </NavLink>
                  ) : null}
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
                  <span className="text-xs text-gray-400 ml-1">Edited</span>
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

export default ChatMessage;
