import DOMPurify from 'dompurify';
import React, { useEffect } from 'react';
import { BigPlayButton, Player } from 'video-react';

import { useIsMobile } from '@/logic/useMedia';
import { AUDIO_REGEX, VIDEO_REGEX, validOembedCheck } from '@/logic/utils';
import { useEmbed } from '@/state/embed';
import { useCalm } from '@/state/settings';

import AudioPlayer from './AudioPlayer';
import SpotifyEmbed from './SpotifyEmbed';
import TwitterEmbed from './TwitterEmbed';
import YouTubeEmbed from './YouTubeEmbed';

const trustedProviders = [
  {
    name: 'YouTube',
    regex: /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=|youtu\.be\//,
  },
  {
    name: 'Twitter',
    regex: /^https:\/\/(?:twitter\.com|x\.com)\/\w+\/status\//,
  },
  {
    name: 'Spotify',
    regex: /^https:\/\/open\.spotify\.com\//,
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
  const { embed, isError, error } = useEmbed(url);
  const calm = useCalm();
  const isMobile = useIsMobile();
  const isAudio = AUDIO_REGEX.test(url);
  const isVideo = VIDEO_REGEX.test(url);
  const isTrusted = trustedProviders.some((provider) =>
    provider.regex.test(url)
  );

  useEffect(() => {
    if (isError) {
      console.log(`chat embed failed to load:`, error);
    }
  }, [isError, error]);

  if (url !== content) {
    // secure URL protocol regex borrowed from dompurify:
    // https://github.com/cure53/DOMPurify/blob/main/src/regexp.js#L9-L11
    const IS_ALLOWED_URI =
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i; // eslint-disable-line no-useless-escape
    if (!IS_ALLOWED_URI.test(url)) {
      // disallow javascript: urls and other risky protocols
      return <a href="#">{content}</a>;
    }
    return (
      <a target="_blank" rel="noreferrer" href={url}>
        {content}
      </a>
    );
  }

  if (isVideo) {
    return (
      <div className="flex max-h-[340px] max-w-[600px] flex-col">
        <Player
          playsInline
          src={url}
          fluid={false}
          width={isMobile ? 300 : 600}
        >
          <BigPlayButton position="center" />
        </Player>
      </div>
    );
  }

  if (isAudio) {
    return <AudioPlayer url={url} embed writId={writId} />;
  }

  const isOembed = isTrusted && validOembedCheck(embed, url);

  if (isOembed && !calm?.disableRemoteContent) {
    const {
      title,
      thumbnail_url: thumbnail,
      provider_name: provider,
      url: embedUrl,
      author_name: author,
      author_url: authorUrl,
      html: rawEmbedHtml,
    } = embed;

    const embedHtml = DOMPurify.sanitize(rawEmbedHtml);

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
