type PostContent = 'TODO: PostContent';

type RenderTarget = JSX.Element;

export enum CollectionRendererId {
  notebook = 'tlon.r0.collection.notebook',
  chat = 'tlon.r0.collection.chat',
  gallery = 'tlon.r0.collection.gallery',
}

export enum DraftInputId {
  notebook = 'tlon.r0.input.notebook',
  chat = 'tlon.r0.input.chat',
  gallery = 'tlon.r0.input.gallery',
}

export enum PostContentRendererId {
  notebook = 'tlon.r0.input.notebook',
  chat = 'tlon.r0.input.chat',
  gallery = 'tlon.r0.input.gallery',
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
 * How does a given post content renderer render a post content?
 */
export interface PostContentRendererDescription {
  render: (props: { content: PostContent }) => RenderTarget;
}

/**
 * How does a given draft input render its controls?
 */
export interface DraftInputDescription<Payload> {
  render: (props: { ref: React.Ref<{ value: Payload }> }) => RenderTarget;
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
