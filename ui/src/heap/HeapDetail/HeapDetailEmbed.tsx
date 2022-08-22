import React from 'react';
import { Suspender } from '@/logic/suspend';
import EmbedFallback from './EmbedFallback';

interface HeapDetailEmbedProps {
  oembed: Suspender<any>;
  url: string;
}

export default function HeapDetailEmbed({ oembed, url }: HeapDetailEmbedProps) {
  const embed = oembed.read();

  if (!embed.html) {
    return <EmbedFallback url={url} />;
  }

  // TODO: re-implement embeds
  return (
    // <div className='flex h-full w-full items-center justify-center' >
    // <EmbedContainer
    //   className="flex h-full w-full justify-center py-6"
    //   markup={embed.html}
    // >
    <div
      className="flex h-0 max-h-max max-w-max grow"
      // style={embedBoxStyles({embedHeight: height, embedWidth: width, aspect})}
      dangerouslySetInnerHTML={{ __html: embed.html }}
    />
    // </EmbedContainer>
    //  </div>
  );
}
