import type { ValuesOf } from '../lib/utilityTypes';
import type { JSONValue } from '../types/JSONValue';
import { SurfaceSpec, SurfaceSpecSchema } from './surface/schemas';

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
  'tlon.r0.collection.notes': {
    displayName: 'Notes',
    enumTag: 'notes',
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
  'tlon.r0.input.notes': {
    displayName: 'Notes',
    enumTag: 'notes',
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
  'tlon.r0.content.notes': {
    displayName: 'Notes',
    enumTag: 'notes',
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
}

/**
 * We use a channel's `description` field to store structured data. This
 * module provides helpers for managing that data.
 */
export namespace StructuredChannelDescriptionPayload {
  type Encoded = string | null | undefined;
  export interface Decoded {
    channelContentConfiguration?: ChannelContentConfiguration;
    description?: string;
    /**
     * The surface channel app definition. Untrusted on decode — read it
     * through `surfaceSpec()`, which validates; write it as a
     * schema-conforming `SurfaceSpec`.
     */
    surfaceSpec?: SurfaceSpec;
    /**
     * Unknown keys survive decode→encode so that edit flows re-encoding a
     * payload can never erase fields this client version doesn't know.
     */
    [key: string]: unknown;
  }

  export function encode(payload: Decoded): Encoded {
    return JSON.stringify(payload);
  }

  /**
   * Decodes a `description` string into a structured payload, losslessly:
   * every key of the stored JSON object is preserved, so
   * `encode(decode(x))` is byte-equivalent to `x` for any payload produced
   * by a JSON serializer (as all payload writers are). No field is
   * validated here — use `surfaceSpec()` / `decodeWithDefaults()` for
   * validated views.
   *
   * - If `description` is null/undefined, returns an empty payload.
   * - If `description` is not a JSON object, returns a payload carrying the
   *   input as a plain-text description.
   */
  export function decode(encoded: Encoded): Decoded {
    if (encoded == null) {
      return {};
    }
    try {
      const out = JSON.parse(encoded);
      if (typeof out !== 'object' || !out || Array.isArray(out)) {
        return { description: encoded };
      }
      return out;
    } catch (_err) {
      return { description: encoded.length === 0 ? undefined : encoded };
    }
  }

  /**
   * Decode for rendering: like `decode`, but hydrates
   * `channelContentConfiguration` with defaults for missing fields so UI
   * consumers don't crash on partial configurations. NOT lossless — never
   * re-encode this result; re-encode the plain `decode` output instead.
   */
  export function decodeWithDefaults(encoded: Encoded): Decoded {
    const out = decode(encoded);
    if (!('channelContentConfiguration' in out)) {
      return out;
    }
    if (typeof out.channelContentConfiguration !== 'object') {
      // Legacy behavior: a non-object configuration voids the structured
      // reading and the raw string becomes the description. (A null
      // configuration hydrates pure defaults below, as it always has.)
      return typeof encoded === 'string' && encoded.length > 0
        ? { description: encoded }
        : {};
    }
    const cfg = {
      draftInput: DraftInputId.chat,
      defaultPostContentRenderer: PostContentRendererId.chat,
      defaultPostCollectionRenderer: CollectionRendererId.chat,
      ...(out.channelContentConfiguration as Partial<ChannelContentConfiguration> | null),
    } as ChannelContentConfiguration;

    // add defaults to some standard params
    const collCfgWithDefaults = ParameterizedId.coerce(
      cfg.defaultPostCollectionRenderer
    );
    collCfgWithDefaults.configuration = {
      showAuthors: true,
      showReplies: true,
      ...collCfgWithDefaults.configuration,
    };

    return { ...out, channelContentConfiguration: cfg };
  }

  /**
   * The validated surface spec carried by a decoded payload, or undefined
   * when absent or invalid. Identity and authority questions are not
   * answered here — the description cell's current content is authoritative
   * by construction (it only changes through the group-admin edit path).
   */
  export function surfaceSpec(decoded: Decoded): SurfaceSpec | undefined {
    if (decoded.surfaceSpec == null) {
      return undefined;
    }
    const parsed = SurfaceSpecSchema.safeParse(decoded.surfaceSpec);
    return parsed.success ? parsed.data : undefined;
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
