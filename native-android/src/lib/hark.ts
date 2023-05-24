import type {
  Yarn,
  YarnContent,
  YarnContentEmphasis,
  YarnContentShip,
} from '../types/hark';

export const isYarnContentShip = (obj: YarnContent): obj is YarnContentShip =>
  typeof obj !== 'string' && 'ship' in obj;

export const isYarnContentEmphasis = (
  obj: YarnContent
): obj is YarnContentEmphasis => typeof obj !== 'string' && 'emph' in obj;

export const isYarnGroup = (yarn: Yarn) => !!yarn.rope.group;

export const isYarnClub = (yarn: Yarn) => yarn.rope.thread.startsWith('/club');

export const isYarnValidNotification = (yarn: Yarn) =>
  (yarn.rope.desk === 'talk' || yarn.rope.desk === 'groups') &&
  !yarn.rope.thread.endsWith('/channel/edit') &&
  !yarn.rope.thread.endsWith('/channel/add') &&
  !yarn.rope.thread.endsWith('/channel/del') &&
  !yarn.rope.thread.endsWith('/joins') &&
  !yarn.rope.thread.endsWith('/leaves') &&
  (yarn.rope.channel !== null || !isYarnGroup(yarn));

export const parseYarnChannelId = (yarn: Yarn) => {
  if (isYarnGroup(yarn)) {
    return yarn.rope.channel;
  }

  if (isYarnClub(yarn)) {
    return yarn.rope.thread.replace('/club/', '');
  }

  return yarn.rope.thread.replace('/dm/', '');
};
