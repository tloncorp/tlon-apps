import cn from 'classnames';
import { useNavigate } from 'react-router';
<<<<<<< HEAD
import { Post } from '@/types/channel';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useIsPostPending, usePostToggler } from '@/state/channel/channel';
||||||| 0c006213
import { useIsNotePending } from '@/state/diary';
=======
import { useIsNotePending, usePostToggler } from '@/state/diary';
>>>>>>> develop

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
<<<<<<< HEAD

  const { essay } = note;
  const { lastRepliers, replyCount } = note.seal.meta;
  const { isHidden } = usePostToggler(time.toString());
||||||| 0c006213
  const essay = outline;
  const { quippers, quipCount } = outline;
=======
  const essay = outline;
  const { quippers, quipCount } = outline;
  const { isHidden } = usePostToggler(time.toString());
>>>>>>> develop

  return (
    <div
<<<<<<< HEAD
      className={cn('card cursor-pointer border border-gray-100', {
        'cursor-pointer': !isHidden,
||||||| 0c006213
      className={cn('card cursor-pointer border border-gray-100', {
=======
      className={cn('card border border-gray-100', {
        'cursor-pointer': !isHidden,
>>>>>>> develop
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
      />
    </div>
  );
}
