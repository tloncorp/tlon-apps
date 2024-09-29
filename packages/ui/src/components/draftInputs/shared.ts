import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { Dispatch, SetStateAction } from 'react';

export interface DraftInputContext {
  channel: db.Channel;
  clearDraft: () => void;
  editPost: (post: db.Post, content: Story) => Promise<void>;
  editingPost?: db.Post;
  getDraft: () => Promise<JSONContent>;
  group: db.Group | null;
  onSent?: () => void;
  send: (
    content: Story,
    channelId: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  setEditingPost?: (update: db.Post | undefined) => void;
  setShouldBlur: Dispatch<SetStateAction<boolean>>;
  shouldBlur: boolean;
  storeDraft: (content: JSONContent) => void;
}
