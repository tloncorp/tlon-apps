import React, { useEffect, useState } from 'react';
import { AUDIO_REGEX, isValidUrl, validOembedCheck } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import useEmbedState from '@/state/embed';
import YouTubeEmbed from './YouTubeEmbed';
import TwitterEmbed from './TwitterEmbed';
import SpotifyEmbed from './SpotifyEmbed';
import AudioPlayer from './AudioPlayer';

const trustedProviders = [
  {
    name: 'YouTube',
    regex: /youtube\.com\/watch\?v=|youtu\.be\//,
  },
  {
    name: 'Twitter',
    regex: /twitter\.com\/\w+\/status\//,
  },
  {
    name: 'Spotify',
    regex: /open\.spotify\.com\//,
  },
];

function ChatEmbedContent({
  url,
  content,
  writId,
}: {
  url: string;
  content: string;
  writId: string;
}) {
  const [embed, setEmbed] = useState<any>();
  const calm = useCalm();
  const isAudio = AUDIO_REGEX.test(url);
  const isTrusted = trustedProviders.some((provider) =>
    provider.regex.test(url)
  );

  useEffect(() => {
    const getOembed = async () => {
      if (
        isValidUrl(url) &&
        isTrusted &&
        !calm?.disableRemoteContent &&
        !isAudio
      ) {
        const oembed = await useEmbedState.getState().getEmbed(url);
        setEmbed(oembed);
      }
    };
    getOembed();

    return () => {
      setEmbed(null);
    };
  }, [url, calm, isTrusted, isAudio]);

  if (url !== content) {
    return (
      <a target="_blank" rel="noreferrer" href={url}>
        {content}
      </a>
    );
  }

  if (isAudio) {
    return <AudioPlayer url={url} embed writId={writId} />;
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && !calm?.disableRemoteContent) {
    const {
      title,
      thumbnail_url: thumbnail,
      provider_name: provider,
      url: embedUrl,
      author_name: author,
      author_url: authorUrl,
      html: embedHtml,
    } = embed;

    if (provider === 'YouTube') {
      return (
        <div className="flex flex-col">
          <YouTubeEmbed
            url={embedUrl}
            title={title}
            thumbnail={thumbnail}
            author={author}
            authorUrl={authorUrl}
            writId={writId}
          />
        </div>
      );
    }

    if (provider === 'Twitter') {
      return (
        <div className="flex w-[300px] flex-col sm:w-full">
          <TwitterEmbed embedHtml={embedHtml} />
        </div>
      );
    }

    if (provider === 'Spotify') {
      return (
        <div className="flex flex-col">
          <SpotifyEmbed
            url={url}
            title={title}
            thumbnailUrl={thumbnail}
            writId={writId}
          />
        </div>
      );
    }

    return (
      <a target="_blank" rel="noreferrer" href={url}>
        {content}
      </a>
    );
  }

  return (
    <a target="_blank" rel="noreferrer" href={url}>
      {content}
    </a>
  );
}

export default React.memo(ChatEmbedContent);
