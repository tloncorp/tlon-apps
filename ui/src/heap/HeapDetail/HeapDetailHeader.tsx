import cn from 'classnames';
import React from 'react';
import { Link } from 'react-router-dom';
import { useAmAdmin } from '@/state/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { useIsMobile } from '@/logic/useMedia';
import CopyIcon from '@/components/icons/CopyIcon';
import ChannelIcon from '@/channels/ChannelIcon';
import { useCurio } from '@/state/heap/heap';
import CheckIcon from '@/components/icons/CheckIcon';
import { isImageUrl, makePrettyDayAndTime } from '@/logic/utils';
import { isLink } from '@/types/heap';
import useHeapContentType from '@/logic/useHeapContentType';
import useNest from '@/logic/useNest';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import useCurioActions from '../useCurioActions';

export interface ChannelHeaderProps {
  flag: string;
  chFlag: string;
  idCurio: string;
}

export default function HeapDetailHeader({
  flag,
  chFlag,
  idCurio,
}: ChannelHeaderProps) {
  const curioObject = useCurio(chFlag, idCurio);
  const isMobile = useIsMobile();
  const nest = useNest();
  const curio = curioObject ? curioObject[1] : null;
  const content = curio ? curio.heart.content : { block: [], inline: [] };
  const curioContent =
    (isLink(curio?.heart.content.inline[0])
      ? curio?.heart.content.inline[0].link.href
      : (curio?.heart.content.inline[0] || '').toString()) || '';
  const { description } = useHeapContentType(curioContent);
  const isAdmin = useAmAdmin(flag);
  const canEdit = isAdmin || window.our === curio?.heart.author;
  // TODO: a better title fallback
  const prettyDayAndTime = makePrettyDayAndTime(
    new Date(curio?.heart.sent || Date.now())
  );
  const isImageLink = isImageUrl(curioContent);
  const isCite = content.block.length > 0 && 'cite' in content.block[0];
  const curioTitle = curio?.heart.title;
  const { onEdit, onCopy, didCopy } = useCurioActions({ nest, time: idCurio });

  function truncate({ str, n }: { str: string; n: number }) {
    return str.length > n ? `${str.slice(0, n - 1)}…` : str;
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

        <ChannelIcon nest="heap" className="h-6 w-6 shrink-0 text-gray-600" />
        <div className="flex w-full flex-col justify-center">
          <span
            className={cn(
              'ellipsis break-all text-lg font-bold line-clamp-1 sm:text-sm sm:font-semibold'
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
      <div className="shink-0 flex items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
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
    </div>
  );
}
