import { Quip } from '@/types/channel';
import Author from '@/chat/ChatMessage/Author';
import HeapContent from '@/heap/HeapContent';
import { useChannelFlag } from '@/logic/channel';
import QuipReactions from '@/diary/QuipReactions/QuipReactions';
import HeapCommentOptions from './HeapCommentOptions';

interface HeapCommentProps {
  quip: Quip;
  time: string;
  parentTime: string;
}

export default function HeapComment({
  quip,
  time,
  parentTime,
}: HeapCommentProps) {
  const flag = useChannelFlag();
  if (!quip) {
    return null;
  }
  const { author, content, sent } = quip.memo;
  const unixDate = new Date(sent);

  return (
    <div className="group-one flex w-full flex-col pb-2">
      <Author ship={author} date={unixDate} timeOnly />
      <div className="relative ml-[28px] rounded-md p-2 group-one-hover:bg-gray-50 ">
        <HeapContent
          className="break-words leading-5"
          isComment
          content={content}
        />
        <HeapCommentOptions
          whom={flag || ''}
          quip={quip}
          parentTime={parentTime}
          time={time}
        />
        {Object.keys(quip.cork.feels).length > 0 && (
          <QuipReactions
            time={time}
            whom={flag || ''}
            cork={quip.cork}
            noteId={parentTime}
            han="heap"
          />
        )}
      </div>
    </div>
  );
}
