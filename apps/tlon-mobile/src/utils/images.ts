import { createDevLogger } from '@tloncorp/shared/dist';
import { Image } from 'react-native';

const logger = createDevLogger('image utils', true);

export async function imageSize(url: string) {
  const size = await Image.getSize(
    url,
    (width, height) => [width, height],
    (error) => {
      logger.log('failed to get image size', { error });
      return undefined;
    }
  );

  return size;
}
