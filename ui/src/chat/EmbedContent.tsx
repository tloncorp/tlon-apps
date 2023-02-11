import _ from 'lodash';
import React, { memo, useEffect, useMemo, useState } from 'react';
import EmbedContainer from 'react-oembed-container';
import { isValidUrl, validOembedCheck } from '@/logic/utils';
import { useCalm } from '@/state/settings';
import useEmbedState from '@/state/embed';
// eslint-disable-next-line import/no-cycle
import useHeapContentType from '@/logic/useHeapContentType';
import EmbedFallback from '@/heap/HeapDetail/EmbedFallback';
import { useIsMobile } from '@/logic/useMedia';

export const EmbedContent = memo(
  ({ url, isScrolling }: { url: string; isScrolling: boolean }) => {
    const [embed, setEmbed] = useState<any>();
    const [isClicked, setIsClicked] = useState(false);
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

      console.log({ embed });

      if (provider === 'YouTube') {
        const videoId = url.split('v=')[1];
        return (
          <div className="embed-inline-block">
            {isClicked ? (
              <iframe
                className={
                  isMobile ? 'h-[240px] w-[320px]' : 'h-[480px] w-[640px]'
                }
                src={`https://www.youtube.com/embed/${videoId}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
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
                <span
                  onClick={() => setIsClicked(true)}
                  className="absolute left-[195px] cursor-pointer text-xl text-white"
                >
                  Click to Play
                </span>
              </>
            )}
            <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
              <span className="font-bold">YouTube</span>
              <span className="text-gray-300">&middot;</span>
              <a href={embedUrl} className="text-gray-300 underline">
                {title}
              </a>
              <span className="text-gray-300">&middot;</span>
              <a href={authorUrl} className="text-gray-300 underline">
                {author}
              </a>
            </div>
          </div>
        );
      }

      // }
      // if (provider === 'Twitter') {
      // console.log({ embed });
      // const author = embed.author_name;
      // const twitterHandle = embed.author_url.split('/').pop();
      // const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}?fallback=false`;
      // const { html } = embed;
      // const element = document.createElement('html');
      // element.innerHTML = html;
      // const tweetText = element.querySelector('p')?.innerHTML || '';
      // const tweetContainsImage = tweetText.includes('pic.twitter.com');
      // const tweetImage = tweetContainsImage
      // ? tweetText.split('pic.twitter.com')[0]
      // : '';
      // const tweetDate =
      // Array.from(element.querySelectorAll('a')).filter(
      // (a) =>
      // a.href.includes('https://twitter.com') &&
      // !a.href.includes('pic.twitter.com')
      // )[0].innerHTML || '';
      // const tweetUrl =
      // Array.from(element.querySelectorAll('a'))
      // .filter(
      // (a) =>
      // a.href.includes('https://twitter.com') &&
      // !a.href.includes('pic.twitter.com')
      // )[0]
      // .getAttribute('href') || '';
      // const tweetId = tweetUrl.split('/').pop()?.split('?')[0];

      // console.log({
      // tweetText,
      // tweetDate,
      // tweetUrl,
      // tweetId,
      // tweetImage,
      // tweetContainsImage,
      // });
      // return <Tweet tweetId={tweetId || ''} options={{ cards: 'hidden' }} />;
      // // return (
      // // <div className="flex">
      // // <TwitterIcon className="m-2 h-6 w-6" />
      // // <div className="flex grow flex-col justify-center space-y-2">
      // // <blockquote>
      // // <p className="text-sm font-medium text-gray-900">{tweetText}</p>
      // // </blockquote>
      // // <div className="flex items-center space-x-2 text-sm">
      // // <span className="font-semibold text-black">{author}</span>
      // // <span className="text-gray-300">@{twitterHandle}</span>
      // // <span className="text-gray-300">&middot;</span>
      // // <a
      // // target="_blank"
      // // rel="noreferrer"
      // // href={tweetUrl}
      // // className="text-gray-300 underline"
      // // >
      // // {tweetDate}
      // // </a>
      // // </div>
      // // </div>
      // // </div>
      // // );
      // }

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
);

export default EmbedContent;
