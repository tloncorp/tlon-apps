import _ from 'lodash';
import React, { useCallback, useState } from 'react';
import f from 'lodash/fp';
import { DiaryNote } from '@/types/diary';
import { format } from 'date-fns';
import { useChannelFlag } from '@/hooks';
import { useQuips } from '@/state/diary';
import DiaryCommenters from '@/diary/DiaryCommenters';
import IconButton from '@/components/IconButton';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import DiaryNoteOptionsDropdown from '@/diary/DiaryNoteOptionsDropdown';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
import { useGroupFlag } from '@/state/groups';
import { useCopyToClipboard } from 'usehooks-ts';
import { useNavigate } from 'react-router-dom';
import Author from '@/chat/ChatMessage/Author';
import useDiaryActions from './useDiaryActions';

interface DiaryListItemProps {
  note: DiaryNote;
  time: bigInt.BigInteger;
  isInList?: boolean;
}

export default function DiaryNoteHeadline({
  note,
  time,
  isInList,
}: DiaryListItemProps) {
  const chFlag = useChannelFlag();
  const flag = useRouteGroup();
  const navigate = useNavigate();
  const quips = useQuips(chFlag || '', time.toString());
  const { justCopied, onCopy } = useDiaryActions({
    flag: chFlag || '',
    time: time.toString(),
  });

  const commenters = _.flow(
    f.compact,
    f.uniq,
    f.take(3)
  )([...quips].map(([, v]) => v.memo.author));

  const isAdmin = useAmAdmin(flag);

  return (
    <>
      {note.essay.image && (
        <img
          src={note.essay.image}
          alt=""
          className="h-auto w-full rounded-xl"
        />
      )}
      <header className="mt-8 space-y-8">
        <h1 className="text-3xl font-semibold leading-10">
          {note.essay.title}
        </h1>
        <p className="font-semibold text-gray-400">
          {format(note.essay.sent, 'LLLL do, yyyy')}
        </p>
        <div className="flex items-center">
          <div
            className="flex items-center space-x-2 font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            <Author ship={note.essay.author} hideTime />
          </div>

          <div
            className="ml-auto flex items-center space-x-2 text-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            {isInList ? (
              <>
                <span
                  role="link"
                  onClick={() => navigate(`note/${time.toString()}`)}
                >
                  <DiaryCommenters
                    commenters={commenters}
                    quipCount={quips.size}
                    fullSize={!isInList}
                  />
                </span>
                <IconButton
                  action={onCopy}
                  className="h-8 w-8"
                  label="Share"
                  icon={
                    justCopied ? (
                      <CheckIcon className={`h-5 w-5`} />
                    ) : (
                      <CopyIcon className={`h-5 w-5`} />
                    )
                  }
                />
                <DiaryNoteOptionsDropdown
                  time={time.toString()}
                  flag={chFlag || ''}
                  canEdit={isAdmin || window.our === note.essay.author}
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
                  quipCount={quips.size}
                  fullSize={!isInList}
                />
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
