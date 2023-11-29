export const channelKey = (...parts: string[]) => ['channel', ...parts];
export const channelPinsKey = () => ['channels', 'pins'];

export const ChannnelKeys = {
  pins: channelPinsKey,
  channel: channelKey,
};

export default channelKey;
