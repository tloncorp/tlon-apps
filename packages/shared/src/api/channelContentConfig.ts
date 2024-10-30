import type { JSONValue } from '../types/JSONValue';
import { ValuesOf } from '../utils';

interface ParameterSpec {
  displayName: string;
  type: 'boolean' | 'string';
}

export interface ComponentSpec<
  EnumTag extends string = string,
  Parameters extends { [key: string]: ParameterSpec } = Record<
    string,
    ParameterSpec
  >,
> {
  displayName: string;
  enumTag: EnumTag;
  parametersSchema: Parameters;
}

export const allCollectionRenderers = {
  'tlon.r0.collection.chat': {
    displayName: 'Chat',
    enumTag: 'chat',
    parametersSchema: {},
  },
  'tlon.r0.collection.gallery': {
    displayName: 'Gallery',
    enumTag: 'gallery',
    parametersSchema: {},
  },
  'tlon.r0.collection.notebook': {
    displayName: 'Notebook',
    enumTag: 'notebook',
    parametersSchema: {},
  },
  'tlon.r0.collection.cards': {
    displayName: 'Cards',
    enumTag: 'cards',
    parametersSchema: {},
  },
  'tlon.r0.collection.sign': {
    displayName: 'Sign',
    enumTag: 'sign',
    parametersSchema: {},
  },
  'tlon.r0.collection.boardroom': {
    displayName: 'Boardroom',
    enumTag: 'boardroom',
    parametersSchema: {},
  },
  'tlon.r0.collection.strobe': {
    displayName: 'Strobe',
    enumTag: 'strobe',
    parametersSchema: {},
  },
} as const satisfies Record<string, ComponentSpec>;

export const allDraftInputs = {
  'tlon.r0.input.chat': {
    displayName: 'Chat',
    enumTag: 'chat',
    parametersSchema: {},
  },
  'tlon.r0.input.gallery': {
    displayName: 'Gallery',
    enumTag: 'gallery',
    parametersSchema: {},
  },
  'tlon.r0.input.notebook': {
    displayName: 'Notebook',
    enumTag: 'notebook',
    parametersSchema: {},
  },
  'tlon.r0.input.yo': {
    displayName: 'Yo',
    enumTag: 'yo',
    parametersSchema: {},
  },
  'tlon.r0.input.mic': {
    displayName: 'Mic',
    enumTag: 'mic',
    parametersSchema: {},
  },
  'tlon.r0.input.picto': {
    displayName: 'Picto',
    enumTag: 'picto',
    parametersSchema: {},
  },
  'tlon.r0.input.color': {
    displayName: 'Color',
    enumTag: 'color',
    parametersSchema: {},
  },
} as const satisfies Record<
  string,
  ComponentSpec<string, Record<string, ParameterSpec>>
>;

export const allContentRenderers = {
  'tlon.r0.content.chat': {
    displayName: 'Chat',
    enumTag: 'chat',
    parametersSchema: {},
  },
  'tlon.r0.content.gallery': {
    displayName: 'Gallery',
    enumTag: 'gallery',
    parametersSchema: {},
  },
  'tlon.r0.content.notebook': {
    displayName: 'Notebook',
    enumTag: 'notebook',
    parametersSchema: {},
  },
  'tlon.r0.content.picto': {
    displayName: 'Picto',
    enumTag: 'picto',
    parametersSchema: {},
  },
  'tlon.r0.content.audio': {
    displayName: 'Audio',
    enumTag: 'audio',
    parametersSchema: {},
  },
  'tlon.r0.content.color': {
    displayName: 'Color',
    enumTag: 'color',
    parametersSchema: {},
  },
  'tlon.r0.content.raw': {
    displayName: 'Raw',
    enumTag: 'raw',
    parametersSchema: {},
  },
  'tlon.r0.content.yell': {
    displayName: 'Yell',
    enumTag: 'yell',
    parametersSchema: {},
  },
} as const satisfies Record<string, ComponentSpec>;

export const CollectionRendererId = makeEnum(allCollectionRenderers);
export type CollectionRendererId = ValuesOf<typeof CollectionRendererId>;

export const DraftInputId = makeEnum(allDraftInputs);
export type DraftInputId = ValuesOf<typeof DraftInputId>;

export const PostContentRendererId = makeEnum(allContentRenderers);
export type PostContentRendererId = ValuesOf<typeof PostContentRendererId>;

interface ParameterizedId<Id extends string> {
  id: Id;
  configuration?: Record<string, JSONValue>;
}

/**
 * Configures the custom components used to create content in a channel.
 */
export interface ChannelContentConfiguration {
  /**
   * Which controls are available when composing a new post?
   */
  draftInput: ParameterizedId<DraftInputId>;

  /**
   * How should we render a given post content type?
   *
   * This spec takes precedence over the client's default renderer mapping, but
   * does not take precedence over any mapping specified in a post's metadata.
   */
  defaultPostContentRenderer: ParameterizedId<PostContentRendererId>;

  /**
   * How should we render the entire collection of posts? (list, grid, etc)
   */
  defaultPostCollectionRenderer: ParameterizedId<CollectionRendererId>;
}

/**
 * We use a channel's `description` field to store structured data. This
 * module provides helpers for managing that data.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace StructuredChannelDescriptionPayload {
  type Encoded = string | null | undefined;
  interface Decoded {
    channelContentConfiguration?: ChannelContentConfiguration;
    description?: string;
  }

  export function encode(payload: Decoded): Encoded {
    return JSON.stringify(payload);
  }

  /**
   * Attempts to decode a `description` string into a structured payload.
   *
   * - If `description` is null/undefined, returns a payload with no
   *   description nor configuration.
   * - If `description` is not valid JSON, returns a payload with the
   *   description as the input string.
   * - If `description` validates as the expected
   *   `StructuredChannelDescriptionPayload` JSON, returns the decoded payload.
   */
  export function decode(encoded: Encoded): Decoded {
    // TODO: This should be validated - we'll be deserializing untrusted data
    if (encoded == null) {
      return {};
    }
    try {
      return JSON.parse(encoded);
    } catch (_err) {
      return { description: encoded.length === 0 ? undefined : encoded };
    }
  }
}

/**
 * Makes an enum-like value from a set of component specs.
 *
 * ```ts
 * const enumlike = makeEnum({
 *   foo: { enumTag: 'myFoo' },
 *   bar: { enumTag: 'myBar' },
 * });
 * enumlike.myFoo; // 'foo'
 * ```
 */
function makeEnum<SpecSet extends Record<string, ComponentSpec>>(
  specSet: SpecSet
) {
  return Object.entries(specSet).reduce(
    (acc, [id, { enumTag }]) => {
      // @ts-expect-error trust me bro
      acc[enumTag] = id;
      return acc;
    },
    {} as {
      [K in keyof typeof specSet as (typeof specSet)[K]['enumTag']]: K;
    }
  );
}
