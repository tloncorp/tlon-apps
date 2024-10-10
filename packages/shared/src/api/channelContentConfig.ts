type PostContent = 'TODO: PostContent';

type RenderTarget = JSX.Element;

type DraftInputId = string;
type PostContentRendererId = Nominal<string, 'PostContentRendererId'>;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PostContentRendererId {
  export function create(id: string): PostContentRendererId {
    return id as PostContentRendererId;
  }
}

export enum CollectionRendererId {
  notebook = 'tlon.r0.notebook',
  chat = 'tlon.r0.chat',
  gallery = 'tlon.r0.gallery',
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

// -------- Helpers below here -------- //

type _NominalTag<Tag> = { __nominalTag: Tag };

type Nominal<BaseType, Tag> = BaseType & _NominalTag<Tag>;
