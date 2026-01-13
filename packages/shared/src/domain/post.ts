import type { ChannelType } from '../db/schema';
import type { PostMetadata } from '../db/types';
import { Block, Inline, Story } from '../urbit';
import { Attachment } from './attachment';

interface _PostDataDraftBase {
  channelId: string;
  content: (Inline | Block)[];
  attachments: Attachment[];
  channelType: ChannelType;
  title?: string;
  image?: string;
}
export interface PostDataDraftParent extends _PostDataDraftBase {
  isEdit?: false;
}
export interface PostDataDraftEdit extends _PostDataDraftBase {
  isEdit: true;
  editTargetPostId: string;
}

/**
 * A static, frozen version of a post draft that can be used to create a post.
 * In other words, this has everything you need to initiate sending a post.
 * Attachments need to be finalized before sending.
 */
export type PostDataDraft = PostDataDraftParent | PostDataDraftEdit;

interface _PostDataFinalizedBase {
  channelId: string;
  content: Story;
  blob?: string;
  metadata?: PostMetadata;
}

/**
 * Finalized "normal" post (i.e. not an edit).
 */
export interface PostDataFinalizedParent extends _PostDataFinalizedBase {
  isEdit?: false;
}

export interface PostDataFinalizedEdit extends _PostDataFinalizedBase {
  isEdit: true;
  editTargetPostId: string;
}

/**
 * A post that's ready to head down to the network.
 * Nothing left to do but send it.
 */
export type PostDataFinalized = PostDataFinalizedParent | PostDataFinalizedEdit;

export namespace PostDataDraft {
  /**
   * Make a PostDataDraft safe for JSON serialization.
   * Converts web File objects in attachments to blob URLs.
   */
  export function serialize(draft: PostDataDraft): PostDataDraft {
    return {
      ...draft,
      attachments: draft.attachments.map(Attachment.makeSerializable),
    };
  }

  /**
   * Reset upload states on all attachments to allow re-uploading.
   * Used when retrying a failed post.
   */
  export function resetUploadStates(draft: PostDataDraft): PostDataDraft {
    const resetAttachments = draft.attachments.map((att) => {
      if (att.type === 'image' || att.type === 'file') {
        // Remove uploadState to allow fresh upload
        const { uploadState, ...rest } = att as {
          uploadState?: unknown;
        } & Omit<typeof att, 'uploadState'>;
        return rest as Attachment;
      }
      return att;
    });

    return { ...draft, attachments: resetAttachments };
  }
}
