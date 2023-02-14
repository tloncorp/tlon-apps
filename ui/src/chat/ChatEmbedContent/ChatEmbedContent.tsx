import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import useEmbedState from '@/state/embed';
// eslint-disable-next-line import/no-cycle
import useHeapContentType from '@/logic/useHeapContentType';
import HeapDetailEmbed from '@/heap/HeapDetail/HeapDetailEmbed';
import YouTubeEmbed from './YouTubeEmbed';
import TwitterEmbed from './TwitterEmbed';
import SpotifyEmbed from './SpotifyEmbed';
import AudioPlayer from './AudioPlayer';

export default function ChatEmbedContent({
  url,
  isScrolling,
}: {
  url: string;
  isScrolling: boolean;
}) {
  const [embed, setEmbed] = useState<any>();
  const calm = useCalm();
  const { isAudio } = useHeapContentType(url);

  useEffect(() => {
    const getOembed = async () => {
      if (isValidUrl(url)) {
        const oembed = await useEmbedState.getState().getEmbed(url);
        setEmbed(oembed);
      }
    };
    getOembed();
  }, [url]);

  if (isAudio && !calm?.disableRemoteContent) {
    return <AudioPlayer url={url} />;
  }

  const isOembed = validOembedCheck(embed, url);

  if (isOembed && !calm?.disableRemoteContent && !isScrolling) {
    const {
      title,
      thumbnail_url: thumbnail,
      thumbnail_width: thumbnailWidth,
      thumbnail_height: thumbnailHeight,
      provider_name: provider,
      url: embedUrl,
      author_name: author,
      author_url: authorUrl,
      html: embedHtml,
    } = embed;

    if (provider === 'YouTube') {
      return (
        <YouTubeEmbed
          url={embedUrl}
          title={title}
          thumbnail={thumbnail}
          author={author}
          authorUrl={authorUrl}
          thumbnailWidth={thumbnailWidth}
          thumbnailHeight={thumbnailHeight}
        />
      );
    }

    if (provider === 'Twitter') {
      return (
        <TwitterEmbed
          authorUrl={authorUrl}
          author={author}
          embedHtml={embedHtml}
        />
      );
    }

    if (provider === 'Spotify') {
      return (
        <SpotifyEmbed
          url={url}
          title={title}
          thumbnailUrl={thumbnail}
          thumbnailWidth={thumbnailWidth}
          thumbnailHeight={thumbnailHeight}
        />
      );
    }

    return (
      <a target="_blank" rel="noreferrer" href={url}>
        {url}
      </a>
    );
  }

  return (
    <a target="_blank" rel="noreferrer" href={url}>
      {url}
    </a>
  );
}
