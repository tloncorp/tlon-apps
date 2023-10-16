import cn from 'classnames';
import { useNavigate } from 'react-router';
import { Post } from '@/types/channel';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useIsPostPending, usePostToggler } from '@/state/channel/channel';

interface DiaryListItemProps {
  note: Post;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ note, time }: DiaryListItemProps) {
  const isPending = useIsPostPending({
    author: note.essay.author,
    sent: note.essay.sent,
  });
  const navigate = useNavigate();

  const { essay } = note;
  const { lastRepliers, replyCount } = note.seal.meta;
  const { isHidden } = usePostToggler(time.toString());

  return (
    <div
      className={cn('card cursor-pointer border border-gray-100', {
        'cursor-pointer': !isHidden,
        'bg-gray-100': isPending,
      })}
      role="link"
      tabIndex={0}
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline
        lastRepliers={lastRepliers}
        replyCount={replyCount}
        essay={essay}
        time={time}
        isInList
      />
    </div>
  );
}
