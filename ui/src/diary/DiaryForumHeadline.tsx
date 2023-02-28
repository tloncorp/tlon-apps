import _ from 'lodash';
import React from 'react';
import { NoteEssay } from '@/types/diary';
import { format } from 'date-fns';
import { useChannelFlag } from '@/hooks';
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
import useDiaryActions from './useDiaryActions';

interface DiaryListItemProps {
  essay: NoteEssay;
  quipCount: number;
  quippers: string[];
  time: bigInt.BigInteger;
  isInList?: boolean;
}

export default function DiaryForumHeadline({
  essay,
  quipCount,
  quippers,
  time,
  isInList,
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
    <header className="grid grid-cols-3 justify-between gap-4">
      <div className="flex flex-col space-y-2">
        <h1 className="text-lg font-bold leading-6">{essay.title}</h1>
        <p className="text-gray-400">{format(essay.sent, 'LLLL do, yyyy')}</p>
      </div>
      <div
        className="flex items-center space-x-2 font-semibold"
        onClick={(e) => e.stopPropagation()}
      >
        <Author ship={essay.author} hideTime />
      </div>

      <div
        className="ml-auto flex items-center space-x-2 text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        {isInList ? (
          <>
            <span
              role="link"
              className="font-semibold text-gray-600"
              onClick={() => navigate(`note/${time.toString()}`)}
            >
              {quipCount}
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
              fullSize={!isInList}
            />
          </a>
        )}
      </div>
    </header>
  );
}
