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
import MusicLargeIcon from '@/components/icons/MusicLargeIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import CopyIcon from '@/components/icons/CopyIcon';

function TopBar({
  hasIcon = false,
  isTwitter = false,
}: {
  isTwitter?: boolean;
  hasIcon?: boolean;
}) {
  return (
    <div
      className={
        hasIcon || isTwitter
          ? 'flex items-center justify-between'
          : 'flex items-center justify-end'
      }
    >
      {isTwitter ? <TwitterIcon className="m-2 h-6 w-6" /> : null}
      {hasIcon ? <div className="m-2 h-6 w-6" /> : null}
      <div className="flex space-x-2 text-sm text-gray-600">
        <div className="hidden group-hover:block">
          <IconButton
            icon={<CopyIcon className="h-4 w-4" />}
            action={() => console.log('expand')}
            label="expand"
            className="rounded bg-white"
          />
        </div>
        <div className="hidden group-hover:block">
          <IconButton
            icon={<ElipsisSmallIcon className="h-4 w-4" />}
            action={() => console.log('options')}
            label="options"
            className="rounded bg-white"
          />
        </div>
      </div>
    </div>
  );
}

interface BottomBarProps {
  provider: string;
  prettySent: string;
  url: string;
  replying: string | null;
  title?: string;
}

function BottomBar({
  provider,
  prettySent,
  url,
  replying,
  title,
}: BottomBarProps) {
  return (
    <div className="-m-2 h-[50px]">
      <div className="hidden h-[50px] w-full border-t-2 border-gray-100 bg-white p-2 group-hover:block">
        <div className="flex flex-col">
          <span className="truncate font-semibold text-gray-800">
            {title ? title : url}
          </span>
          <div className="items center flex justify-between">
            <div className="flex items-center space-x-1 text-sm font-semibold">
              <span className="text-gray-600">{provider}</span>
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
  );
}

export default function HeapBlock({ curio }: { curio: HeapCurio }) {
  const { content, sent, replying } = curio.heart;
  const url = content[0].toString();
  const prettySent = formatDistanceToNow(sent);

  const isImage = IMAGE_REGEX.test(url);
  const isAudio = AUDIO_REGEX.test(url);
  const isText = !isValidUrl(url);
  const oembed = useEmbed(url);
  const isOembed = validOembedCheck(oembed, url);

  if (isText) {
    return (
      <div className="heap-block group p-2">
        <TopBar hasIcon />
        <HeapContent content={content} />
        <BottomBar
          provider="Text"
          prettySent={prettySent}
          url={url}
          replying={replying}
          // first three words.
          title={content.toString().split(' ').slice(0, 3).join(' ')}
        />
      </div>
    );
  }

  if (isImage) {
    return (
      <div
        className="heap-block group p-2"
        style={{
          backgroundImage: `url(${url})`,
        }}
      >
        <TopBar />
        <BottomBar
          provider="Image"
          prettySent={prettySent}
          url={url}
          replying={replying}
        />
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="heap-block group p-2">
        <TopBar hasIcon />
        <div className="flex flex-col items-center justify-center">
          <MusicLargeIcon className="h-16 w-16 text-gray-300" />
        </div>
        <BottomBar
          provider="Audio"
          prettySent={prettySent}
          url={url}
          replying={replying}
        />
      </div>
    );
  }

  if (isOembed) {
    const {
      title,
      thumbnail_url: thumbnail,
      provider_name: provider,
    } = oembed.read();

    if (thumbnail) {
      return (
        <div
          className="heap-block group p-2"
          style={{
            backgroundImage: `url(${thumbnail})`,
          }}
        >
          <TopBar />
          <BottomBar
            url={url}
            provider={provider}
            prettySent={prettySent}
            replying={replying}
            title={title}
          />
        </div>
      );
    }
    if (provider === 'Twitter') {
      const author = oembed.read().author_name;
      const twitterHandle = oembed.read().author_url.split('/').pop();
      const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}`;
      return (
        <div className="heap-block group p-2">
          <TopBar isTwitter />
          <div className="flex flex-col items-center justify-center">
            <img
              className="h-[46px] w-[46px] rounded-full"
              src={twitterProfilePic}
              alt={author}
            />
            <span className="font-semibold text-black">{author}</span>
            <span className="text-gray-300">@{twitterHandle}</span>
          </div>
          <BottomBar
            url={url}
            provider={provider}
            prettySent={prettySent}
            replying={replying}
          />
        </div>
      );
    }
    return (
      <div className="heap-block group p-2">
        <TopBar hasIcon />
        <div className="flex flex-col items-center justify-center">
          <LinkIcon className="h-16 w-16 text-gray-300" />
        </div>
        <BottomBar
          url={url}
          provider={provider ? provider : 'Link'}
          prettySent={prettySent}
          replying={replying}
        />
      </div>
    );
  }

  return (
    <div className="heap-block group p-2">
      <TopBar hasIcon />
      <div className="flex flex-col items-center justify-center">
        <LinkIcon className="h-16 w-16 text-gray-300" />
      </div>
      <BottomBar
        url={url}
        provider={'Link'}
        prettySent={prettySent}
        replying={replying}
      />
    </div>
  );
}
