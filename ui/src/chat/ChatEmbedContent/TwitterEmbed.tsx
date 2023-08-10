import { Tweet } from 'react-tweet';

interface TwitterEmbedProps {
  embedHtml: string;
}

export default function TwitterEmbed({ embedHtml }: TwitterEmbedProps) {
  const element = document.createElement('html');
  element.innerHTML = embedHtml;
  const tweetUrl =
    Array.from(element.querySelectorAll('a'))
      .filter(
        (a) =>
          a.href.includes('https://twitter.com') &&
          !a.href.includes('pic.twitter.com') &&
          a.href.includes('/status/') &&
          a.href.includes('ref_src=twsrc%5Etfw')
      )[0]
      .getAttribute('href') || '';
  const tweetIdFromUrl = tweetUrl.split('/status/')[1].split('?')[0];

  return <Tweet id={tweetIdFromUrl} />;
}
