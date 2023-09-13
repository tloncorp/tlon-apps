import { useEffect } from 'react';
import getHeapContentType from '@/logic/useHeapContentType';
import { useEmbed } from '@/state/embed';
import { validOembedCheck } from '@/logic/utils';
import HeapContent from '@/heap/HeapContent';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';
import HeapDetailEmbed from '@/heap/HeapDetail/HeapDetailEmbed';
import { useIsMobile } from '@/logic/useMedia';
import HeapAudioPlayer from '@/heap/HeapAudioPlayer';
import ContentReference from '@/components/References/ContentReference';
import { useCalm } from '@/state/settings';
import {
  Cite,
  isCite,
  VerseBlock,
  linkUrlFromContent,
  imageUrlFromContent,
  NoteEssay,
} from '@/types/channel';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import HeapYoutubePlayer from '../HeapYoutubePlayer';
import HeapVimeoPlayer from '../HeapVimeoPlayer';
import HeapVideoPlayer from '../HeapVideoPlayer';

export default function HeapDetailBody({ essay }: { essay?: NoteEssay }) {
  const calm = useCalm();
  const isMobile = useIsMobile();
  const { content } = essay || { content: [] };
  const url = linkUrlFromContent(content) || imageUrlFromContent(content) || '';
  const { embed, isError, error } = useEmbed(url, isMobile);
  const { isImage, isText, isAudio, isVideo } = getHeapContentType(url);

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

  if (
    content.filter((b) => 'block' in b).length > 0 &&
    isCite((content.filter((b) => 'block' in b)[0] as VerseBlock).block)
  ) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center bg-gray-50 p-8 text-[17px] leading-[26px]">
        <div className="max-h-[100%] min-w-32 max-w-prose overflow-y-auto rounded-md bg-white">
          <ContentReference
            contextApp="heap-detail"
            cite={
              (content.filter((b) => 'inline' in b)[0] as VerseBlock)
                .block as Cite
            }
          />
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
