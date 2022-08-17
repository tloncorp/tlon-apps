import React from 'react';
import { HeapCurio } from '@/types/heap';
import {
  AUDIO_REGEX,
  IMAGE_REGEX,
  isValidUrl,
  validOembedCheck,
} from '@/logic/utils';
import { useEmbed } from '@/logic/embed';
import HeapContent from '@/heap/HeapContent';
import TwitterIcon from '@/components/icons/TwitterIcon';
import { formatDistanceToNow } from 'date-fns';
import IconButton from '@/components/IconButton';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import ElipsisSmallIcon from '@/components/icons/EllipsisSmallIcon';
import OpenSmallIcon from '@/components/icons/OpenSmallIcon';

export default function HeapBlock({ curio }: { curio: HeapCurio }) {
  const { content, sent, replying = 1 } = curio.heart;
  const url = content[0].toString();
  const prettySent = formatDistanceToNow(sent);

  const isImage = IMAGE_REGEX.test(url);
  const isAudio = AUDIO_REGEX.test(url);
  const isText = !isValidUrl(url);
  const oembed = useEmbed(url);
  const isOembed = validOembedCheck(oembed, url);

  if (isText) {
    return (
      <div className="heap-block px-2 py-1">
        <HeapContent content={content} />
      </div>
    );
  }

  if (isImage) {
    return (
      <div
        className="heap-block"
        style={{
          backgroundImage: `url(${content[0]})`,
        }}
      />
    );
  }

  if (isOembed) {
    const thumbnail = oembed.read().thumbnail_url;
    const provider = oembed.read().provider_name;
    console.log({ thumbnail, provider, oembed: oembed.read() });
    if (provider === 'YouTube' || provider === 'SoundCloud') {
      return (
        <div
          className="heap-block"
          style={{
            backgroundImage: `url(${oembed.read().thumbnail_url})`,
          }}
        />
      );
    }
    if (provider === 'Twitter') {
      const author = oembed.read().author_name;
      const twitterHandle = oembed.read().author_url.split('/').pop();
      const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}`;
      const tweetLink = oembed.read().url;
      return (
        <div className="heap-block group flex flex-col justify-between p-2">
          <div className="flex items-center justify-between">
            <TwitterIcon className="m-2 h-6 w-6" />
            <div className="flex text-sm text-gray-600">
              <div className="hidden group-hover:block">
                <IconButton
                  icon={<OpenSmallIcon className="h-4 w-4" />}
                  action={() => console.log('expand')}
                  label="expand"
                  className="-mx-1"
                />
              </div>
              <div className="hidden group-hover:block">
                <IconButton
                  icon={<ElipsisSmallIcon className="h-4 w-4" />}
                  action={() => console.log('options')}
                  label="options"
                  className="-mx-1"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <img
              className="h-[46px] w-[46px] rounded-full"
              src={twitterProfilePic}
              alt={author}
            />
            <span className="font-semibold text-black">{author}</span>
            <span className="text-gray-300">@{twitterHandle}</span>
          </div>
          <div className="-m-2 h-[50px]">
            <div className="hidden h-[50px] w-full border-t-2 border-gray-100 p-2 group-hover:block">
              <div className="flex flex-col">
                <span className="truncate font-semibold text-gray-800">
                  {tweetLink}
                </span>
                <div className="items center flex justify-between">
                  <div className="flex items-center space-x-1 text-sm font-semibold">
                    <span className="text-gray-600">Twitter</span>
                    <span className="text-lg text-gray-200"> • </span>
                    <span className="text-gray-400">{prettySent} ago</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm font-semibold text-gray-400">
                    <span>{replying}</span>
                    <ChatSmallIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="heap-block px-2 py-1">
        <HeapContent content={content} />
      </div>
    );
  }

  return <div className="heap-block">{content[0]}</div>;
}
