import cn from 'classnames';
import { NoteEssay } from '@/types/diary';
import { format } from 'date-fns';
import DiaryCommenters from '@/diary/DiaryCommenters';
import IconButton from '@/components/IconButton';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import DiaryNoteOptionsDropdown from '@/diary/DiaryNoteOptionsDropdown';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
import { useCalm } from '@/state/settings';
import { useNavigate } from 'react-router-dom';
import Author from '@/chat/ChatMessage/Author';
import { useChannelFlag } from '@/logic/channel';
import useDiaryActions from './useDiaryActions';

interface DiaryListItemProps {
  essay: NoteEssay;
  quipCount: number;
  quippers: string[];
  time: bigInt.BigInteger;
  isInList?: boolean;
  isInGrid?: boolean;
}

export default function DiaryNoteHeadline({
  essay,
  quipCount,
  quippers,
  time,
  isInList,
  isInGrid,
}: DiaryListItemProps) {
  const chFlag = useChannelFlag();
  const flag = useRouteGroup();
  const navigate = useNavigate();
  const { didCopy, onCopy } = useDiaryActions({
    flag: chFlag || '',
    time: time.toString(),
  });

  const commenters = quippers;
  const calm = useCalm();

  const isAdmin = useAmAdmin(flag);

  return (
    <>
      {essay.image && !calm.disableRemoteContent && !isInGrid ? (
        <img
          src={essay.image}
          alt=""
          className="mb-4 h-auto w-full rounded-xl"
        />
      ) : null}
      <header className="space-y-4">
        <h1 className="break-words text-3xl font-medium leading-10">
          {essay.title}
        </h1>
        <p className={cn(isInGrid ? 'text-white' : 'text-gray-400')}>
          {format(essay.sent, 'LLLL do, yyyy')}
        </p>
        <div className="flex w-full items-center justify-between">
          <div
            className="flex items-center space-x-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Author ship={essay.author} hideTime hideRoles />
          </div>

          <div
            className={cn(
              'flex items-center justify-end space-x-1',
              isInGrid ? 'text-white' : 'text-gray-400'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isInList || isInGrid ? (
              <>
                <span
                  role="link"
                  onClick={() => navigate(`note/${time.toString()}`)}
                >
                  <DiaryCommenters
                    commenters={commenters}
                    quipCount={quipCount}
                    fullSize={false}
                  />
                </span>
                <IconButton
                  action={onCopy}
                  className="h-8 w-8"
                  label="Share"
                  icon={
                    didCopy ? (
                      <CheckIcon className={`h-5 w-5`} />
                    ) : (
                      <CopyIcon className={`h-5 w-5`} />
                    )
                  }
                />
                <DiaryNoteOptionsDropdown
                  time={time.toString()}
                  flag={chFlag || ''}
                  canEdit={isAdmin || window.our === essay.author}
                >
                  <IconButton
                    className="h-8 w-8"
                    label="Options"
                    icon={<ElipsisIcon className={`h-5 w-5`} />}
                  />
                </DiaryNoteOptionsDropdown>
              </>
            ) : (
              <a href="#comments" className="no-underline">
                <DiaryCommenters
                  commenters={commenters}
                  quipCount={quipCount}
                  fullSize={true}
                />
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
