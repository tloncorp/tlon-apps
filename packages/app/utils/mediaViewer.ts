export function getPostImageViewerId(postId: string, imageUri: string) {
  return `post-image:${postId}:${encodeURIComponent(imageUri)}`;
}

export function getVideoViewerId(videoUri: string, posterUri?: string) {
  if (!posterUri) {
    return undefined;
  }

  return `video:${encodeURIComponent(videoUri)}:${encodeURIComponent(posterUri)}`;
}
