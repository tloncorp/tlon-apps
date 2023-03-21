import cn from 'classnames';
import React from 'react';
import Helmet from 'react-helmet';
import { useAmAdmin, useGroup } from '@/state/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { useIsMobile } from '@/logic/useMedia';
import { Link } from 'react-router-dom';
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
  const group = useGroup(flag);
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
  const curioTitle = curio?.heart.title;
  const { onEdit, onCopy, didCopy } = useCurioActions({ nest, time: idCurio });

  const isCite = content.block.length > 0 && 'cite' in content.block[0];

  return (
    <>
      <Helmet>
        <title>
          {(curioTitle && curioTitle) || 'Gallery Item'} •{' '}
          {group?.meta.title || ''} • Groups
        </title>
      </Helmet>
      <div
        className={cn(
          'flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4'
        )}
      >
        <Link
          to="../"
          className={cn(
            'default-focus ellipsis -ml-2 -mt-2 -mb-2 inline-flex max-w-md appearance-none items-center rounded-md p-2 pr-4 text-lg font-bold text-gray-800 hover:bg-gray-50 sm:text-base sm:font-semibold',
            isMobile && ''
          )}
          aria-label="Back to Gallery"
        >
          <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          <div className=" mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
            <ChannelIcon nest="heap" className="h-5 w-5 text-gray-400" />
          </div>
          <span className="ellipsis line-clamp-1">
            {isCite ? 'Reference' : `${description()}: `}
            {curioTitle && curioTitle}
            {isImageLink && !curioTitle ? curioContent : null}
            {!isImageLink && !curioTitle ? prettyDayAndTime : null}
          </span>
        </Link>
        <div className="shink-0 flex items-center space-x-3 self-end">
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
    </>
  );
}
