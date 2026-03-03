import { VideoPreviewData, VideoPreviewSource } from './videoPreviewTypes';

const POSTER_CAPTURE_TIME_SECONDS = 0.1;
const SEEK_TIMEOUT_MS = 1000;

export async function getVideoPreviewData(
  source: VideoPreviewSource
): Promise<VideoPreviewData> {
  const sourceUri =
    'uri' in source ? source.uri : URL.createObjectURL(source.file);
  const shouldRevokeSourceUri = 'file' in source;
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
  return new Promise((resolve) => {
    const onLoadedMetadata = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    video.src = uri;
  });
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
      return undefined;
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
  return new Promise((resolve) => {
    const onLoadedData = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('error', onError);
  });
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
