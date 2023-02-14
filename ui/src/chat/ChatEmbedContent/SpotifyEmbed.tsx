import Dialog, { DialogContent } from '@/components/Dialog';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import { useIsMobile } from '@/logic/useMedia';
import React, { useState } from 'react';

interface SpotifyEmbedProps {
  url: string;
  title: string;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export default function SpotifyEmbed({
  url,
  title,
  thumbnailUrl,
  thumbnailWidth,
  thumbnailHeight,
}: SpotifyEmbedProps) {
  const [showIframeModal, setShowIframeModal] = useState(false);
  const trackId = url.split('/')?.pop()?.split('?')[0];
  return (
    <div className="embed-inline-block">
      <div
        style={{
          backgroundImage: `url(${thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          width: thumbnailWidth,
          height: thumbnailHeight,
        }}
        className="rounded"
      />
      <div
        onClick={() => setShowIframeModal(true)}
        className="absolute left-[92.5px] flex cursor-pointer items-center text-xl text-white"
      >
        <CaretRightIcon className="h-6 w-6" />
        <span>Click to Play</span>
      </div>
      <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
        <span className="font-bold">Spotify</span>
        <span className="text-gray-300">&middot;</span>
        <a
          href={url}
          className="truncate font-semibold text-gray-800 underline"
        >
          {title}
        </a>
      </div>
      <Dialog
        open={showIframeModal}
        onOpenChange={(open) => setShowIframeModal(open)}
      >
        <DialogContent>
          <iframe
            className="h-[352px] w-full rounded-lg"
            src={`https://open.spotify.com/embed/track/${trackId}`}
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
