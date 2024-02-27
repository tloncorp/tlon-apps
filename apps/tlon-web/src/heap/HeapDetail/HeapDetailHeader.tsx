import {
  PostEssay,
  chatStoryFromStory,
} from '@tloncorp/shared/dist/urbit/channel';
import { isLink } from '@tloncorp/shared/dist/urbit/content';
import cn from 'classnames';
import { Link } from 'react-router-dom';

import ChannelIcon from '@/channels/ChannelIcon';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import getKindDataFromEssay from '@/logic/getKindData';
import getHeapContentType from '@/logic/useHeapContentType';
import { useIsMobile } from '@/logic/useMedia';
import { isImageUrl, makePrettyDayAndTime } from '@/logic/utils';
import { useAmAdmin } from '@/state/groups';

import useCurioActions from '../useCurioActions';

export interface HeapDetailHeaderProps {
  nest: string;
  idCurio: string;
  essay: PostEssay;
  isUndelivered?: boolean;
  groupFlag: string;
}

export default function HeapDetailHeader({
  nest,
  idCurio,
  isUndelivered = false,
  essay,
  groupFlag,
}: HeapDetailHeaderProps) {
  const isMobile = useIsMobile();
  const { onEdit, onCopy, didCopy } = useCurioActions({ nest, time: idCurio });
  const isAdmin = useAmAdmin(groupFlag);

  if (!essay) {
    return null;
  }
  const content = chatStoryFromStory(essay.content);
  const curioContent =
    (isLink(content.inline[0])
      ? content.inline[0].link.href
      : (content.inline[0] || '').toString()) || '';
  const { description } = getHeapContentType(curioContent);
  const canEdit = isAdmin || window.our === essay.author;
  // TODO: a better title fallback
  const prettyDayAndTime = makePrettyDayAndTime(
    new Date(essay.sent || Date.now())
  );
  const isImageLink = isImageUrl(curioContent);
  const isCite = content.block.length > 0 && 'cite' in content.block[0];
  const { title: curioTitle } = getKindDataFromEssay(essay);

  function truncate({ str, n }: { str: string; n: number }) {
    return str.length > n ? `${str.slice(0, n - 1)}…` : str;
  }

  if (isMobile) {
    return (
      <MobileHeader
        title={<ChannelIcon nest={nest} className="h-6 w-6 text-gray-600" />}
        secondaryTitle={
          <h1
            className={cn(
              'ellipsis max-w-xs truncate px-4 text-[17px] leading-5 text-gray-800'
            )}
          >
            {isCite ? 'Reference' : `${description()}: `}
            {curioTitle && truncate({ str: curioTitle, n: 50 })}
            {isImageLink && !curioTitle
              ? truncate({ str: curioContent, n: 50 })
              : null}
            {!isImageLink && !curioTitle
              ? truncate({ str: prettyDayAndTime.asString, n: 50 })
              : null}
          </h1>
        }
        pathBack=".."
        action={
          <div className="flex h-12 items-center justify-end space-x-2">
            <ReconnectingSpinner />
            {!isUndelivered && (
              <>
                <button
                  className="h-6 w-6 rounded text-gray-800"
                  aria-controls="copy"
                  onClick={onCopy}
                  aria-label="Copy Link"
                >
                  {didCopy ? (
                    <CheckIcon className="h-6 w-6" />
                  ) : (
                    <CopyIcon className="h-6 w-6" />
                  )}
                </button>
                {canEdit ? <button onClick={onEdit}>Edit</button> : null}
              </>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <Link
        to=".."
        className={cn(
          'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
        )}
        aria-label="Open Channels Menu"
      >
        <div className="flex h-6 w-6 items-center justify-center">
          <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
        </div>

        <ChannelIcon nest={nest} className="h-6 w-6 shrink-0 text-gray-600" />
        <div className="flex w-full flex-col justify-center">
          <span
            className={cn(
              'ellipsis line-clamp-1 break-all text-lg font-bold sm:text-sm sm:font-semibold'
            )}
          >
            {isCite ? 'Reference' : `${description()}: `}
            {curioTitle && truncate({ str: curioTitle, n: 50 })}
            {isImageLink && !curioTitle
              ? truncate({ str: curioContent, n: 50 })
              : null}
            {!isImageLink && !curioTitle
              ? truncate({ str: prettyDayAndTime.asString, n: 50 })
              : null}
          </span>
        </div>
      </Link>
      {!isUndelivered && (
        <div className="shink-0 flex items-center space-x-3">
          {canEdit ? (
            <button onClick={onEdit} className="small-button">
              Edit
            </button>
          ) : null}

          <button
            className="h-6 w-6 rounded text-gray-400 hover:bg-gray-50"
            aria-controls="copy"
            onClick={onCopy}
            aria-label="Copy Link"
          >
            {didCopy ? (
              <CheckIcon className="h-6 w-6" />
            ) : (
              <CopyIcon className="h-6 w-6" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
