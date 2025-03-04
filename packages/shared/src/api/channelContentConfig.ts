import type { JSONValue } from '../types/JSONValue';
import { ChannelMetadata } from '../urbit';
import { ValuesOf } from '../utils';

interface BaseParameterSpec {
  displayName: string;
}

interface BooleanParameterSpec extends BaseParameterSpec {
  type: 'boolean';
}

interface StringParameterSpec extends BaseParameterSpec {
  type: 'string';
}

interface RadioParameterSpec extends BaseParameterSpec {
  type: 'radio';
  options: { displayName: string; value: string }[];
}

type ParameterSpec =
  | BooleanParameterSpec
  | StringParameterSpec
  | RadioParameterSpec;

export interface ComponentSpec<EnumTag extends string = string> {
  displayName: string;
  enumTag: EnumTag;
  parametersSchema?: Record<string, ParameterSpec>;
}

function standardCollectionParameters(): Record<string, ParameterSpec> {
  return {
    showAuthors: {
      displayName: 'Show authors',
      type: 'boolean',
    },
    showReplies: {
      displayName: 'Show replies',
      type: 'boolean',
    },
  };
}

export const allCollectionRenderers = {
  'tlon.r0.collection.chat': {
    displayName: 'Chat',
    enumTag: 'chat',
    parametersSchema: standardCollectionParameters(),
  },
  'tlon.r0.collection.gallery': {
    displayName: 'Gallery',
    enumTag: 'gallery',
    parametersSchema: standardCollectionParameters(),
  },
  'tlon.r0.collection.notebook': {
    displayName: 'Notebook',
    enumTag: 'notebook',
    parametersSchema: standardCollectionParameters(),
  },
  'tlon.r0.collection.carousel': {
    displayName: 'Carousel',
    enumTag: 'carousel',
    parametersSchema: {
      ...standardCollectionParameters(),
      scrollDirection: {
        displayName: 'Scroll direction',
        type: 'radio',
        options: [
          {
            displayName: 'Horizontal',
            value: 'horizontal',
          },
          {
            displayName: 'Vertical',
            value: 'vertical',
          },
        ],
      },
    },
  },
  'tlon.r0.collection.cards': {
    displayName: 'Cards',
    enumTag: 'cards',
    parametersSchema: standardCollectionParameters(),
  },
  'tlon.r0.collection.sign': {
    displayName: 'Sign',
    enumTag: 'sign',
    parametersSchema: standardCollectionParameters(),
  },
  'tlon.r0.collection.boardroom': {
    displayName: 'Boardroom',
    enumTag: 'boardroom',
    parametersSchema: standardCollectionParameters(),
  },
  'tlon.r0.collection.strobe': {
    displayName: 'Strobe',
    enumTag: 'strobe',
    parametersSchema: {
      ...standardCollectionParameters(),
      interval: {
        displayName: 'Frame rate in milliseconds',
        type: 'string',
      },
    },
  },
  'tlon.r0.collection.summaries': {
    displayName: 'Summaries',
    enumTag: 'summaries',
    parametersSchema: standardCollectionParameters(),
  },
} as const satisfies Record<string, ComponentSpec>;

export const allDraftInputs = {
  'tlon.r0.input.chat': {
    displayName: 'Chat',
    enumTag: 'chat',
  },
  'tlon.r0.input.gallery': {
    displayName: 'Gallery',
    enumTag: 'gallery',
  },
  'tlon.r0.input.notebook': {
    displayName: 'Notebook',
    enumTag: 'notebook',
  },
  'tlon.r0.input.yo': {
    displayName: 'Yo',
    enumTag: 'yo',
    parametersSchema: {
      text: {
        displayName: 'Message text',
        type: 'string',
      },
    },
  },
  'tlon.r0.input.mic': {
    displayName: 'Mic',
    enumTag: 'mic',
  },
  'tlon.r0.input.color': {
    displayName: 'Color',
    enumTag: 'color',
  },
} as const satisfies Record<string, ComponentSpec>;

