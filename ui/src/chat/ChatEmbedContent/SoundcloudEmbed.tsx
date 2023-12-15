import DOMPurify from 'dompurify';

interface SoundcloudEmbedProps {
  iframe: string;
}

export default function SoundcloudEmbed({
  iframe: rawIframe,
}: SoundcloudEmbedProps) {
  const element = document.createElement('html');
  element.innerHTML = DOMPurify.sanitize(rawIframe, {
    ALLOWED_TAGS: ['iframe'],
  });
  const soundcloudApiUrl =
    Array.from(element.querySelectorAll('iframe'))
      .filter((iframe) =>
        iframe.src.startsWith('https://w.soundcloud.com/player/')
      )[0]
      .getAttribute('src') || '';

  return (
    <iframe
      width="300"
      height="200"
      scrolling="no"
      frameBorder="no"
      src={soundcloudApiUrl}
    />
  );
}
