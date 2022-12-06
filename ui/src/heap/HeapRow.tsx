import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import cn from 'classnames';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import { HeapCurio } from '@/types/heap';
import { useCalm } from '@/state/settings';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import useHeapContentType from '@/logic/useHeapContentType';
import useEmbedState from '@/state/embed';
import { formatDistanceToNow } from 'date-fns';
import TwitterIcon from '@/components/icons/TwitterIcon';
import LinkIcon16 from '@/components/icons/LinkIcon16';
import MusicLargeIcon from '@/components/icons/MusicLargeIcon';
import useNest from '@/logic/useNest';
import HeapLoadingRow from '@/heap/HeapLoadingRow';
import CheckIcon from '@/components/icons/CheckIcon';
import ColorBoxIcon from '@/components/icons/ColorBoxIcon';
import TextIcon from '@/components/icons/Text16Icon';
import { useRouteGroup, useAmAdmin } from '@/state/groups/groups';
import { inlineToString } from '@/logic/tiptap';
import { useIsMobile } from '@/logic/useMedia';
import useCurioActions from './useCurioActions';

export default function HeapRow({
  curio,
  time,
}: {
  curio: HeapCurio;
  time: string;
}) {
  const isMobile = useIsMobile();
  const nest = useNest();
  const { didCopy, menuOpen, setMenuOpen, onDelete, onEdit, onCopy } =
    useCurioActions({ nest, time });
  const [embed, setEmbed] = useState<any>();
  const { content, sent, title } = curio.heart;
  const { replied } = curio.seal;
  const calm = useCalm();
  // TODO: improve this
  const contentString =
    content.inline.length > 0 ? content.inline[0].toString() : '';
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const canEdit = isAdmin || window.our === curio.heart.author;
  const textFallbackTitle = content.inline
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();

  const { isText, isImage, isUrl, isAudio, description } =
    useHeapContentType(contentString);

  useEffect(() => {
    const getOembed = async () => {
      if (isValidUrl(contentString)) {
        const oembed = await useEmbedState.getState().getEmbed(contentString);
        setEmbed(oembed);
      }
    };
    getOembed();
  }, [contentString]);

  if (isValidUrl(contentString) && embed === undefined) {
    return <HeapLoadingRow />;
  }

  const isOembed = validOembedCheck(embed, contentString);

  const otherImage = () => {
    const thumbnail = embed?.thumbnail_url;
    const provider = embed?.provider_name;
    switch (true) {
      case isOembed && provider !== 'Twitter':
        return (
          <div
            className="relative inline-block h-14 w-14 cursor-pointer overflow-hidden rounded-l-lg bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${thumbnail})` }}
          />
        );
      case provider === 'Twitter':
        return <TwitterIcon className="m-2 h-6 w-6" />;
      case isAudio:
        return <MusicLargeIcon className="m-2 h-6 w-6 text-gray-300" />;
      case isUrl:
        return <LinkIcon16 className="m-2 h-8 w-8 text-gray-300" />;
      case isText:
        return <TextIcon className="m-2 h-6 w-6 text-gray-300" />;
      default:
        return (
          <ColorBoxIcon className="m-2 h-8 w-8" color="transparent" letter="" />
        );
    }
  };

  const contentDisplayed = () => {
    switch (true) {
      case isOembed:
        return embed.title;
      case isUrl:
        return title || textFallbackTitle;
      default:
        return textFallbackTitle;
    }
  };

  return (
    <div className="flex w-full items-center justify-between space-x-2 rounded-lg bg-white">
      <div className="flex space-x-2">
        <div>
          {isImage && !calm?.disableRemoteContent ? (
            <div
              className="relative inline-block h-14 w-14 cursor-pointer overflow-hidden rounded-l-lg bg-cover bg-no-repeat"
              style={{ backgroundImage: `url(${contentString})` }}
            />
          ) : (
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-l-lg bg-gray-200">
              {otherImage()}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center space-y-1">
          <div className="min-w-0 break-words line-clamp-1">
            {isMobile ? _.truncate(contentDisplayed()) : contentDisplayed()}
          </div>
          <div className="text-sm font-semibold text-gray-600">
            {description()} • {formatDistanceToNow(sent)} ago • {replied.length}{' '}
            Comments
          </div>
        </div>
      </div>
      <div
        className="flex space-x-1 text-gray-400"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCopy}
          className={cn('icon-button bg-transparent', !canEdit ? 'mr-3' : '')}
        >
          {didCopy ? (
            <CheckIcon className="h-6 w-6" />
          ) : (
            <CopyIcon className="h-6 w-6" />
          )}
        </button>
        {canEdit ? (
          <>
            <button
              className="icon-button bg-transparent"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <ElipsisIcon className="h-6 w-6" />
            </button>
            <div
              className={cn(
                'absolute right-0 flex w-[101px] flex-col items-start rounded bg-white text-sm font-semibold text-gray-800 shadow',
                { hidden: !menuOpen }
              )}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button onClick={onEdit} className="small-menu-button">
                Edit
              </button>
              <button className="small-menu-button text-red" onClick={onDelete}>
                Delete
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
