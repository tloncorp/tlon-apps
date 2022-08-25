import React from 'react';
import EmbedContainer from 'react-oembed-container';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';

interface HeapDetailEmbedProps {
  oembed: any;
  url: string;
}

export default function HeapDetailEmbed({ oembed, url }: HeapDetailEmbedProps) {
  const { html } = oembed;

  if (!html) {
    return <EmbedFallback url={url} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <EmbedContainer markup={html}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </EmbedContainer>
    </div>
  );
}
