import React, { useState, useEffect } from 'react';
import useHeapContentType from '@/logic/useHeapContentType';
import useEmbedState from '@/state/embed';
import { validOembedCheck } from '@/logic/utils';
import { HeapCurio } from '@/types/heap';
import HeapContent from '@/heap/HeapContent';
import EmbedFallback from './EmbedFallback';
import HeapDetailEmbed from './HeapDetailEmbed';

export default function HeapDetailBody({ curio }: { curio: HeapCurio }) {
  const [embed, setEmbed] = useState<any>();
  const { content } = curio.heart;
  const url = content[0].toString();

  const { isText, isImage, isAudio, isVideo } = useHeapContentType(url);

  useEffect(() => {
    const getOembed = async () => {
      const oembed = await useEmbedState.getState().getEmbed(url);
      setEmbed(oembed);
    };
    getOembed();
  }, [url]);

  const isOembed = validOembedCheck(embed, url);

  if (isText) {
    return (
      <div className="mx-auto mt-3 max-w-prose">
        <HeapContent content={content} />
      </div>
    );
  }

  if (isAudio) {
    // TODO: AUDIO PLAYER
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

  if (isOembed && embed !== undefined) {
    return <HeapDetailEmbed oembed={embed} url={url} />;
  }

  return <EmbedFallback url={url} />;
}
