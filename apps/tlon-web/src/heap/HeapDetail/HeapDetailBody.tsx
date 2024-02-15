import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ContentReference from '@/components/References/ContentReference';
import HeapAudioPlayer from '@/heap/HeapAudioPlayer';
import HeapContent from '@/heap/HeapContent';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';
import HeapDetailEmbed from '@/heap/HeapDetail/HeapDetailEmbed';
import { linkUrlFromContent } from '@/logic/channel';
import getHeapContentType from '@/logic/useHeapContentType';
import { useIsMobile } from '@/logic/useMedia';
import { validOembedCheck } from '@/logic/utils';
import { useEmbed } from '@/state/embed';
import { useCalm } from '@/state/settings';
import {
  PostEssay,
  VerseBlock,
  imageUrlFromContent,
  isCite,
} from '@/types/channel';
import { useEffect } from 'react';

import HeapVideoPlayer from '../HeapVideoPlayer';
import HeapVimeoPlayer from '../HeapVimeoPlayer';
import HeapYoutubePlayer from '../HeapYoutubePlayer';

export default function HeapDetailBody({ essay }: { essay?: PostEssay }) {
  const calm = useCalm();
  const isMobile = useIsMobile();
  const { content } = essay || { content: [] };
  const url = linkUrlFromContent(content) || imageUrlFromContent(content) || '';
  const { embed, isError, error } = useEmbed(url, isMobile);
  const { isImage, isText, isAudio, isVideo } = getHeapContentType(url);
  const blocks = content.filter(
    (b) => 'block' in b && isCite(b.block)
  ) as VerseBlock[];
  const block = blocks[0]?.block;

  useEffect(() => {
    if (isError) {
      console.log(`HeapDetailBody: embed failed to load`, error);
    }
  }, [isError, error]);

  if (!essay) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center bg-gray-50 p-8 text-[17px] leading-[26px]">
        <div className="max-h-[100%] min-w-32 max-w-prose overflow-y-auto rounded-md bg-white">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (block && 'cite' in block) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center bg-gray-50 p-8 text-[17px] leading-[26px]">
        <div className="max-h-[100%] min-w-32 max-w-prose overflow-y-auto rounded-md bg-white">
          <ContentReference contextApp="heap-detail" cite={block.cite} />
        </div>
      </div>
    );
  }

  if (isText) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center bg-gray-50 p-8 text-[17px] leading-[26px]">
        <div className="max-h-[100%] max-w-prose overflow-y-auto">
          <HeapContent content={content} />
        </div>
      </div>
    );
  }

  if (isAudio && !calm.disableRemoteContent) {
    return <HeapAudioPlayer source={url} />;
  }

  if (isVideo && !calm.disableRemoteContent) {
    return <HeapVideoPlayer source={url} />;
  }

  if (isImage && !calm.disableRemoteContent) {
    return (
      <div className="flex justify-center bg-gray-50 lg:h-full lg:w-full">
        <img className="object-contain" src={url} alt="" />
      </div>
    );
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && embed && !calm.disableRemoteContent) {
    const provider = embed.provider_url as string;

    let embedComponent = <HeapDetailEmbed oembed={embed} url={url} />;

    if (provider.includes('youtube.com')) {
      embedComponent = <HeapYoutubePlayer embed={embed} />;
    }

    if (provider.includes('vimeo.com')) {
      embedComponent = <HeapVimeoPlayer embed={embed} />;
    }

    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        {embedComponent}
      </div>
    );
  }

  return <EmbedFallback url={url} />;
}
