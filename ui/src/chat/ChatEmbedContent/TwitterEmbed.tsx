import TwitterIcon from '@/components/icons/TwitterIcon';
import LightBox from '@/components/LightBox';
import { useIsMobile } from '@/logic/useMedia';
import EmbedContainer from 'react-oembed-container';
import React from 'react';
import { useParams } from 'react-router';
import { useChatDialog } from '../useChatStore';

interface TwitterEmbedProps {
  authorUrl: string;
  author: string;
  embedHtml: string;
  writId: string;
}

export default function TwitterEmbed({
  authorUrl,
  author,
  embedHtml,
  writId,
}: TwitterEmbedProps) {
  const { chShip, chName } = useParams<{
    chShip: string;
    chName: string;
  }>();
  const whom = `${chShip}/${chName}`;
  const { open: showIframeModal, setOpen: setShowIframeModal } = useChatDialog(
    whom,
    writId,
    'twitter'
  );
  const isMobile = useIsMobile();
  const twitterHandle = authorUrl.split('/').pop();
  // unavatar now charges for this after 50 requests per day
  const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}?fallback=false`;
  const element = document.createElement('html');
  element.innerHTML = embedHtml;
  const baseTweetText = element.querySelector('p')?.innerHTML || '';
  const tweetText = baseTweetText.replace(/<br\s*\/?>/gm, '\n');
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
    <div className="embed-inline-block max-w-[400px]">
      <div className="flex grow flex-col justify-center space-y-2">
        <blockquote
          className="cursor-pointer"
          onClick={() => setShowIframeModal(true)}
        >
          {tweetContainsLink ? (
            <>
              <p className="whitespace-pre-wrap font-medium text-gray-900">
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
            <p className="whitespace-pre-wrap font-medium text-gray-900">
              {tweetText}
            </p>
          )}
        </blockquote>
        <div className="flex items-center space-x-2 text-sm">
          <TwitterIcon className="h-4 w-4" />
          <span className="truncate font-semibold text-black">{author}</span>
          {!isMobile && (
            <span className="truncate text-gray-300">@{twitterHandle}</span>
          )}
          <span className="text-gray-300">&middot;</span>
          <a
            target="_blank"
            rel="noreferrer"
            href={tweetUrl}
            className="truncate text-gray-300 underline"
          >
            {tweetDate}
          </a>
        </div>
      </div>
      <LightBox
        showLightBox={showIframeModal}
        setShowLightBox={() => setShowIframeModal(false)}
        source={tweetUrl}
      >
        <EmbedContainer
          className="h-[500px] w-[500px] overflow-y-auto md:h-full"
          markup={embedHtml}
        >
          <div dangerouslySetInnerHTML={{ __html: embedHtml }} />
        </EmbedContainer>
      </LightBox>
    </div>
  );
}
