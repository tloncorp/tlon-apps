import DOMPurify from 'dompurify';

interface SoundcloudEmbedProps {
  iframe: string;
}

export default function SoundcloudEmbed({
  iframe: rawIframe,
}: SoundcloudEmbedProps) {
  const iframe = DOMPurify.sanitize(rawIframe, { ADD_TAGS: ['iframe'] });
  return <div dangerouslySetInnerHTML={{ __html: iframe }} />;
}
