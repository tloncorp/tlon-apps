import { useGang, useGroup, useGroupPreviewFromIndex } from '@/state/groups';
import { getPrivacyFromGroup, getPrivacyFromPreview } from './utils';

export default function useGroupPrivacy(flag: string) {
  const group = useGroup(flag);
  const gang = useGang(flag);
  const previewFromIndex = useGroupPreviewFromIndex(flag);

  const privacy = group
    ? getPrivacyFromGroup(group)
    : gang.preview
    ? getPrivacyFromPreview(gang.preview)
    : previewFromIndex
    ? getPrivacyFromPreview(previewFromIndex)
    : 'public';

  return {
    visible: ['public', 'private'].includes(privacy),
    privacy,
  };
}
