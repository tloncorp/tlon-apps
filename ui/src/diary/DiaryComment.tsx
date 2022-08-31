/* eslint-disable react/no-unused-prop-types */
import React from 'react';
import { BigInteger } from 'big-integer';
import { daToUnix } from '@urbit/api';
import { differenceInDays, format } from 'date-fns';
import Author from '@/chat/ChatMessage/Author';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import DateDivider from '@/chat/ChatMessage/DateDivider';
import { DiaryBrief, DiaryQuip } from '@/types/diary';

export interface DiaryCommentProps {
  time: BigInteger;
  quip: DiaryQuip;
  brief: DiaryBrief;
  prevQuip?: DiaryQuip;
  prevQuipTime?: BigInteger;
}

const DiaryComment = React.memo<
  DiaryCommentProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, DiaryCommentProps>(
    ({ time, quip, brief, prevQuip, prevQuipTime }: DiaryCommentProps, ref) => {
      const { seal, memo } = quip;
      const unix = new Date(daToUnix(time));

      const newAuthor = prevQuip
        ? quip.memo.author !== prevQuip.memo.author
        : true;
      const lastQuipDay = prevQuipTime
        ? new Date(daToUnix(prevQuipTime))
        : undefined;
      const newDay =
        prevQuip && lastQuipDay
          ? differenceInDays(unix, lastQuipDay) > 0
          : false;
      const unreadBrief =
        brief && brief['read-id'] === quip.seal.time ? brief : undefined;

      return (
        <div ref={ref} className="flex flex-col">
          {unreadBrief ? (
            <DateDivider date={unix} unreadCount={unreadBrief.count} />
          ) : null}
          {newDay && !unreadBrief ? <DateDivider date={unix} /> : null}
          {newAuthor ? <Author ship={memo.author} date={unix} /> : null}
          <div className="group-one relative z-0 flex">
            {/* <ChatMessageOptions whom={whom} writ={writ} /> */}
            <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
              {format(unix, 'HH:mm')}
            </div>
            <div className="flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50">
              <ChatContent story={{ block: [], inline: memo.content }} />
              {/* {Object.keys(seal.feels).length > 0 && (
                <ChatReactions seal={seal} />
              )} */}
            </div>
          </div>
        </div>
      );
    }
  )
);

export default DiaryComment;
