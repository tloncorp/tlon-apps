import Dialog, { DialogContent } from '@/components/Dialog';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import { useIsMobile } from '@/logic/useMedia';
import React, { useState } from 'react';

interface YouTubeEmbedProps {
  url: string;
  title: string;
  thumbnail: string;
  author: string;
  authorUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export default function YouTubeEmbed({
  url,
  title,
  thumbnail,
  author,
  authorUrl,
  thumbnailWidth,
  thumbnailHeight,
}: YouTubeEmbedProps) {
  const videoId = url.split('v=')[1];
  const [showIframeModal, setShowIframeModal] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="embed-inline-block">
      <div
        style={{
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          width: thumbnailWidth,
          height: thumbnailHeight,
        }}
        className="rounded"
      />
      <div
        onClick={() => setShowIframeModal(true)}
        className="absolute left-[182.5px] flex cursor-pointer items-center text-xl text-white"
      >
        <CaretRightIcon className="h-6 w-6" />
        <span>Click to Play</span>
      </div>
      <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
        <span className="font-bold">YouTube</span>
        <span className="text-gray-300">&middot;</span>
        <a
          href={url}
          className="truncate font-semibold text-gray-800 underline"
        >
          {title}
        </a>
        <span className="font-semibold text-gray-800">&middot;</span>
        <a href={authorUrl} className="font-semibold text-gray-800 underline">
          {author}
        </a>
      </div>
      <Dialog
        open={showIframeModal}
        onOpenChange={(open) => setShowIframeModal(open)}
      >
        <DialogContent>
          <iframe
            className={isMobile ? 'h-[240px] w-[320px]' : 'h-[480px] w-[640px]'}
            src={`https://www.youtube.com/embed/${videoId}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
