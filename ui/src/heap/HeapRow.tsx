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
import TwitterIcon from '@/components/icons/TwitterIcon';

export default function HeapRow({ curio }: { curio: HeapCurio }) {
  const { content, sent } = curio.heart;
  const { replied } = curio.seal;
  const contentString = content[0].toString();

  const isImage = IMAGE_REGEX.test(contentString);
  const isUrl = URL_REGEX.test(contentString);
  const isVideo = VIDEO_REGEX.test(contentString);
  const isAudio = AUDIO_REGEX.test(contentString);
  const oembed = useEmbed(contentString);
  const isOembed = validOembedCheck(oembed, contentString);

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

  const otherImage = () => {
    const thumbnail = oembed.read().thumbnail_url;
    const provider = oembed.read().provider_name;
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
      default:
        return null;
    }
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
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
                <a href={contentString} target="_blank" rel="noreferrer">
                  {contentString}
                </a>
              ) : (
                contentString
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
