import React from 'react';
import { useParams } from 'react-router';

import LightBox from '@/components/LightBox';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import { useIsMobile } from '@/logic/useMedia';

import { useChatDialog } from '../useChatStore';

interface YouTubeEmbedProps {
  url: string;
  title: string;
  thumbnail: string;
  author: string;
  authorUrl: string;
  writId: string;
}

export default function YouTubeEmbed({
  url,
  title,
  thumbnail,
  author,
  authorUrl,
  writId,
}: YouTubeEmbedProps) {
  const { chShip, chName } = useParams<{
    chShip: string;
    chName: string;
  }>();
  const whom = `${chShip}/${chName}`;
  const videoId = url.split('v=')[1];
  const { open: showIframeModal, setOpen: setShowIframeModal } = useChatDialog(
    whom,
    writId,
    'youtube'
  );
  const isMobile = useIsMobile();

  return (
    <div className="embed-inline-block w-[286px] break-normal">
      <div
        style={{
          backgroundImage: `url(${thumbnail})`,
        }}
        className="h-[200px] w-[250px] rounded bg-cover bg-center"
      />
      <button
        onClick={() => setShowIframeModal(true)}
        className="absolute left-[50%] flex -translate-x-1/2 cursor-pointer items-center text-xl text-white"
      >
        <CaretRightIcon className="h-6 w-6" />
        <span>Click to Play</span>
      </button>
      <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
        <span className="font-bold">YouTube</span>
        <span className="text-gray-800">&middot;</span>
        <a
          href={url}
          className="truncate font-semibold text-gray-800 underline"
          target="_blank"
          rel="noreferrer"
        >
          {title}
        </a>
        <span className="font-semibold text-gray-800">&middot;</span>
        <a
          href={authorUrl}
          className="truncate font-semibold text-gray-800 underline"
          target="_blank"
          rel="noreferrer"
        >
          {author}
        </a>
      </div>
      <LightBox
        showLightBox={showIframeModal}
        setShowLightBox={setShowIframeModal}
        source={url}
      >
        <iframe
          className={isMobile ? 'h-[240px] w-[320px]' : 'h-[480px] w-[640px]'}
          src={`https://www.youtube.com/embed/${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </LightBox>
    </div>
  );
}
