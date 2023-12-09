import TwitterIcon from '@/components/icons/TwitterIcon';
import { Tweet, useTweet } from 'react-tweet';
import DOMPurify from 'dompurify';

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
  const { data, isLoading } = useTweet(tweetIdFromUrl);

  if (!isLoading && data && 'tombstone' in data) {
    return (
      <div className="embed-inline-block items-center">
        <TwitterIcon className="h-8 w-8" />
        <h1>Tweet not found</h1>
        <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
          {tweetUrl}
        </a>
      </div>
    );
  }

  return <Tweet id={tweetIdFromUrl} />;
}
