import { Post } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';
import { useNavigate } from 'react-router';

import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import {
  useIsPostPending,
  useIsPostUndelivered,
  usePostToggler,
} from '@/state/channel/channel';

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
  const isUndelivered = useIsPostUndelivered(note);

  return (
    <div
      className={cn('card border border-gray-100', {
        'cursor-pointer': !isHidden,
        'bg-gray-100': isPending,
      })}
      role="link"
      tabIndex={0}
      onClick={() => !isHidden && navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline
        lastRepliers={lastRepliers}
        replyCount={replyCount}
        essay={essay}
        time={time}
        isInList
        isUndelivered={isUndelivered}
      />
    </div>
  );
}
