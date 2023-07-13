import React, { useState, useEffect } from 'react';
import useHeapContentType from '@/logic/useHeapContentType';
import useEmbedState from '@/state/embed';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { HeapCurio, isLink } from '@/types/heap';
import HeapContent from '@/heap/HeapContent';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';
import HeapDetailEmbed from '@/heap/HeapDetail/HeapDetailEmbed';
import { useIsMobile } from '@/logic/useMedia';
import HeapAudioPlayer from '@/heap/HeapAudioPlayer';
import ContentReference from '@/components/References/ContentReference';
import { useCalm } from '@/state/settings';

export default function HeapDetailBody({ curio }: { curio: HeapCurio }) {
  const [embed, setEmbed] = useState<any>();
  const calm = useCalm();
  const { content } = curio.heart;
  const url =
    content.inline.length > 0 && isLink(content.inline[0])
      ? content.inline[0].link.href
      : '';
  const isMobile = useIsMobile();
  const { isText, isImage, isAudio, isVideo } = useHeapContentType(url);
  const maybeEmbed = !isImage && !isAudio && !isText;

  useEffect(() => {
    const getOembed = async () => {
      if (isValidUrl(url) && maybeEmbed && !calm.disableRemoteContent) {
        const oembed = await useEmbedState.getState().getEmbed(url, isMobile);
        setEmbed(oembed);
      }
    };
    getOembed();
  }, [url, isMobile, maybeEmbed, calm.disableRemoteContent]);

  if (content.block.length > 0 && 'cite' in content.block[0]) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center bg-gray-50 p-8 text-[18px] leading-[26px]">
        <div className="max-h-[100%] min-w-32 max-w-prose overflow-y-auto rounded-md bg-white">
          <ContentReference
            contextApp="heap-detail"
            cite={content.block[0].cite}
          />
        </div>
      </div>
    );
  }

  if (isText) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center bg-gray-50 p-8 text-[18px] leading-[26px]">
        <div className="max-h-[100%] max-w-prose overflow-y-auto">
          <HeapContent content={content} />
        </div>
      </div>
    );
  }

  if (isAudio && !calm.disableRemoteContent) {
    return <HeapAudioPlayer source={url} />;
  }

  if (isVideo) {
    // TODO: VIDEO PLAYER
  }

  if (isImage && !calm.disableRemoteContent) {
    return (
      <div className="flex justify-center bg-gray-50 lg:h-full lg:w-full">
        <img className="object-contain" src={url} alt="" />
      </div>
    );
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && embed !== undefined && !calm.disableRemoteContent) {
    return <HeapDetailEmbed oembed={embed} url={url} />;
  }

  return <EmbedFallback url={url} />;
}
