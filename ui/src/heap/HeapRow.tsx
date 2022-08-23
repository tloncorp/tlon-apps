import React, { useEffect } from 'react';
import cn from 'classnames';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import { HeapCurio } from '@/types/heap';
import { nestToFlag } from '@/logic/utils';
import useHeapContentType from '@/logic/useHeapContentType';
import useEmbedState from '@/state/embed';
import { formatDistanceToNow } from 'date-fns';
import TwitterIcon from '@/components/icons/TwitterIcon';
import LinkIcon16 from '@/components/icons/LinkIcon16';
import MusicLargeIcon from '@/components/icons/MusicLargeIcon';
import HeapContent from '@/heap/HeapContent';
import { useHeapState } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import HeapLoadingRow from '@/heap/HeapLoadingRow';

export default function HeapRow({
  curio,
  time,
}: {
  curio: HeapCurio;
  time: string;
}) {
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [embed, setEmbed] = React.useState<any>();
  const { content, sent } = curio.heart;
  const { replied } = curio.seal;
  const contentString = content[0].toString();

  const onDelete = () => {
    setMenuOpen(false);
    useHeapState.getState().delCurio(chFlag, time);
  };

  const { isImage, isUrl, isAudio, isOembed, oembed, description } =
    useHeapContentType(contentString);

  useEffect(() => {
    const getOembed = async () => {
      const oembed = await useEmbedState.getState().getEmbed(contentString);
      setEmbed(oembed);
    };
    getOembed();
  }, [contentString]);

  if (embed === undefined) {
    return <HeapLoadingRow />;
  }

  const otherImage = () => {
    const thumbnail = embed.thumbnail_url;
    const provider = embed.provider_name;
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
      default:
        return null;
    }
  };

  const contentDisplayed = () => {
    switch (true) {
      case isOembed:
        return embed.title;
      case isUrl:
        return contentString;
      default:
        return contentString.split(' ').slice(0, 5).join(' ');
    }
  };

  return (
    <div className="flex h-14 w-full items-center justify-between space-x-2 rounded-lg bg-white">
      <div className="flex space-x-2">
        {isImage ? (
          <div
            className="relative inline-block h-14 w-14 cursor-pointer overflow-hidden rounded-l-lg bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${contentString})` }}
          />
        ) : (
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-l-lg bg-gray-200">
            {otherImage()}
          </div>
        )}
        <div className="flex flex-col justify-end p-2">
          <div className="font-semibold text-gray-800">
            {isUrl ? (
              contentDisplayed()
            ) : (
              <HeapContent
                className="leading-6 line-clamp-1"
                content={content}
              />
            )}
          </div>
          <div className="text-sm font-semibold text-gray-600">
            {description()} • {formatDistanceToNow(sent)} ago • {replied.length}{' '}
            Comments
          </div>
        </div>
      </div>
      <div className="flex space-x-1 text-gray-400">
        <button className="icon-button bg-transparent">
          <CopyIcon className="h-6 w-6" />
        </button>
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
          <button
            // FIXME: add edit functionality
            className="small-menu-button"
          >
            Edit
          </button>
          <button className="small-menu-button" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
