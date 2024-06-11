import { ChannelVolume, GroupVolume, ThreadVolume } from '../db';
import { VolumeMap, VolumeSettings, getLevelFromVolumeMap } from '../urbit';

export function extractClientVolumes(volume: VolumeSettings): {
  channelVolumes: ChannelVolume[];
  groupVolumes: GroupVolume[];
  threadVolumes: ThreadVolume[];
} {
  const channelVolumes: ChannelVolume[] = [];
  const groupVolumes: GroupVolume[] = [];
  const threadVolumes: ThreadVolume[] = [];

  Object.entries(volume).forEach(([sourceId, volumeMap]) => {
    if (!volumeMap) return;
    const [sourceType, ...rest] = sourceId.split('/');
    const entityId = rest.join('/');

    if (sourceType === 'group') {
      const clientVolume = getClientVolume(volumeMap);
      groupVolumes.push({ groupId: entityId, ...clientVolume });
    }

    if (sourceType === 'channel' || sourceType === 'dm') {
      const clientVolume = getClientVolume(volumeMap, sourceType === 'channel');
      channelVolumes.push({ channelId: entityId, ...clientVolume });
    }

    if (sourceType === 'thread' || sourceType === 'dm-thread') {
      const postId = rest[rest.length - 1];
      const clientVolume = getClientVolume(volumeMap);
      threadVolumes.push({ postId, ...clientVolume });
    }
  });

  return { channelVolumes, groupVolumes, threadVolumes };
}

export function extractClientVolume(
  volume: VolumeMap | null,
  isGroupChannel?: boolean
): {
  isMuted: boolean;
  isNoisy: boolean;
} {
  if (!volume) return { isMuted: false, isNoisy: false };

  const clientVolume = getClientVolume(volume, isGroupChannel);
  return clientVolume;
}

function getClientVolume(volumeMap: VolumeMap, isGroupChannel?: boolean) {
  const level = getLevelFromVolumeMap(volumeMap);
  return {
    // NOTE: channels are muted (in mobile app terms) by default — only mentions & replies. But we don't
    // want them to all show up as muted visually. Do we want a way to support "muting" a channel in the App
    // to hide it's count from the UI?
    isMuted: isGroupChannel
      ? level === 'hush'
      : level === 'soft' || level === 'hush',
    isNoisy: level === 'loud' || level === 'medium',
  };
}
