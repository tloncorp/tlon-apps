import {
  AUDIO_REGEX,
  IMAGE_REGEX,
  URL_REGEX,
  isValidUrl,
  validOembedCheck,
  VIDEO_REGEX,
} from '@/logic/utils';
import { useEmbed } from '@/logic/embed';

export default function useHeapContentType(url: string) {
  const isImage = IMAGE_REGEX.test(url);
  const isUrl = URL_REGEX.test(url);
  const isVideo = VIDEO_REGEX.test(url);
  const isAudio = AUDIO_REGEX.test(url);
  const isText = !isValidUrl(url);
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

  return {
    isOembed,
    oembed,
    isAudio,
    isVideo,
    isUrl,
    isText,
    isImage,
    description,
  };
}
