import * as db from '@tloncorp/shared/db';

export function getGroupHost(groupId: string) {
  return groupId.split('/')[0];
}

export function getPrivacyLabel(privacy?: db.Group['privacy'] | null) {
  return privacy ? privacy.charAt(0).toUpperCase() + privacy.slice(1) : '';
}
