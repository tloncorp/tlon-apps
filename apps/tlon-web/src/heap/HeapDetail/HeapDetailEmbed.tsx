/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable react/no-danger */
import cn from 'classnames';
import DOMPurify from 'dompurify';
import React from 'react';
import EmbedContainer from 'react-oembed-container';

import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';

interface HeapDetailEmbedProps {
  oembed: any;
  url: string;
}

export default function HeapDetailEmbed({ oembed, url }: HeapDetailEmbedProps) {
  const { html } = oembed;
  const isTwitter = url.match(/twitter\.com/);

  if (!html) {
    return <EmbedFallback url={url} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-gray-50">
      <EmbedContainer
        className={cn('overflow-y-auto md:h-full', {
          'w-[500px]': isTwitter,
          'h-[500px]': isTwitter,
        })}
        markup={html}
      >
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </EmbedContainer>
    </div>
  );
}
