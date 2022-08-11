import React, { Suspense } from 'react';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import { HeapCurio } from '@/types/heap';
import {
  AUDIO_REGEX,
  IMAGE_REGEX,
  URL_REGEX,
  validOembedCheck,
  VIDEO_REGEX,
} from '@/logic/utils';
import { useEmbed } from '@/logic/embed';
import { formatDistanceToNow } from 'date-fns';

export default function HeapRow({ curio }: { curio: HeapCurio }) {
  const { content, sent } = curio.heart;
  const { replied } = curio.seal;
  const url = content[0].toString();

  const isImage = IMAGE_REGEX.test(url);
  const isUrl = URL_REGEX.test(url);
  const isVideo = VIDEO_REGEX.test(url);
  const isAudio = AUDIO_REGEX.test(url);
  const oembed = useEmbed(url);
  const isOembed = validOembedCheck(oembed, url);

  const description = () => {
    switch (true) {
      case isImage:
        return 'Image';
      case isOembed:
        return oembed.read().provider_name;
      case isVideo:
        return 'Video';
      case isAudio:
        return 'Audio';
      case isUrl:
        return 'URL';
      default:
        return 'Text';
    }
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex h-14 w-full items-center justify-between space-x-2 rounded-lg bg-white">
        <div className="flex space-x-2">
          {isImage ? (
            <div
              className="relative inline-block h-14 w-14 cursor-pointer overflow-hidden rounded-l-lg bg-cover bg-no-repeat"
              style={{ backgroundImage: `url(${url})` }}
            />
          ) : (
            <div className="h-14 w-14 rounded-l-lg bg-gray-200" />
          )}
          <div className="flex flex-col justify-end p-2">
            <div className="font-semibold text-gray-800">
              {isUrl ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              ) : (
                url
              )}
            </div>
            <div className="text-sm font-semibold text-gray-600">
              {description()} • {formatDistanceToNow(sent)} ago •{' '}
              {replied.length} Comments
            </div>
          </div>
        </div>
        <div className="flex space-x-1 text-gray-400">
          <button className="icon-button bg-transparent">
            <CopyIcon className="h-6 w-6" />
          </button>
          <button className="icon-button bg-transparent">
            <ElipsisIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </Suspense>
  );
}
