import { VideoPreviewData, VideoPreviewSource } from './videoPreviewTypes';

const POSTER_CAPTURE_TIME_SECONDS = 0.1;
const SEEK_TIMEOUT_MS = 1000;
const MEDIA_EVENT_TIMEOUT_MS = 1500;

export async function getVideoPreviewData(
  source: VideoPreviewSource
): Promise<VideoPreviewData> {
  const { sourceUri, shouldRevokeSourceUri } = await getLoadableSource(source);
  const video = document.createElement('video');

  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    const didLoadMetadata = await loadMetadata(video, sourceUri);
    if (!didLoadMetadata) {
      return {};
    }

    const width = video.videoWidth || undefined;
    const height = video.videoHeight || undefined;
    const duration = Number.isFinite(video.duration) ? video.duration : undefined;
    const posterUri = await capturePosterUri(video, width, height, duration);

    return {
      width,
      height,
      duration,
      posterUri,
    };
  } finally {
    video.src = '';
    if (shouldRevokeSourceUri) {
      URL.revokeObjectURL(sourceUri);
    }
  }
}

function loadMetadata(video: HTMLVideoElement, uri: string): Promise<boolean> {
  const didLoadMetadata = waitForVideoEvent(video, 'loadedmetadata');
  video.src = uri;
  return didLoadMetadata;
}

async function capturePosterUri(
  video: HTMLVideoElement,
  width: number | undefined,
  height: number | undefined,
  duration: number | undefined
): Promise<string | undefined> {
  if (!width || !height) {
    return undefined;
  }

  const captureTime =
    duration && duration > 0
      ? Math.min(POSTER_CAPTURE_TIME_SECONDS, Math.max(duration - 0.01, 0))
      : 0;

  if (captureTime > 0) {
    const didSeek = await seekTo(video, captureTime);
    if (!didSeek) {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        const didLoadFrame = await waitForFrame(video);
        if (!didLoadFrame) {
          return undefined;
        }
      }
    }
  } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    const didLoadFrame = await waitForFrame(video);
    if (!didLoadFrame) {
      return undefined;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }

  try {
    context.drawImage(video, 0, 0, width, height);
  } catch {
    return undefined;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.75);
  });
  if (!blob) {
    return undefined;
  }
  return URL.createObjectURL(blob);
}

function waitForFrame(video: HTMLVideoElement): Promise<boolean> {
  return waitForVideoEvent(video, 'loadeddata');
}

function seekTo(video: HTMLVideoElement, time: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, SEEK_TIMEOUT_MS);
    const onSeeked = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = time;
    } catch {
      cleanup();
      resolve(false);
    }
  });
}

async function getLoadableSource(source: VideoPreviewSource): Promise<{
  sourceUri: string;
  shouldRevokeSourceUri: boolean;
}> {
  if ('file' in source) {
    return {
      sourceUri: URL.createObjectURL(source.file),
      shouldRevokeSourceUri: true,
    };
  }

  if (!source.uri.trim().toLowerCase().startsWith('data:')) {
    return {
      sourceUri: source.uri,
      shouldRevokeSourceUri: false,
    };
  }

  const response = await fetch(source.uri);
  const blob = await response.blob();
  return {
    sourceUri: URL.createObjectURL(blob),
    shouldRevokeSourceUri: true,
  };
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'loadeddata',
  timeoutMs: number = MEDIA_EVENT_TIMEOUT_MS
): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const onEvent = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener('error', onError);
    };

    video.addEventListener(eventName, onEvent);
    video.addEventListener('error', onError);
  });
}
