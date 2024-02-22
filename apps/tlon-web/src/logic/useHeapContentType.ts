import {
  AUDIO_REGEX,
  IMAGE_REGEX,
  URL_REGEX,
  VIDEO_REGEX,
  isValidUrl,
} from '@/logic/utils';

export default function getHeapContentType(url: string) {
  const isImage = IMAGE_REGEX.test(url);
  const isUrl = URL_REGEX.test(url);
  const isVideo = VIDEO_REGEX.test(url);
  const isAudio = AUDIO_REGEX.test(url);
  const isText = !isValidUrl(url);

  const description = () => {
    switch (true) {
      case isImage:
        return 'Image';
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
    isAudio,
    isVideo,
    isUrl,
    isText,
    isImage,
    description,
  };
}
