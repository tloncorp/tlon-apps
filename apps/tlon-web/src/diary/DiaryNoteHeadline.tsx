import { PostEssay } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import Author from '@/chat/ChatMessage/Author';
import IconButton from '@/components/IconButton';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import DiaryCommenters from '@/diary/DiaryCommenters';
import DiaryNoteOptionsDropdown from '@/diary/DiaryNoteOptionsDropdown';
import { useChannelFlag } from '@/logic/channel';
import getKindDataFromEssay from '@/logic/getKindData';
import { usePostToggler } from '@/state/channel/channel';
import { useAmAdmin, useRouteGroup } from '@/state/groups/groups';
import { useCalm } from '@/state/settings';

import useDiaryActions from './useDiaryActions';

interface DiaryListItemProps {
  essay: PostEssay;
  replyCount: number;
  lastRepliers: string[];
  time: bigInt.BigInteger;
  isInList?: boolean;
  isInGrid?: boolean;
  isUndelivered?: boolean;
}

export default function DiaryNoteHeadline({
  essay,
  replyCount,
  lastRepliers,
  time,
  isInList,
  isInGrid,
  isUndelivered,
}: DiaryListItemProps) {
  const { title, image } = getKindDataFromEssay(essay);
  const chFlag = useChannelFlag();
  const flag = useRouteGroup();
  const navigate = useNavigate();
  const { didCopy, onCopy } = useDiaryActions({
    flag: chFlag || '',
    time: time.toString(),
  });
  const { isHidden } = usePostToggler(time.toString());

  const commenters = lastRepliers;
  const calm = useCalm();

  const isAdmin = useAmAdmin(flag);
  const showImage = image && !calm.disableRemoteContent;

  if (isHidden) {
    return (
      <header className="space-y-4">
        <h1 className="break-words italic leading-10 text-gray-600">
          You've hidden this post
        </h1>
        <p className={cn(isInList && 'text-gray-400')}>
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
              (isInList || !showImage) && 'text-gray-400'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <DiaryNoteOptionsDropdown
              time={time.toString()}
              sent={essay.sent}
              author={essay.author}
              flag={chFlag || ''}
              canEdit={isAdmin || window.our === essay.author}
            >
              <IconButton
                className="h-8 w-8 hover:text-gray-400"
                label="Options"
                icon={<ElipsisIcon className={`h-5 w-5`} />}
              />
            </DiaryNoteOptionsDropdown>
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      {showImage && !isInGrid ? (
        <img
          src={image}
          alt=""
          className="mb-4 h-auto w-full rounded-xl"
          crossOrigin="anonymous"
        />
      ) : null}
      <header className="space-y-4">
        <h1 className="break-words text-3xl font-medium leading-10">{title}</h1>
        <p className={cn((isInList || !showImage) && 'text-gray-400')}>
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
              (isInList || !showImage) && 'text-gray-400'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isInList || isInGrid || isUndelivered ? (
              <>
                <span
                  role="link"
                  onClick={() => navigate(`note/${time.toString()}`)}
                >
                  <DiaryCommenters
                    commenters={commenters}
                    replyCount={replyCount}
                    fullSize={false}
                  />
                </span>
                <IconButton
                  action={onCopy}
                  className="h-8 w-8 hover:text-gray-400"
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
                  author={essay.author}
                  sent={essay.sent}
                  flag={chFlag || ''}
                  canEdit={isAdmin || window.our === essay.author}
                >
                  <IconButton
                    className="h-8 w-8 hover:text-gray-400"
                    label="Options"
                    icon={<ElipsisIcon className={`h-5 w-5`} />}
                  />
                </DiaryNoteOptionsDropdown>
              </>
            ) : (
              <a href="#comments" className="no-underline">
                <DiaryCommenters
                  commenters={commenters}
                  replyCount={replyCount}
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
