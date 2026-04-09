import { JSONContent } from '@tloncorp/api/urbit';
import { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useContext,
} from 'react';

export type GalleryDraftType = 'caption' | 'link' | 'text';

export type GalleryRoute =
  | 'gallery'
  | 'add-post'
  | 'add-attachment'
  | 'link'
  | 'review-attachment'
  | 'text';

export interface DraftInputHandle {
  /**
   * Perform anything necessary to put the user in a drafting state for this
   * input - open a model editor, focus text box, open image picker, etc.
   */
  startDraft?: (mode?: 'text' | 'link') => void;

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
  clearDraft: (draftType?: GalleryDraftType) => Promise<void>;
  configuration?: Record<string, JSONValue>;
  draftInputRef?: React.Ref<DraftInputHandle>;
  editingPost?: db.Post;
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent | null>;
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
  sendPostFromDraft: (draft: domain.PostDataDraft) => Promise<void>;
  setEditingPost?: (update: db.Post | undefined) => void;
  setShouldBlur: Dispatch<SetStateAction<boolean>>;
  shouldBlur: boolean;
  storeDraft: (
    content: JSONContent,
    draftType?: GalleryDraftType
  ) => Promise<void>;
  replyToPost?: { id: string };
}

const context = createContext<DraftInputContext | null>(null);
export function useDraftInputContext() {
  return useContext(context);
}
export function DraftInputContextProvider({
  children,
  value,
}: PropsWithChildren<{ value: DraftInputContext }>) {
  return <context.Provider value={value}>{children}</context.Provider>;
}
