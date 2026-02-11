import type { ChannelType, PostMetadata } from '@tloncorp/shared/db/types';
import { Block, Inline, Story } from '../urbit';
import { Attachment } from './attachment';

interface _PostDataDraftBase {
  channelId: string;
  content: (Inline | Block)[];
  attachments: Attachment[];
  channelType: ChannelType;
  title?: string;
  image?: string;
  replyToPostId: string | null;
}
/** Draft for an original, non-edit post */
export interface PostDataDraftPost extends _PostDataDraftBase {
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
export type PostDataDraft = PostDataDraftPost | PostDataDraftEdit;

interface _PostDataFinalizedBase {
  channelId: string;
  content: Story;
  blob?: string;
  metadata?: PostMetadata;
  replyToPostId: string | null;
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
   * Type guard to validate that an unknown value is a valid PostDataDraft.
   * Used when deserializing drafts from the database.
   */
  export function isValid(value: unknown): value is PostDataDraft {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    const hasRequiredFields =
      typeof obj.channelId === 'string' &&
      Array.isArray(obj.content) &&
      Array.isArray(obj.attachments) &&
      typeof obj.channelType === 'string';

    if (!hasRequiredFields) {
      return false;
    }

    // Validate replyToPostId is string or null
    if (obj.replyToPostId !== null && typeof obj.replyToPostId !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Revoke any blob URLs created during serialization.
   * Call this when the draft is no longer needed (e.g., after successful send).
   */
  export function revokeBlobUrls(draft: PostDataDraft): void {
    for (const att of draft.attachments) {
      if (att.type === 'file' && typeof att.localFile === 'string') {
        // Only revoke blob: URLs, not file:// or other URLs
        if (att.localFile.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(att.localFile);
          } catch {
            // Ignore errors - URL may have already been revoked
          }
        }
      }
    }
  }
}
