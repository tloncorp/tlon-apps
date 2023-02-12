import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import EmbedContainer from 'react-oembed-container';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import useEmbedState from '@/state/embed';
// eslint-disable-next-line import/no-cycle
import useHeapContentType from '@/logic/useHeapContentType';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';
import { useIsMobile } from '@/logic/useMedia';
import TwitterIcon from '@/components/icons/TwitterIcon';
import CaretRight16Icon from '@/components/icons/CaretRight16Icon';
import Dialog, { DialogContent } from '@/components/Dialog';

export default function EmbedContent({
  url,
  isScrolling,
}: {
  url: string;
  isScrolling: boolean;
}) {
  const [embed, setEmbed] = useState<any>();
  const [showIframeModal, setShowIframeModal] = useState(false);
  const calm = useCalm();
  const isMobile = useIsMobile();
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

  // if (isAudio && !calm?.disableRemoteContent) {
  // return (
  // <div>
  // <TopBar hasIcon />
  // <div className="flex grow flex-col items-center justify-center">
  // <MusicLargeIcon className="h-16 w-16 text-gray-300" />
  // </div>
  // <BottomBar provider="Audio" title={url} />
  // </div>
  // );
  // }

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
    } = embed;

    if (provider === 'YouTube') {
      const videoId = url.split('v=')[1];
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
            <CaretRight16Icon className="h-6 w-6" />
            <span>Click to Play</span>
          </div>
          <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
            <span className="font-bold">YouTube</span>
            <span className="text-gray-300">&middot;</span>
            <a
              href={embedUrl}
              className="truncate font-semibold text-gray-800 underline"
            >
              {title}
            </a>
            <span className="font-semibold text-gray-800">&middot;</span>
            <a
              href={authorUrl}
              className="font-semibold text-gray-800 underline"
            >
              {author}
            </a>
          </div>
          <Dialog
            open={showIframeModal}
            onOpenChange={(open) => setShowIframeModal(open)}
          >
            <DialogContent>
              <iframe
                className={
                  isMobile ? 'h-[240px] w-[320px]' : 'h-[480px] w-[640px]'
                }
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

    if (provider === 'Twitter') {
      const twitterHandle = embed.author_url.split('/').pop();
      // unavatar now charges for this after 50 requests per day
      const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}?fallback=false`;
      const { html } = embed;
      const element = document.createElement('html');
      element.innerHTML = html;
      const tweetText = element.querySelector('p')?.innerHTML || '';
      const tweetContainsLink = tweetText.includes('<a href=');
      const tweetTextWithoutLink = tweetText.split('<a href=')[0];
      const tweetLink = tweetContainsLink
        ? tweetText.split('<a href="')[1].split('">')[0]
        : '';
      const tweetDate =
        Array.from(element.querySelectorAll('a')).filter(
          (a) =>
            a.href.includes('https://twitter.com') &&
            !a.href.includes('pic.twitter.com')
        )[0].innerHTML || '';
      const tweetUrl =
        Array.from(element.querySelectorAll('a'))
          .filter(
            (a) =>
              a.href.includes('https://twitter.com') &&
              !a.href.includes('pic.twitter.com')
          )[0]
          .getAttribute('href') || '';

      return (
        <div className="embed-inline-block max-w-[370px]">
          <div className="flex grow flex-col justify-center space-y-2">
            <blockquote>
              {tweetContainsLink ? (
                <>
                  <p className="font-medium text-gray-900">
                    {tweetTextWithoutLink}
                  </p>
                  <p className="font-medium text-gray-900">
                    <a
                      href={tweetLink}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tweetLink}
                    </a>
                  </p>
                </>
              ) : (
                <p className="font-medium text-gray-900">{tweetText}</p>
              )}
            </blockquote>
            <div className="flex items-center space-x-2 text-sm">
              <TwitterIcon className="h-4 w-4" />
              <span className="truncate font-semibold text-black">
                {author}
              </span>
              <span className="text-gray-300">@{twitterHandle}</span>
              <span className="text-gray-300">&middot;</span>
              <a
                target="_blank"
                rel="noreferrer"
                href={tweetUrl}
                className="text-gray-300 underline"
              >
                {tweetDate}
              </a>
            </div>
          </div>
        </div>
      );
    }

    const { html } = embed;

    if (!html) {
      return <EmbedFallback url={url} />;
    }

    return (
      <EmbedContainer className="flex max-h-full" markup={html}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </EmbedContainer>
    );
  }

  return (
    <a target="_blank" rel="noreferrer" href={url}>
      {url}
    </a>
  );
}
