import TwitterIcon from '@/components/icons/TwitterIcon';
import React from 'react';

interface TwitterEmbedProps {
  authorUrl: string;
  author: string;
  embedHtml: string;
}

export default function TwitterEmbed({
  authorUrl,
  author,
  embedHtml,
}: TwitterEmbedProps) {
  const twitterHandle = authorUrl.split('/').pop();
  // unavatar now charges for this after 50 requests per day
  const twitterProfilePic = `https://unavatar.io/twitter/${twitterHandle}?fallback=false`;
  const element = document.createElement('html');
  element.innerHTML = embedHtml;
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
          <span className="truncate font-semibold text-black">{author}</span>
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
