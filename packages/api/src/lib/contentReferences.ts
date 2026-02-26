import { render } from '@urbit/aura';

import type { ContentReference } from '../types/references';
import * as ub from '../urbit';

function formatUd(ud: string) {
  return render('ud', BigInt(ud));
}

export function toContentReference(cite: ub.Cite): ContentReference | null {
  if ('chan' in cite) {
    const channelId = cite.chan.nest;
    const messageIdRegex = /\/([0-9\.]+(?=[$\/]?))/g;
    const [postId, replyId] = Array.from(
      cite.chan.where.matchAll(messageIdRegex)
    ).map((m) => {
      return m[1].replace(/\./g, '');
    });
    if (!postId) {
      console.error('found invalid ref', cite);
      return null;
    }
    return {
      type: 'reference',
      referenceType: 'channel',
      channelId,
      postId: formatUd(postId),
      replyId: replyId ? formatUd(replyId) : undefined,
    };
  } else if ('group' in cite) {
    return { type: 'reference', referenceType: 'group', groupId: cite.group };
  } else if ('desk' in cite) {
    const parts = cite.desk.flag.split('/');
    const userId = parts[0];
    const appId = parts[1];
    if (!userId || !appId) {
      console.error('found invalid ref', cite);
      return null;
    }
    return { type: 'reference', referenceType: 'app', userId, appId };
  }
  return null;
}

export function contentReferenceToCite(reference: ContentReference): ub.Cite {
  if (reference.referenceType === 'channel') {
    return {
      chan: {
        nest: reference.channelId,
        where: `/msg/${reference.postId}${
          reference.replyId ? '/' + reference.replyId : ''
        }`,
      },
    };
  } else if (reference.referenceType === 'group') {
    return {
      group: reference.groupId,
    };
  } else if (reference.referenceType === 'app') {
    return {
      desk: {
        flag: `${reference.userId}/${reference.appId}`,
        where: '',
      },
    };
  }
  throw new Error('invalid reference');
}
