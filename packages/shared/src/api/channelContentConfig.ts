export enum CollectionRendererId {
  notebook = 'tlon.r0.collection.notebook',
  chat = 'tlon.r0.collection.chat',
  gallery = 'tlon.r0.collection.gallery',
}

export enum DraftInputId {
  notebook = 'tlon.r0.input.notebook',
  chat = 'tlon.r0.input.chat',
  gallery = 'tlon.r0.input.gallery',
  picto = 'tlon.r0.input.picto',
  yo = 'tlon.r0.input.yo',
}

export enum PostContentRendererId {
  notebook = 'tlon.r0.content.notebook',
  chat = 'tlon.r0.content.chat',
  gallery = 'tlon.r0.content.gallery',
  picto = 'tlon.r0.content.picto',
}

/**
 * Configures the custom components used to create content in a channel.
 */
export interface ChannelContentConfiguration {
  /**
   * Which controls are available when composing a new post?
   */
  draftInput: DraftInputId;

  /**
   * How should we render a given post content type?
   *
   * This spec takes precedence over the client's default renderer mapping, but
   * does not take precedence over any mapping specified in a post's metadata.
   */
  defaultPostContentRenderer: PostContentRendererId;

  /**
   * How should we render the entire collection of posts? (list, grid, etc)
   */
  defaultPostCollectionRenderer: CollectionRendererId;
}

/**
 * We use a channel's `description` field to store structured data. This
 * module provides helpers for managing that data.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace StructuredChannelDescriptionPayload {
  type Encoded = string;
  interface Decoded {
    channelContentConfiguration: ChannelContentConfiguration;
    description?: string;
  }

  export function encode(payload: Decoded): Encoded {
    return JSON.stringify(payload);
  }
  export function decodeOrNull(encoded: Encoded): Decoded | null {
    // TODO: This should be validated - we'll be deserializing untrusted data
    try {
      return JSON.parse(encoded);
    } catch (_err) {
      return null;
    }
  }
}
