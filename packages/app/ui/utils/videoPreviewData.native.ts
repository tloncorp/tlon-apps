import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';

import { VideoPreviewData, VideoPreviewSource } from './videoPreviewTypes';

export async function getVideoPreviewData(
  source: VideoPreviewSource
): Promise<VideoPreviewData> {
  if (!('uri' in source)) {
    return {};
  }

  const player = createVideoPlayer(source.uri);

  try {
    const [thumbnail] = await player.generateThumbnailsAsync(0);
    const imageRef = await ImageManipulator.manipulate(thumbnail).renderAsync();
    const saved = await imageRef.saveAsync({
      compress: 0.75,
      format: SaveFormat.JPEG,
    });

    return {
      width: thumbnail.width || saved.width,
      height: thumbnail.height || saved.height,
      duration: Number.isFinite(player.duration) ? player.duration : undefined,
      posterUri: saved.uri,
    };
  } catch {
    return {};
  } finally {
    player.release();
  }
}
