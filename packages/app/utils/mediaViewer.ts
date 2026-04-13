export function getPostImageViewerId(postId: string, imageUri?: string) {
  if (!imageUri) {
    return undefined;
  }

  return `post-image:${postId}:${encodeURIComponent(imageUri)}`;
}

export function getVideoViewerId(videoUri?: string, posterUri?: string) {
  if (!videoUri || !posterUri) {
    return undefined;
  }

  return `video:${encodeURIComponent(videoUri)}:${encodeURIComponent(posterUri)}`;
}
