import { useMemo } from 'react';

import * as db from '../db';
import * as kv from '../db/keyValue';
import { JSONContent } from '../urbit';

type GalleryDraftType = 'caption' | 'text';
interface PostDraftCallbacks {
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent | null>;
  storeDraft: (
    draft: JSONContent,
    draftType?: GalleryDraftType
  ) => Promise<void>;
  clearDraft: (draftType?: GalleryDraftType | undefined) => Promise<void>;
}

export function usePostDraftCallbacks(opts: {
  draftKey: string;
}): PostDraftCallbacks;
export function usePostDraftCallbacks(
  opts: null | {
    draftKey: string;
  }
): PostDraftCallbacks | null;
export function usePostDraftCallbacks(
  opts: null | {
    draftKey: string;
  }
): PostDraftCallbacks | null {
  const draftKey = opts?.draftKey;
  return useMemo(() => {
    if (draftKey == null) {
      return null;
    }
    return {
      getDraft: async (draftType?: GalleryDraftType) => {
        try {
          return await kv
            .postDraft({ key: draftKey, type: draftType })
            .getValue();
        } catch (e) {
          return null;
        }
      },
      storeDraft: async (draft: JSONContent, draftType?: GalleryDraftType) => {
        try {
          await kv
            .postDraft({ key: draftKey, type: draftType })
            .setValue(draft);
        } catch (e) {
          return;
        }
      },
      clearDraft: async (draftType?: GalleryDraftType) => {
        try {
          await kv.postDraft({ key: draftKey, type: draftType }).resetValue();
        } catch (e) {
          return;
        }
      },
    };
  }, [draftKey]);
}

export const draftKeyFor = {
  channel: (opts: { channelId: db.Channel['id'] }) => opts.channelId,
  thread: (opts: { parentPostId: db.Post['id'] }) => opts.parentPostId,
};
