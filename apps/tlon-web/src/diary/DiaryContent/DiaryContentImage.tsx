import React from 'react';

import { useCalm } from '@/state/settings';

interface DiaryContentImage {
  src: string;
  height?: number;
  width?: number;
  altText?: string;
}

export default function DiaryContentImage({
  src,
  height,
  width,
  altText,
}: DiaryContentImage) {
  const h = height === 0 ? undefined : height;
  const w = width === 0 ? undefined : width;
  const calm = useCalm();

  return (
    <div
      className="group relative w-full"
      style={{ maxWidth: width ? (width > 600 ? 600 : w) : 600 }}
    >
      <a href={src} target="_blank" rel="noreferrer">
        {calm?.disableRemoteContent ? (
          <span>{src}</span>
        ) : (
          <img
            src={src}
            className="max-w-full rounded-lg"
            height={h}
            width={w}
            alt={altText ? altText : 'A Diary image'}
          />
        )}
      </a>
    </div>
  );
}
