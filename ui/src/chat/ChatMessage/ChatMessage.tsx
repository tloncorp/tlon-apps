/* eslint-disable react/no-unused-prop-types */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import cn from 'classnames';
import debounce from 'lodash/debounce';
import bigInt, { BigInteger } from 'big-integer';
import { daToUnix } from '@urbit/api';
import { format, formatDistanceToNow, formatRelative, isToday } from 'date-fns';
import { NavLink, useParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { DMBrief } from '@/types/dms';
import Author from '@/chat/ChatMessage/Author';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import ChatReactions from '@/chat/ChatReactions/ChatReactions';
import DateDivider from '@/chat/ChatMessage/DateDivider';
import ChatMessageOptions from '@/chat/ChatMessage/ChatMessageOptions';
import { useChatState, useTrackedMessageStatus } from '@/state/chat';
import Avatar from '@/components/Avatar';
import DoubleCaretRightIcon from '@/components/icons/DoubleCaretRightIcon';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import { useIsDmOrMultiDm, whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import useLongPress from '@/logic/useLongPress';
import {
  useIsNotePending,
  useMarkReadMutation,
  useTrackedNoteStatus,
} from '@/state/channel/channel';
import { Note } from '@/types/channel';
import {
  useChatDialog,
  useChatHovering,
  useChatInfo,
  useChatStore,
} from '../useChatStore';
import ReactionDetails from '../ChatReactions/ReactionDetails';

export interface ChatMessageProps {
  whom: string;
  time: BigInteger;
  writ: Note;
  // it's necessary to pass in the quipCount because if it's nested
  // it won't trigger a re-render
  quipCount?: number;
  newAuthor?: boolean;
  newDay?: boolean;
  hideReplies?: boolean;
  hideOptions?: boolean;
  isLast?: boolean;
  isLinked?: boolean;
  isScrolling?: boolean;
}

function briefMatches(brief: DMBrief, id: string): boolean {
  return brief['read-id'] === id;
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

const ChatMessage = React.memo<
  ChatMessageProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, ChatMessageProps>(
    (
      {
        whom,
        time,
        writ,
        quipCount = 0,
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
      const { seal, essay } = writ;
      const container = useRef<HTMLDivElement>(null);
      const { idShip, idTime } = useParams<{
        idShip: string;
        idTime: string;
      }>();
      const isThread = !!idShip && !!idTime;
      // const [quipCount, setQuipCount] = useState(0);
      const threadOpId = isThread ? `${idShip}/${idTime}` : '';
      const isThreadOp = threadOpId === seal.id && hideReplies;
      const isMobile = useIsMobile();
      const isThreadOnMobile = isThread && isMobile;
      const isDMOrMultiDM = useIsDmOrMultiDm(whom);
      const chatInfo = useChatInfo(isDMOrMultiDM ? whom : `chat/${whom}`);
      const unread = chatInfo?.unread;
      const unreadId = unread?.brief['read-id'];
      const { hovering, setHovering } = useChatHovering(whom, seal.id);
      const { open: pickerOpen } = useChatDialog(whom, seal.id, 'picker');
      const { mutate: markChatRead } = useMarkReadMutation();
      const { ref: viewRef } = useInView({
        threshold: 1,
        onChange: useCallback(
          (inView: boolean) => {
            // if no tracked unread we don't need to take any action
            if (!unread) {
              return;
            }

            const { brief, seen } = unread;
            /* the first fire of this function
               which we don't to do anything with. */
            if (!inView && !seen) {
              return;
            }

            const {
              seen: markSeen,
              read,
              delayedRead,
            } = useChatStore.getState();
            const { markDmRead } = useChatState.getState();

            /* once the unseen marker comes into view we need to mark it
               as seen and start a timer to mark it read so it goes away.
               we ensure that the brief matches and hasn't changed before
               doing so. we don't want to accidentally clear unreads when
               the state has changed
            */
            if (inView && briefMatches(brief, seal.id) && !seen) {
              markSeen(whom);
              delayedRead(whom, () => {
                if (isDMOrMultiDM) {
                  markDmRead(whom);
                } else {
                  markChatRead({ nest: `chat/${whom}` });
                }
              });
              return;
            }

            /* finally, if the marker transitions back to not being visible,
              we can assume the user is done and clear the unread. */
            if (!inView && unread && seen) {
              read(whom);
              markDmRead(whom);
            }
          },
          [unread, whom, seal.id, isDMOrMultiDM, markChatRead]
        ),
      });
      const msgStatus = useTrackedMessageStatus(seal.id);
      const status = useTrackedNoteStatus({
        author: window.our,
        sent: essay.sent,
      });
      const isDelivered = msgStatus === 'delivered' || status === 'delivered';
      const isSent = msgStatus === 'sent' || status === 'sent';
      const isPending = msgStatus === 'pending' || status === 'pending';

      const isReplyOp = chatInfo?.replying === seal.id;

      const unix = new Date(daToUnix(time));

      const replyAuthors = seal.meta.lastQuippers;
      const lastReplyTime = seal.meta.lastQuip
        ? new Date(seal.meta.lastQuip)
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
          {unread && briefMatches(unread.brief, seal.id) ? (
            <DateDivider
              date={unix}
              unreadCount={unread.brief.count}
              ref={viewRef}
            />
          ) : null}
          {newDay ? <DateDivider date={unix} /> : null}
          {newAuthor ? (
            <Author ship={essay.author} date={unix} hideRoles={isThread} />
          ) : null}
          <div className="group-one relative z-0 flex w-full select-none sm:select-auto">
            <ChatMessageOptions
              open={optionsOpen}
              onOpenChange={setOptionsOpen}
              hideThreadReply={hideReplies}
              whom={whom}
              writ={writ}
              hideReply={whomIsDm(whom) || whomIsMultiDm(whom) || hideReplies}
              openReactionDetails={() => setReactionDetailsOpen(true)}
            />
            <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 sm:group-one-hover:opacity-100">
              {format(unix, 'HH:mm')}
            </div>
            <div className="wrap-anywhere flex w-full">
              <div
                className={cn(
                  'flex w-full min-w-0 grow flex-col space-y-2 rounded py-1 pl-3 pr-2 sm:group-one-hover:bg-gray-50',
                  isReplyOp && 'bg-gray-50',
                  isPending && 'text-gray-400',
                  isLinked && 'bg-blue-softer'
                )}
              >
                {essay.content ? (
                  <ChatContent
                    story={essay.content}
                    isScrolling={isScrolling}
                    writId={seal.id}
                  />
                ) : null}
                {Object.keys(seal.feels).length > 0 && (
                  <>
                    <ChatReactions
                      id="reactions-target"
                      seal={seal}
                      whom={whom}
                    />
                    <ReactionDetails
                      open={reactionDetailsOpen}
                      onOpenChange={setReactionDetailsOpen}
                      feels={seal.feels}
                    />
                  </>
                )}
                {quipCount > 0 && !hideReplies ? (
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
                          // repliesContainsUnreadId ? 'text-blue' : 'mr-2'
                          'mr-2'
                        )}
                      >
                        {quipCount} {quipCount > 1 ? 'replies' : 'reply'}{' '}
                      </span>
                      {/*
                      TODO: update when we have quip briefs
                      repliesContainsUnreadId ? (
                        <UnreadIndicator
                          className="h-6 w-6 text-blue transition-opacity"
                          aria-label="Unread replies in this thread"
                        />
                      ) : null */}
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
              <div className="relative flex w-5 items-end rounded-r sm:group-one-hover:bg-gray-50">
                {!isDelivered && (
                  <DoubleCaretRightIcon
                    className="absolute left-0 bottom-2 h-5 w-5"
                    primary={isSent ? 'text-black' : 'text-gray-200'}
                    secondary="text-gray-200"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
  )
);

export default ChatMessage;
