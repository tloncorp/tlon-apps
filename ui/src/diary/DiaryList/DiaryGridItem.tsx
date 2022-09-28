import _ from 'lodash';
import f from 'lodash/fp';
import React from 'react';
import { useNavigate } from 'react-router';
import { DiaryNote } from '@/types/diary';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
import IconButton from '@/components/IconButton';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import { makePrettyDate } from '@/logic/utils';
import { daToUnix } from '@urbit/api';
import DiaryCommenters from '@/diary/DiaryCommenters';
import { useChannelFlag } from '@/hooks';
import { useQuips } from '@/state/diary';
import CheckIcon from '@/components/icons/CheckIcon';
import DiaryNoteOptionsDropdown from '../DiaryNoteOptionsDropdown';
import useDiaryActions from '../useDiaryActions';

interface DiaryGridItemProps {
  note: DiaryNote;
  time: bigInt.BigInteger;
}

export default function DiaryGridItem({ note, time }: DiaryGridItemProps) {
  const chFlag = useChannelFlag();
  const quips = useQuips(chFlag || '', time.toString());
  const unix = new Date(daToUnix(time));
  const date = makePrettyDate(unix);
  const navigate = useNavigate();
  const hasImage = note.essay.image.length !== 0;
  const { justCopied, onCopy } = useDiaryActions({
    flag: chFlag || '',
    time: time.toString(),
  });

  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const canEdit = isAdmin || window.our === note.essay.author;

  const commenters = _.flow(
    f.compact,
    f.uniq,
    f.take(3)
  )([...quips].map(([, v]) => v.memo.author));

  return (
    <div
      role="link"
      tabIndex={0}
      className={
        'flex w-full cursor-pointer flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8'
      }
      style={
        hasImage
          ? {
              backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.33), rgba(0, 0, 0, 0.33)), url(${note.essay.image})`,
              color: '#ffffff',
            }
          : undefined
      }
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <h2 className="break-words text-2xl font-bold line-clamp-[7]">
        {note.essay.title}
      </h2>
      <h3 className="text-lg font-semibold">{date}</h3>
      <div
        className="flex items-center space-x-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div role="button" onClick={() => navigate(`note/${time.toString()}`)}>
          <DiaryCommenters
            commenters={commenters}
            quipCount={quips.size}
            fullSize={false}
            gridItemHasImage={hasImage}
          />
        </div>

        <IconButton
          action={onCopy}
          className="h-8 w-8"
          label="Share"
          icon={
            justCopied ? (
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
      </div>
    </div>
  );
}