export const allContentRenderers = {
  'tlon.r0.content.chat': {
    displayName: 'Chat',
    enumTag: 'chat',
  },
  'tlon.r0.content.gallery': {
    displayName: 'Gallery',
    enumTag: 'gallery',
    parametersSchema: {
      embedded: {
        displayName: 'Show frame',
        type: 'boolean',
      },
      contentSize: {
        displayName: 'Content size',
        type: 'radio',
        options: [
          {
            displayName: 'Large',
            value: '$l',
          },
          {
            displayName: 'Small',
            value: '$s',
          },
        ],
      },
    },
  },
  'tlon.r0.content.notebook': {
    displayName: 'Notebook',
    enumTag: 'notebook',
  },
  'tlon.r0.content.audio': {
    displayName: 'Audio',
    enumTag: 'audio',
  },
  'tlon.r0.content.color': {
    displayName: 'Color',
    enumTag: 'color',
  },
  'tlon.r0.content.raw': {
    displayName: 'Raw',
    enumTag: 'raw',
    parametersSchema: {
      fontFamily: {
        displayName: 'Font family',
        type: 'string',
      },
    },
  },
  'tlon.r0.content.yell': {
    displayName: 'Yell',
    enumTag: 'yell',
  },
  'tlon.r0.content.scratchpad': {
    displayName: 'Scratchpad',
    enumTag: 'scratchpad',
  },
} as const satisfies Record<string, ComponentSpec>;

export const CollectionRendererId = makeEnum(allCollectionRenderers);
export type CollectionRendererId = ValuesOf<typeof CollectionRendererId>;

export const DraftInputId = makeEnum(allDraftInputs);
export type DraftInputId = ValuesOf<typeof DraftInputId>;

export const PostContentRendererId = makeEnum(allContentRenderers);
export type PostContentRendererId = ValuesOf<typeof PostContentRendererId>;

type ParameterizedId<Id extends string> = {
  id: Id;
  configuration?: Record<string, JSONValue>;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ParameterizedId {
  export function id<Id extends string>(id: ParameterizedId<Id>): Id {
    return typeof id === 'string' ? id : id.id;
  }
  export function coerce<Id extends string>(
    id: Id | ParameterizedId<Id>
  ): ParameterizedId<Id> {
    return typeof id === 'string' ? { id } : id;
  }
}

/**
 * Configures the custom components used to create content in a channel.
 */
export interface ChannelContentConfiguration {
  /**
   * Which controls are available when composing a new post?
   */
  draftInput: DraftInputId | ParameterizedId<DraftInputId>;

  /**
   * How should we render a given post content type?
   *
   * This spec takes precedence over the client's default renderer mapping, but
   * does not take precedence over any mapping specified in a post's metadata.
   */
  defaultPostContentRenderer:
    | PostContentRendererId
    | ParameterizedId<PostContentRendererId>;

  /**
   * How should we render the entire collection of posts? (list, grid, etc)
   */
  defaultPostCollectionRenderer:
    | CollectionRendererId
    | ParameterizedId<CollectionRendererId>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ChannelContentConfiguration {
  export function defaultConfiguration(): ChannelContentConfiguration {
    return {
      draftInput: { id: DraftInputId.chat },
      defaultPostContentRenderer: { id: PostContentRendererId.chat },
      defaultPostCollectionRenderer: { id: CollectionRendererId.chat },
    };
  }

  export function draftInput(
    configuration: ChannelContentConfiguration
  ): ParameterizedId<DraftInputId> {
    return ParameterizedId.coerce(configuration.draftInput);
  }
  export function defaultPostContentRenderer(
    configuration: ChannelContentConfiguration
  ): ParameterizedId<PostContentRendererId> {
    return ParameterizedId.coerce(configuration.defaultPostContentRenderer);
  }
  export function defaultPostCollectionRenderer(
    configuration: ChannelContentConfiguration
  ): ParameterizedId<CollectionRendererId> {
    return ParameterizedId.coerce(configuration.defaultPostCollectionRenderer);
  }

  export function toApiMeta(cfg: ChannelContentConfiguration): ChannelMetadata {
    return {
      version: 1,

      postInput: ((x) => ({
        postType: x.id,

        type: x.id,
        configuration: x.configuration,
      }))(ChannelContentConfiguration.draftInput(cfg)),

      postCollectionRenderer: ((x) => ({
        id: x.id,
        configuration: x.configuration,
      }))(ChannelContentConfiguration.defaultPostCollectionRenderer(cfg)),

      defaultContentRenderer: ((x) => ({
        rendererId: x.id,
        configuration: x.configuration,
      }))(ChannelContentConfiguration.defaultPostContentRenderer(cfg)),
    };
  }

  export function fromApiMeta(
    meta: ChannelMetadata
  ): ChannelContentConfiguration {
    return {
      draftInput: {
        id: meta.postInput.type as DraftInputId,
        configuration: meta.postInput.configuration,
      },
      defaultPostContentRenderer: {
        id: meta.defaultContentRenderer.rendererId as PostContentRendererId,
        configuration: meta.defaultContentRenderer.configuration,
      },
      defaultPostCollectionRenderer: {
        id: meta.postCollectionRenderer.id as CollectionRendererId,
        configuration: meta.postCollectionRenderer.configuration,
      },
    };
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
