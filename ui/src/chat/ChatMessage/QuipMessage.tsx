/* eslint-disable react/no-unused-prop-types */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import debounce from 'lodash/debounce';
import { BigInteger } from 'big-integer';
import { daToUnix } from '@urbit/api';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { ChatBrief } from '@/types/chat';
import Author from '@/chat/ChatMessage/Author';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import ChatReactions from '@/chat/ChatReactions/ChatReactions';
import DateDivider from '@/chat/ChatMessage/DateDivider';
import {
  useChatState,
  useIsMessageDelivered,
  useIsMessagePosted,
  useIsDmOrMultiDm,
} from '@/state/chat';
import DoubleCaretRightIcon from '@/components/icons/DoubleCaretRightIcon';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import { useIsMobile } from '@/logic/useMedia';
import useLongPress from '@/logic/useLongPress';
import { useMarkReadMutation } from '@/state/channel/channel';
import { emptyQuip, Han, Quip } from '@/types/channel';
import {
  useChatDialog,
  useChatHovering,
  useChatInfo,
  useChatStore,
} from '../useChatStore';
import ReactionDetails from '../ChatReactions/ReactionDetails';
import QuipMessageOptions from './QuipMessageOptions';
import QuipReactions from '@/diary/QuipReactions/QuipReactions';

export interface QuipMessageProps {
  whom: string;
  time: BigInteger;
  quip: Quip;
  newAuthor?: boolean;
  newDay?: boolean;
  hideOptions?: boolean;
  isLast?: boolean;
  isLinked?: boolean;
  isScrolling?: boolean;
  han: Han;
}

function briefMatches(brief: ChatBrief, id: string): boolean {
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

const QuipMessage = React.memo<
  QuipMessageProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, QuipMessageProps>(
    (
      {
        whom,
        time,
        quip,
        newAuthor = false,
        newDay = false,
        hideOptions = false,
        isLast = false,
        isLinked = false,
        isScrolling = false,
        han,
      }: QuipMessageProps,
      ref
    ) => {
      const { cork, memo } = quip ?? emptyQuip;
      const container = useRef<HTMLDivElement>(null);
      const { idShip, idTime } = useParams<{
        idShip: string;
        idTime: string;
      }>();
      const isThreadOp = idTime === cork.id;
      const isMobile = useIsMobile();
      const isThreadOnMobile = isMobile;
      const chatInfo = useChatInfo(whom);
      const unread = chatInfo?.unread;
      const unreadId = unread?.brief['read-id'];
      const { hovering, setHovering } = useChatHovering(whom, cork.id);
      const { open: pickerOpen } = useChatDialog(whom, cork.id, 'picker');
      const isDMOrMultiDM = useIsDmOrMultiDm(whom);
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
            if (inView && briefMatches(brief, cork.id) && !seen) {
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
          [unread, whom, cork.id, isDMOrMultiDM, markChatRead]
        ),
      });
      const isMessageDelivered = useIsMessageDelivered(cork.id);
      const isMessagePosted = useIsMessagePosted(cork.id);
      const isReplyOp = chatInfo?.replying === cork.id;

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

      if (!quip) {
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
          {unread && briefMatches(unread.brief, cork.id) ? (
            <DateDivider
              date={unix}
              unreadCount={unread.brief.count}
              ref={viewRef}
            />
          ) : null}
          {newDay ? <DateDivider date={unix} /> : null}
          {newAuthor ? (
            <Author ship={memo.author} date={unix} hideRoles />
          ) : null}
          <div className="group-one relative z-0 flex w-full select-none sm:select-auto">
            <QuipMessageOptions
              open={optionsOpen}
              onOpenChange={setOptionsOpen}
              whom={whom}
              quip={quip}
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
                  !isMessageDelivered && !isMessagePosted && 'text-gray-400',
                  isLinked && 'bg-blue-softer'
                )}
              >
                {memo.content ? (
                  <ChatContent
                    story={memo.content}
                    isScrolling={isScrolling}
                    writId={cork.id}
                  />
                ) : null}
                {cork.feels && Object.keys(cork.feels).length > 0 && (
                  <>
                    <QuipReactions
                      id="reactions-target"
                      han={han}
                      cork={cork}
                      whom={whom}
                      time={time.toString()}
                      noteId={idTime!}
                    />
                    <ReactionDetails
                      open={reactionDetailsOpen}
                      onOpenChange={setReactionDetailsOpen}
                      feels={cork.feels}
                    />
                  </>
                )}
              </div>
              <div className="relative flex w-5 items-end rounded-r sm:group-one-hover:bg-gray-50">
                {!isMessageDelivered && (
                  <DoubleCaretRightIcon
                    className="absolute left-0 bottom-2 h-5 w-5"
                    primary={isMessagePosted ? 'text-black' : 'text-gray-200'}
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

export default QuipMessage;
