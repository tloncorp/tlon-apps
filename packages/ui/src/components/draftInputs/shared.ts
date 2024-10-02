import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { Dispatch, SetStateAction } from 'react';

export interface DraftInputHandle {
  /**
   * @deprecated
   * We are using this to implement a weird navigation pattern where we present
   * draft input in a modal-like presentation, and reuse the container screen's
   * header back button to dismiss the "modal".
   * This requires the containing screen to command the draft input to exit its "big input".
   * We should move to implement the nav bar in the draft inputs themselves.
   */
  exitFullscreen: () => void;
}

/**
 * Shared API for all draft inputs.
 */
export interface DraftInputContext {
  channel: db.Channel;
  clearDraft: () => void;
  draftInputRef?: React.Ref<DraftInputHandle>;
  editPost: (post: db.Post, content: Story) => Promise<void>;
  editingPost?: db.Post;
  getDraft: () => Promise<JSONContent>;
  group: db.Group | null;

  /**
   * Called when the draft input takes over the entire screen.
   * (This is useful because `fullscreen` presentation currently reuses the
   * same container as the channel contents - so when we enter
   * `fullscreen`, the <Channel> needs to hide its contents to make way for
   * the input.)
   */
  onPresentationModeChange?: (
    presentationMode: 'inline' | 'fullscreen'
  ) => void;
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
