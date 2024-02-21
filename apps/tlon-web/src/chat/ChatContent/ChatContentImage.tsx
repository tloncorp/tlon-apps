import React, { useState } from 'react';
import { useParams } from 'react-router';

import LightBox from '@/components/LightBox';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { useCalm } from '@/state/settings';

import { useChatDialog, useChatFailedToLoadContent } from '../useChatStore';

interface ChatContentImage {
  src: string;
  height?: number;
  width?: number;
  altText?: string;
  writId?: string;
  blockIndex: number;
}

export default function ChatContentImage({
  src,
  height,
  width,
  altText,
  writId,
  blockIndex,
}: ChatContentImage) {
  const { chShip, chName } = useParams<{
    chShip: string;
    chName: string;
  }>();
  const whom = `${chShip}/${chName}`;
  const calm = useCalm();
  const { failedToLoad, setFailedToLoad } = useChatFailedToLoadContent(
    whom,
    writId || 'not-writ',
    blockIndex
  );
  const { open: showLightBox, setOpen: setShowLightBox } = useChatDialog(
    whom,
    writId || 'not-writ',
    `image-${blockIndex}`
  );

  if (failedToLoad) {
    return (
      <div className="embed-inline-block group">
        <div className="flex h-full flex-col items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <ExclamationPoint className="h-6 w-6 text-gray-400" />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900">
            Failed to load image
          </p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="default-focus mt-2 text-sm text-gray-900 underline"
          >
            {src}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative w-full py-2"
      style={{ maxWidth: width ? (width > 600 ? 600 : width) : 600 }}
    >
      {calm?.disableRemoteContent ? (
        <a href={src} target="_blank" rel="noreferrer">
          {src}
        </a>
      ) : (
        <button
          className="default-focus rounded"
          onClick={() => setShowLightBox(true)}
        >
          <img
            src={src}
            onError={() => setFailedToLoad(true)}
            className="max-h-[50vh] max-w-full cursor-pointer rounded"
            alt={altText ? altText : 'A chat image'}
          />
        </button>
      )}
      <LightBox
        source={src}
        showLightBox={showLightBox}
        setShowLightBox={setShowLightBox}
      >
        <img
          src={src}
          className="max-h-full w-auto max-w-full rounded-lg"
          height={height}
          width={width}
          alt={altText ? altText : 'A chat image'}
        />
      </LightBox>

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
