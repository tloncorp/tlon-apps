import React from 'react';
import { useEmbed } from '@/logic/embed';
import {
  AUDIO_REGEX,
  IMAGE_REGEX,
  URL_REGEX,
  validOembedCheck,
  VIDEO_REGEX,
} from '@/logic/utils';

interface HeapDetailHeaderDescriptionProps {
  url: string;
}

export default function HeapDetailHeaderDescription({
  url,
}: HeapDetailHeaderDescriptionProps) {
  const isImage = IMAGE_REGEX.test(url);
  const isUrl = URL_REGEX.test(url);
  const isVideo = VIDEO_REGEX.test(url);
  const isAudio = AUDIO_REGEX.test(url);
  const oembed = useEmbed(url);
  const isOembed = validOembedCheck(oembed, url);

  const description = () => {
    switch (true) {
      case isImage:
        return 'Image';
      case isOembed:
        return oembed.read().provider_name;
      case isVideo:
        return 'Video';
      case isAudio:
        return 'Audio';
      case isUrl:
        return 'URL';
      default:
        return 'Text';
    }
  };

  return (
    <div className="text-md font-semibold text-gray-600">{description()}</div>
  );
}
