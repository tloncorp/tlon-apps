import { createDevLogger } from '@tloncorp/shared/dist';
import { manipulateAsync } from 'expo-image-manipulator';
import { Image } from 'react-native';

const logger = createDevLogger('image utils', true);

export function imageSize(url: string): Promise<[number, number]> {
  return new Promise((resolve, reject) =>
    Image.getSize(
      url,
      (width, height) => resolve([width, height]),
      (error) => {
        logger.log('failed to get image size', { error });
        reject(error);
      }
    )
  );
}

export async function resizeImage(url: string) {
  const size = await imageSize(url);

  logger.log('image size', size);

  if (!size) {
    return url;
  }

  const [width, height] = size;

  if (width > 1200 || height > 1200) {
    logger.log('resizing image', { width, height });
    const manipulated = await manipulateAsync(url, [
      { resize: { width: 1200, height: 1200 } },
    ]);

    logger.log('manipulated', manipulated);

    return manipulated.uri;
  }

  return url;
}
