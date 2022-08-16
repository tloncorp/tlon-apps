import React, { Suspense } from 'react';
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

export default function HeapBlock({ curio }: { curio: HeapCurio }) {
  const { content } = curio.heart;
  const url = content[0].toString();

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
        <div className="heap-block group flex flex-col justify-between p-4">
          <TwitterIcon />
          <div className="flex flex-col items-center justify-center">
            <img
              className="h-[46px] w-[46px] rounded-full"
              src={twitterProfilePic}
              alt={author}
            />
            <span className="font-semibold text-black">{author}</span>
            <span className="text-gray-300">@{twitterHandle}</span>
          </div>
          <div>
            <div className="border-top hidden border-2 group-hover:block">
              <span className="font-semibold text-gray-100">{tweetLink}</span>
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
