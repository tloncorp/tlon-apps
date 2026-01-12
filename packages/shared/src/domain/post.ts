import type { ChannelType } from '../db/schema';
import type { PostMetadata } from '../db/types';
import { Block, Inline, Story } from '../urbit';
import { Attachment, SerializedAttachment } from './attachment';

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

/**
 * Serializable version of PostDataDraft for database persistence.
 * Used to store drafts alongside failed posts for retry logic.
 */
interface _SerializablePostDataDraftBase {
  channelId: string;
  content: (Inline | Block)[];
  attachments: SerializedAttachment[];
  channelType: ChannelType;
  title?: string;
  image?: string;
}

export interface SerializablePostDataDraftParent
  extends _SerializablePostDataDraftBase {
  isEdit?: false;
}

export interface SerializablePostDataDraftEdit
  extends _SerializablePostDataDraftBase {
  isEdit: true;
  editTargetPostId: string;
}

export type SerializablePostDataDraft =
  | SerializablePostDataDraftParent
  | SerializablePostDataDraftEdit;

export namespace PostDataDraft {
  /**
   * Serialize a PostDataDraft for database persistence.
   * Converts attachments to a serializable form.
   */
  export function serialize(draft: PostDataDraft): SerializablePostDataDraft {
    const serializedAttachments = SerializedAttachment.fromAttachments(
      draft.attachments
    );

    if (draft.isEdit) {
      return {
        channelId: draft.channelId,
        content: draft.content,
        attachments: serializedAttachments,
        channelType: draft.channelType,
        title: draft.title,
        image: draft.image,
        isEdit: true,
        editTargetPostId: draft.editTargetPostId,
      };
    } else {
      return {
        channelId: draft.channelId,
        content: draft.content,
        attachments: serializedAttachments,
        channelType: draft.channelType,
        title: draft.title,
        image: draft.image,
      };
    }
  }

  /**
   * Deserialize a SerializablePostDataDraft back to a PostDataDraft.
   * Note: File attachments will have localFile as string URIs, not File objects.
   */
  export function deserialize(
    serialized: SerializablePostDataDraft
  ): PostDataDraft {
    const attachments = serialized.attachments.map(
      SerializedAttachment.toAttachment
    );

    if (serialized.isEdit) {
      return {
        channelId: serialized.channelId,
        content: serialized.content,
        attachments,
        channelType: serialized.channelType,
        title: serialized.title,
        image: serialized.image,
        isEdit: true,
        editTargetPostId: serialized.editTargetPostId,
      };
    } else {
      return {
        channelId: serialized.channelId,
        content: serialized.content,
        attachments,
        channelType: serialized.channelType,
        title: serialized.title,
        image: serialized.image,
      };
    }
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

    if (draft.isEdit) {
      return { ...draft, attachments: resetAttachments };
    } else {
      return { ...draft, attachments: resetAttachments };
    }
  }
}
