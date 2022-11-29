import React, { useState, useEffect } from 'react';
import useHeapContentType from '@/logic/useHeapContentType';
import useEmbedState from '@/state/embed';
import { validOembedCheck } from '@/logic/utils';
import { HeapCurio, isLink } from '@/types/heap';
import HeapContent from '@/heap/HeapContent';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';
import HeapDetailEmbed from '@/heap/HeapDetail/HeapDetailEmbed';
import { useIsMobile } from '@/logic/useMedia';
import HeapAudioPlayer from '@/heap/HeapAudioPlayer';

export default function HeapDetailBody({ curio }: { curio: HeapCurio }) {
  const [embed, setEmbed] = useState<any>();
  const { content } = curio.heart;
  const url =
    content.length > 0 && isLink(content[0]) ? content[0].link.href : '';
  const isMobile = useIsMobile();

  const { isText, isImage, isAudio, isVideo } = useHeapContentType(url);

  useEffect(() => {
    const getOembed = async () => {
      const oembed = await useEmbedState.getState().getEmbed(url, isMobile);
      setEmbed(oembed);
    };
    getOembed();
  }, [url, isMobile]);

  if (isText) {
    return (
      <div className="mx-auto flex h-full w-full items-center justify-center p-8 text-[18px] leading-[26px]">
        <div className="max-h-[100%] max-w-prose overflow-y-auto">
          <HeapContent content={content} />
        </div>
      </div>
    );
  }

  if (isAudio) {
    return <HeapAudioPlayer source={url} />;
  }

  if (isVideo) {
    // TODO: VIDEO PLAYER
  }

  if (isImage) {
    return (
      <div className="flex h-full w-full justify-center">
        <img className="object-contain" src={url} alt="" />
      </div>
    );
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && embed !== undefined) {
    return <HeapDetailEmbed oembed={embed} url={url} />;
  }

  return <EmbedFallback url={url} />;
}
