import React from 'react';
import EmbedFallback from './EmbedFallback';

interface HeapDetailEmbedProps {
  oembed: any;
  url: string;
}

export default function HeapDetailEmbed({ oembed, url }: HeapDetailEmbedProps) {
  if (!oembed.html) {
    return <EmbedFallback url={url} />;
  }

  // TODO: re-implement embeds
  return (
    <div
      className="flex h-0 max-h-max max-w-max grow"
      dangerouslySetInnerHTML={{ __html: oembed.html }}
    />
  );
}
