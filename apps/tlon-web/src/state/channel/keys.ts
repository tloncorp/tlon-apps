import { nestToFlag } from '@/logic/utils';

export const channelKey = (...parts: string[]) => ['channels', ...parts];

export const infinitePostsKey = (nest: string) => {
  const [han, flag] = nestToFlag(nest);
  return [han, 'posts', flag, 'infinite'];
};

export const postKey = (nest: string, id: string) => {
  const [han, flag] = nestToFlag(nest);
  return [han, 'posts', flag, id];
};

export const ChannnelKeys = {
  channel: channelKey,
  infinitePostsKey,
  postKey,
};

export default ChannnelKeys;
