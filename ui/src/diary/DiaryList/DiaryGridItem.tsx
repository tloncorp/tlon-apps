import { useNavigate } from 'react-router';
import { daToUnix } from '@urbit/api';
import { DiaryOutline, NoteEssay } from '@/types/diary';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
import IconButton from '@/components/IconButton';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import { makePrettyDate } from '@/logic/utils';
import DiaryCommenters from '@/diary/DiaryCommenters';
import CheckIcon from '@/components/icons/CheckIcon';
import { useCalm } from '@/state/settings';
import { useChannelFlag } from '@/logic/channel';
import DiaryNoteOptionsDropdown from '../DiaryNoteOptionsDropdown';
import useDiaryActions from '../useDiaryActions';
import DiaryNoteHeadline from '../DiaryNoteHeadline';

interface DiaryGridItemProps {
  outline: DiaryOutline;
  time: bigInt.BigInteger;
}

export default function DiaryGridItem({ outline, time }: DiaryGridItemProps) {
  const chFlag = useChannelFlag();
  const essay: NoteEssay = outline;
  const unix = new Date(daToUnix(time));
  const date = makePrettyDate(unix);
  const navigate = useNavigate();
  const hasImage = outline.image?.length !== 0;
  const { didCopy, onCopy } = useDiaryActions({
    flag: chFlag || '',
    time: time.toString(),
  });

  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const canEdit = isAdmin || window.our === outline.author;
  const calm = useCalm();

  const commenters = outline.quippers;
  const { quipCount } = outline;

  return (
    <div
      role="link"
      tabIndex={0}
      className={
        'flex w-full cursor-pointer flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8'
      }
      style={
        hasImage && !calm?.disableRemoteContent
          ? {
              backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.33), rgba(0, 0, 0, 0.33)), url(${essay.image})`,
              color: '#ffffff',
            }
          : undefined
      }
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline
        quippers={commenters}
        quipCount={quipCount}
        essay={essay}
        time={time}
        isInGrid
      />
      {/* <h2 className="line-clamp-[7] break-words text-2xl font-bold">
        {essay.title}
      </h2>
      <h3 className="text-lg font-semibold">{date}</h3>
      <div
        className="flex items-center space-x-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div role="button" onClick={() => navigate(`note/${time.toString()}`)}>
          <DiaryCommenters
            commenters={commenters}
            quipCount={quipCount}
            fullSize={false}
            gridItemHasImage={hasImage}
          />
        </div>

        <IconButton
          action={onCopy}
          className="h-8 w-8"
          label="Share"
          icon={
            didCopy ? (
              <CheckIcon
                className={`h-5 w-5 ${!hasImage && 'text-gray-600'}`}
              />
            ) : (
              <CopyIcon className={`h-5 w-5 ${!hasImage && 'text-gray-600'}`} />
            )
          }
        />
        <DiaryNoteOptionsDropdown
          canEdit={canEdit}
          time={time.toString()}
          flag={chFlag || ''}
        >
          <IconButton
            className="h-8 w-8"
            label="Options"
            icon={
              <ElipsisIcon
                className={`h-5 w-5 ${!hasImage && 'text-gray-600'}`}
              />
            }
          />
        </DiaryNoteOptionsDropdown>
      </div> */}
    </div>
  );
}
