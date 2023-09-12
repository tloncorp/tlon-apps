/* eslint-disable react/no-unused-prop-types */
import React from 'react';
import { BigInteger } from 'big-integer';
import { daToUnix } from '@urbit/api';
import { format } from 'date-fns';
// eslint-disable-next-line import/no-cycle
import Author from '@/chat/ChatMessage/Author';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
// eslint-disable-next-line import/no-cycle
import DateDivider from '@/chat/ChatMessage/DateDivider';
import { Han, Quip } from '@/types/channel';
// eslint-disable-next-line import/no-cycle
import { useChannelFlag } from '@/logic/channel';
// eslint-disable-next-line import/no-cycle
import DiaryCommentOptions from './DiaryCommentOptions';
// eslint-disable-next-line import/no-cycle
import QuipReactions from './QuipReactions/QuipReactions';

export interface DiaryCommentProps {
  han: Han;
  noteId: string;
  time: BigInteger;
  quip: Quip;
  newAuthor: boolean;
  newDay: boolean;
  unreadCount?: number;
}

const DiaryComment = React.memo<
  DiaryCommentProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, DiaryCommentProps>(
    (
      {
        han,
        noteId,
        time,
        quip,
        unreadCount,
        newAuthor,
        newDay,
      }: DiaryCommentProps,
      ref
    ) => {
      const { cork, memo } = quip;
      const flag = useChannelFlag();
      const unix = new Date(daToUnix(time));

      if (han === 'heap') {
        <div className="group-one flex w-full flex-col pb-2">
          <Author ship={memo.author} date={unix} timeOnly />
          <div className="relative ml-[28px] rounded-md p-2 group-one-hover:bg-gray-50 ">
            <ChatContent story={quip.memo.content} />
            {Object.keys(cork.feels).length > 0 && (
              <QuipReactions
                time={time.toString()}
                whom={flag || ''}
                cork={cork}
                noteId={noteId}
                han={han}
              />
            )}
            <DiaryCommentOptions
              han={han}
              whom={flag || ''}
              noteId={noteId}
              quip={quip}
              time={time.toString()}
            />
          </div>
        </div>;
      }

      return (
        <div ref={ref} className="flex flex-col">
          {typeof unreadCount === 'number' ? (
            <DateDivider date={unix} unreadCount={unreadCount} />
          ) : null}
          {newDay && typeof unreadCount === 'undefined' ? (
            <DateDivider date={unix} />
          ) : null}
          {newAuthor ? <Author ship={memo.author} date={unix} /> : null}
          <div className="group-one relative z-0 flex">
            <DiaryCommentOptions
              han={han}
              whom={flag || ''}
              noteId={noteId}
              quip={quip}
              time={time.toString()}
            />
            <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
              {format(unix, 'HH:mm')}
            </div>
            <div className="flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50">
              <ChatContent story={quip.memo.content} />
              {Object.keys(cork.feels).length > 0 && (
                <QuipReactions
                  time={time.toString()}
                  whom={flag || ''}
                  cork={cork}
                  noteId={noteId}
                  han={han}
                />
              )}
            </div>
          </div>
        </div>
      );
    }
  )
);

export default DiaryComment;
