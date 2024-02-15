import LightBox from '@/components/LightBox';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import React from 'react';
import { useParams } from 'react-router';

import { useChatDialog } from '../useChatStore';

interface SpotifyEmbedProps {
  url: string;
  title: string;
  thumbnailUrl: string;
  writId: string;
}

export default function SpotifyEmbed({
  url,
  title,
  thumbnailUrl,
  writId,
}: SpotifyEmbedProps) {
  const { chShip, chName } = useParams<{
    chShip: string;
    chName: string;
  }>();
  const whom = `${chShip}/${chName}`;
  const { open: showIframeModal, setOpen: setShowIframeModal } = useChatDialog(
    whom,
    writId,
    'spotify'
  );
  const playlistOrTrack = url.split('/')[3];
  const id = url.split('/')?.pop()?.split('?')[0];
  return (
    <div className="embed-inline-block">
      <div
        style={{
          backgroundImage: `url(${thumbnailUrl})`,
        }}
        className="h-[250px] w-[250px] rounded bg-cover bg-center"
      />
      <button
        onClick={() => setShowIframeModal(true)}
        className="absolute left-[50%] flex -translate-x-1/2 cursor-pointer items-center text-xl text-white"
      >
        <CaretRightIcon className="h-6 w-6" />
        <span>Click to Play</span>
      </button>
      <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
        <span className="font-bold">Spotify</span>
        <span className="text-gray-300">&middot;</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="truncate font-semibold text-gray-800 underline"
        >
          {title}
        </a>
      </div>
      <LightBox
        showLightBox={showIframeModal}
        setShowLightBox={() => setShowIframeModal(false)}
        source={`https://open.spotify.com/embed/${playlistOrTrack}/${id}`}
      >
        <iframe
          className="h-[352px] w-full max-w-[600px] rounded-lg"
          src={`https://open.spotify.com/embed/${playlistOrTrack}/${id}`}
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      </LightBox>
    </div>
  );
}
