import { ContentReference } from '../api';
import { citeToPath } from '../urbit';
import { getBranchLinkMeta, isLureMeta } from './branch';

export async function getReferenceFromDeeplink(
  url: string,
  branchKey: string
): Promise<{ reference: ContentReference; path: string } | null> {
  const linkMeta = await getBranchLinkMeta(url, branchKey);

  if (linkMeta && typeof linkMeta === 'object') {
    if (isLureMeta(linkMeta) && linkMeta.invitedGroupId) {
      return {
        reference: {
          type: 'reference',
          referenceType: 'group',
          groupId: linkMeta.invitedGroupId,
        },
        path: citeToPath({ group: linkMeta.invitedGroupId }),
      };
    }
  }

  return null;
}
