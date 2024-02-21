import { useGang, useGroup } from '@/state/groups';

import { getPrivacyFromGroup, getPrivacyFromPreview } from './utils';

export default function useGroupPrivacy(flag: string) {
  const group = useGroup(flag);
  const gang = useGang(flag);

  const privacy = group
    ? getPrivacyFromGroup(group)
    : gang.preview
      ? getPrivacyFromPreview(gang.preview)
      : 'public';

  return {
    visible: ['public', 'private'].includes(privacy),
    privacy,
    isFetched: !!group || !!gang.preview,
  };
}
