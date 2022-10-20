import React from 'react';
import { useCalm } from '@/state/settings';

interface ChatContentImage {
  src: string;
  height?: number;
  width?: number;
  altText?: string;
}

export default function ChatContentImage({
  src,
  height,
  width,
  altText,
}: ChatContentImage) {
  const calm = useCalm();

  return (
    <div
      className="group relative w-full py-2"
      style={{ maxWidth: width ? (width > 600 ? 600 : width) : 600 }}
    >
      <a href={src} target="_blank" rel="noreferrer">
        {calm?.disableRemoteContent ? (
          <span>{src}</span>
        ) : (
          <img
            src={src}
            className="max-w-full rounded"
            height={height}
            width={width}
            alt={altText ? altText : 'A chat image'}
          />
        )}
      </a>
      {/*
        TODO: put these icons back in after they've been finalized by design.
        <div className="absolute top-5 right-[11px] flex space-x-2 text-white opacity-0 group-hover:opacity-100">
          <a
            className="h-[18px] w-[18px] cursor-pointer"
            href={src}
            target="_blank"
            rel="noreferrer"
          >
            <ExpandIcon />
          </a>
          <button
            className="h-[18px] w-[18px] cursor-pointer"
            onClick={() => console.log('hi')}
          >
            <ElipsisCircleIcon />
          </button>
        </div>
      */}
    </div>
  );
}
