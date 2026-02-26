import { createDevLogger } from '../debug';
import { getCanonicalPostId } from './apiUtils';

const logger = createDevLogger('harkApi', true);

export const getPostInfoFromWer = (
  wer: string
): { id: string; authorId: string; isDm: boolean } | null => {
  try {
    const isDm = getIsDmFromWer(wer);
    const isChannelPost = getIsChannelPostFromWer(wer);
    const parts = wer.split('/');
    const isGroupChannelReply = parts.length > 10;

    if (parts.length < 2) {
      return null;
    }

    if (isDm && parts[5]) {
      return {
        id: getCanonicalPostId(parts[5]),
        authorId: parts[4],
        isDm,
      };
    }

    if (isChannelPost && isGroupChannelReply && parts[9]) {
      return {
        id: getCanonicalPostId(parts[9]),
        authorId: '',
        isDm,
      };
    }

    return null;
  } catch (e) {
    logger.error('getPostInfoFromWer failed', e, wer);
    return null;
  }
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
