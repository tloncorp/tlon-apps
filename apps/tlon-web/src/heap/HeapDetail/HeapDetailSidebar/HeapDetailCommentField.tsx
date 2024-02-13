import DiaryCommentField from '@/diary/DiaryCommentField';
import { useChannelFlag } from '@/logic/channel';
import { useRouteGroup } from '@/state/groups';
import { useParams } from 'react-router';

export default function HeapDetailCommentField() {
  const { idTime } = useParams();
  const groupFlag = useRouteGroup();
  const chFlag = useChannelFlag();
  return (
    <div className="border-t-2 border-gray-50 p-3 sm:p-4">
      <DiaryCommentField
        groupFlag={groupFlag}
        flag={chFlag || ''}
        han="heap"
        replyTo={idTime || ''}
      />
    </div>
  );
}
