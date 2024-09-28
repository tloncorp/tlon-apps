type PostContent = 'TODO: PostContent';

type RenderTarget = JSX.Element;

type DraftInputId = Nominal<string, 'DraftInputId'>;
type PostContentType = Nominal<string, 'PostContentType'>;
type PostContentRendererId = Nominal<string, 'PostContentRendererId'>;

export enum CollectionRendererId {
  listBottomToTop = 'tlon.r0.list-bottom-to-top',
  listTopToBottom = 'tlon.r0.list-top-to-bottom',
  grid = 'tlon.r0.grid',
}

/**
 * Configures the custom components used to create content in a channel.
 */
export interface ChannelContentConfiguration {
  /**
   * Which controls are available when composing a new post?
   */
  draftInputs: DraftInputId[];

  /**
   * How should we render a given post content type?
   *
   * This spec takes precedence over the client's default renderer mapping, but
   * does not take precedence over any mapping specified in a post's metadata.
   */
  defaultPostContentRenderers: Array<{
    /**
     * A post's content type is checked against this field - if it matches,
     * we'll use the renderer specified here.
     */
    match: PostContentType;

    renderer: PostContentRendererId;
  }>;

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
 * Singleton registries of all available tagged components.
 *
 * If a channel or post specifies a draft input ID or post content
 * renderer ID that is not registered here, this client does not support it.
 */
export const kits = {
  postContentRenderers: {} as {
    [id in PostContentRendererId]: PostContentRendererDescription;
  },

  draftInputs: {} as {
    [id in DraftInputId]: DraftInputDescription<unknown>;
  },

  draftInputIds: {
    chat: 'tlon.r0.chat-input' as DraftInputId,
  },
};

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
