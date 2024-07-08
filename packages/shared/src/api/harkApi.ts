import { getCanonicalPostId } from './apiUtils';

export const getPostIdFromWer = (wer: string): string | null => {
  const isDm = getIsDmFromWer(wer);
  const isChannelPost = getIsChannelPostFromWer(wer);
  const parts = wer.split('/');
  const isGroupChannelReply = parts.length > 10;

  if (parts.length < 2) {
    return null;
  }

  if (isDm && parts[3]) {
    return getCanonicalPostId(parts[3]);
  }

  if (isChannelPost && isGroupChannelReply && parts[9]) {
    return getCanonicalPostId(parts[9]);
  }

  return null;
};

export const getIsDmFromWer = (wer: string): boolean => {
  const parts = wer.split('/');
  if (parts.length < 2) {
    return false;
  }
  const type = parts[1];
  return type === 'dm';
};

export const getIsChannelPostFromWer = (wer: string): boolean => {
  const parts = wer.split('/');
  if (parts.length < 2) {
    return false;
  }
  const type = parts[1];
  return type === 'groups';
};
