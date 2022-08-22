import React from 'react';
import useHeapContentType from '@/logic/useHeapContentType';
import { HeapCurio } from '@/types/heap';
import HeapContent from '@/heap/HeapContent';
import EmbedFallback from './EmbedFallback';
import HeapDetailEmbed from './HeapDetailEmbed';

export default function HeapDetailBody({ curio }: { curio: HeapCurio }) {
  const { content } = curio.heart;
  const url = content[0].toString();

  const { isText, isImage, isAudio, isVideo, oembed, isOembed } =
    useHeapContentType(url);

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

  if (isOembed) {
    return <HeapDetailEmbed oembed={oembed} url={url} />;
  }

  return <EmbedFallback url={url} />;
}
