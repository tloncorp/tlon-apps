import { createDevLogger } from '@tloncorp/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { EventSubscription } from 'expo-modules-core';
import { createVideoPlayer } from 'expo-video';

import { VideoPreviewData, VideoPreviewSource } from './videoPreviewTypes';

const logger = createDevLogger('videoPreviewData.native', false);
const THUMBNAIL_CANDIDATE_TIMES_SECONDS = [0, 0.1, 0.5, 1];
const THUMBNAIL_RETRY_DELAY_MS = 150;
const PLAYER_READY_TIMEOUT_MS = 1500;
const POSTER_MAX_DIMENSION_PX = 960;

export async function getVideoPreviewData(
  source: VideoPreviewSource
): Promise<VideoPreviewData> {
  if (!('uri' in source)) {
    return {};
  }

  const player = createVideoPlayer(source.uri);

  try {
    const thumbnail = await generateThumbnail(player);
    const duration = Number.isFinite(player.duration)
      ? player.duration
      : undefined;

    if (!thumbnail) {
      return {
        duration,
      };
    }

    const manipulator = ImageManipulator.manipulate(thumbnail);
    const { width: thumbWidth = 0, height: thumbHeight = 0 } = thumbnail;
    const maxDimension = Math.max(thumbWidth, thumbHeight);
    if (maxDimension > POSTER_MAX_DIMENSION_PX) {
      if (thumbWidth >= thumbHeight) {
        manipulator.resize({ width: POSTER_MAX_DIMENSION_PX });
      } else {
        manipulator.resize({ height: POSTER_MAX_DIMENSION_PX });
      }
    }
    const imageRef = await manipulator.renderAsync();
    const saved = await imageRef.saveAsync({
      compress: 0.75,
      format: SaveFormat.WEBP,
    });

    return {
      width: thumbnail.width || saved.width,
      height: thumbnail.height || saved.height,
      duration,
      posterUri: saved.uri,
    };
  } catch (error) {
    logger.trackError('failed to generate native video preview data', {
      uri: source.uri,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  } finally {
    player.release();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function generateThumbnail(player: ReturnType<typeof createVideoPlayer>) {
  const ready = await waitForReady(player, PLAYER_READY_TIMEOUT_MS);
  if (!ready) {
    return null;
  }

  const firstAttempt = await tryGenerateThumbnail(player);
  if (firstAttempt) {
    return firstAttempt;
  }

  // One fallback attempt for freshly captured videos that are briefly unavailable.
  await delay(THUMBNAIL_RETRY_DELAY_MS);
  return tryGenerateThumbnail(player);
}

async function tryGenerateThumbnail(
  player: ReturnType<typeof createVideoPlayer>
) {
  try {
    const [thumbnail] = await player.generateThumbnailsAsync(
      THUMBNAIL_CANDIDATE_TIMES_SECONDS
    );
    return thumbnail ?? null;
  } catch {
    return null;
  }
}

async function waitForReady(
  player: ReturnType<typeof createVideoPlayer>,
  timeoutMs: number
): Promise<boolean> {
  if (player.status === 'readyToPlay') {
    return true;
  }
  if (player.status === 'error') {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let subscription: EventSubscription | null = null;

    const settle = (isReady: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      resolve(isReady);
    };

    const timeout = setTimeout(() => {
      settle(false);
    }, timeoutMs);

    subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        settle(true);
      } else if (status === 'error') {
        settle(false);
      }
    });
  });
}
