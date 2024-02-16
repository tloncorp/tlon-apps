/* eslint-disable react/no-danger */
import DOMPurify from 'dompurify';
import { Tweet, useTweet } from 'react-tweet';

import TwitterXIcon from '@/components/icons/TwitterXIcon';

interface TwitterEmbedProps {
  embedHtml: string;
}

export default function TwitterEmbed({ embedHtml }: TwitterEmbedProps) {
  const element = document.createElement('html');
  element.innerHTML = DOMPurify.sanitize(embedHtml);
  const tweetUrl =
    Array.from(element.querySelectorAll('a'))
      .filter(
        (a) =>
          a.href.startsWith('https://twitter.com') &&
          !a.href.includes('pic.twitter.com') &&
          a.href.includes('/status/') &&
          a.href.includes('ref_src=twsrc%5Etfw')
      )[0]
      .getAttribute('href')
      ?.split('?')[0] || '';

  const tweetIdFromUrl = tweetUrl.split('/status/')[1];
  const { data, isLoading, error } = useTweet(tweetIdFromUrl);

  if (error || (!isLoading && data && 'tombstone' in data)) {
    return (
      <div className="embed-inline-block items-center pr-10">
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2"
          title="View on X"
        >
          <TwitterXIcon className="h-5 w-5 text-gray-500" />
        </a>
        <div
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(embedHtml) }}
        />
      </div>
    );
  }

  return <Tweet id={tweetIdFromUrl} />;
}
