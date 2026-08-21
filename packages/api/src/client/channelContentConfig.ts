import type { ValuesOf } from '../lib/utilityTypes';
import type { JSONValue } from '../types/JSONValue';

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
  // A chat bifurcated into a mini-app and a conversation: the channel's
  // current interactive-surface card pinned above the flowing chat list.
  'tlon.r0.collection.pinnedSurface': {
    displayName: 'Pinned surface',
    enumTag: 'pinnedSurface',
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

/**
 * The built-in ids are enumerated, but the id *types* stay open.
 *
 * A channel's content configuration is untrusted JSON written by any client or
 * agent, so an id naming a view this build has never heard of is a normal
 * input rather than a bug — see `docs/tlon-apps/channel-views.md`. Keeping the
 * union members means `DraftInputId.chat` and literal autocomplete still work;
 * the `(string & {})` arm is what lets a declaration outlive the build that
 * reads it. Resolution and the fallback for unregistered ids live in
 * `packages/app/ui/contexts/componentsKits`.
 */
type OpenId<Known extends string> = Known | (string & {});

export const CollectionRendererId = makeEnum(allCollectionRenderers);
export type CollectionRendererId = OpenId<
  ValuesOf<typeof CollectionRendererId>
>;

export const DraftInputId = makeEnum(allDraftInputs);
export type DraftInputId = OpenId<ValuesOf<typeof DraftInputId>>;

export const PostContentRendererId = makeEnum(allContentRenderers);
export type PostContentRendererId = OpenId<
  ValuesOf<typeof PostContentRendererId>
>;

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
  interface Decoded {
    channelContentConfiguration?: ChannelContentConfiguration;
    description?: string;
  }

  export function encode(payload: Decoded): Encoded {
    return JSON.stringify(payload);
  }

  /**
   * Normalize one renderer-id field, or return null when the value is not a
   * usable declaration.
   *
   * An id this build does not recognize is deliberately **not** a validation
   * failure — it is preserved verbatim so the render layer can tell "a view we
   * don't have" apart from "no view declared" and show the fallback notice
   * instead of silently substituting chat. Only structurally unusable values
   * (non-strings, a missing or empty `id`, a non-object `configuration`) are
   * rejected, and the caller defaults those to the built-in for that field.
   */
  function normalizeId(raw: unknown): ParameterizedId<string> | null {
    if (typeof raw === 'string') {
      return raw.length > 0 ? { id: raw } : null;
    }
    if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
      return null;
    }
    const { id, configuration } = raw as {
      id?: unknown;
      configuration?: unknown;
    };
    if (typeof id !== 'string' || id.length === 0) {
      return null;
    }
    const out: ParameterizedId<string> = { id };
    if (
      typeof configuration === 'object' &&
      configuration != null &&
      !Array.isArray(configuration)
    ) {
      out.configuration = configuration as Record<string, JSONValue>;
    }
    return out;
  }

  function normalizeConfiguration(raw: object): ChannelContentConfiguration {
    const source = raw as Record<string, unknown>;
    const cfg = {
      // Unknown keys ride along untouched, for forward compatibility with
      // configurations written by a newer build.
      ...source,
      // A missing or malformed field defaults to its built-in rather than
      // crashing the channel.
      draftInput: normalizeId(source.draftInput) ?? { id: DraftInputId.chat },
      defaultPostContentRenderer: normalizeId(
        source.defaultPostContentRenderer
      ) ?? { id: PostContentRendererId.chat },
      defaultPostCollectionRenderer: normalizeId(
        source.defaultPostCollectionRenderer
      ) ?? { id: CollectionRendererId.chat },
    } as ChannelContentConfiguration;

    // add defaults to some standard params
    const collection = ParameterizedId.coerce(
      cfg.defaultPostCollectionRenderer
    );
    collection.configuration = {
      showAuthors: true,
      showReplies: true,
      ...collection.configuration,
    };
    cfg.defaultPostCollectionRenderer = collection;

    return cfg;
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
   *
   * The configuration is untrusted data, so every renderer-id field is
   * shape-checked by `normalizeId` — which keeps unrecognized ids rather than
   * normalizing them away. See `docs/tlon-apps/channel-views.md`.
   */
  export function decode(encoded: Encoded): Decoded {
    if (encoded == null) {
      return {};
    }
    try {
      const out = JSON.parse(encoded);
      if (typeof out !== 'object' || !out) {
        return {};
      }

      if ('channelContentConfiguration' in out) {
        const raw = out.channelContentConfiguration;
        if (typeof raw === 'object' && raw != null && !Array.isArray(raw)) {
          out.channelContentConfiguration = normalizeConfiguration(raw);
        } else {
          // A configuration that isn't an object carries nothing usable. Drop
          // it and keep the payload's `description`, rather than failing the
          // whole decode — that path surfaces the raw JSON to the user as the
          // channel's description.
          delete out.channelContentConfiguration;
        }
      }
      return out;
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
