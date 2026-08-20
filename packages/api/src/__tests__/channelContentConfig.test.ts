import { describe, expect, test } from 'vitest';

import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  StructuredChannelDescriptionPayload,
} from '../client/channelContentConfig';

const KIT_VIEW = 'tlon.r0.view.mealPlan';

function decodeConfig(configuration: unknown) {
  return StructuredChannelDescriptionPayload.decode(
    JSON.stringify({ channelContentConfiguration: configuration })
  ).channelContentConfiguration;
}

describe('StructuredChannelDescriptionPayload.decode — plain descriptions', () => {
  test('absent description decodes to an empty payload', () => {
    expect(StructuredChannelDescriptionPayload.decode(null)).toEqual({});
    expect(StructuredChannelDescriptionPayload.decode(undefined)).toEqual({});
    expect(StructuredChannelDescriptionPayload.decode('')).toEqual({});
  });

  test('non-JSON description is kept as the description', () => {
    expect(StructuredChannelDescriptionPayload.decode('cheers')).toEqual({
      description: 'cheers',
    });
  });

  test('round-trips a structured payload', () => {
    const encoded = StructuredChannelDescriptionPayload.encode({
      description: 'weekly meals',
      channelContentConfiguration:
        ChannelContentConfiguration.defaultConfiguration(),
    });
    const decoded = StructuredChannelDescriptionPayload.decode(encoded);
    expect(decoded.description).toEqual('weekly meals');
    expect(
      ChannelContentConfiguration.draftInput(
        decoded.channelContentConfiguration!
      ).id
    ).toEqual(DraftInputId.chat);
  });
});

describe('StructuredChannelDescriptionPayload.decode — registered ids', () => {
  test('keeps the built-in ids a channel declares', () => {
    const config = decodeConfig({
      draftInput: { id: DraftInputId.notebook },
      defaultPostContentRenderer: { id: PostContentRendererId.gallery },
      defaultPostCollectionRenderer: { id: CollectionRendererId.notebook },
    });

    expect(ChannelContentConfiguration.draftInput(config!).id).toEqual(
      DraftInputId.notebook
    );
    expect(
      ChannelContentConfiguration.defaultPostContentRenderer(config!).id
    ).toEqual(PostContentRendererId.gallery);
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(config!).id
    ).toEqual(CollectionRendererId.notebook);
  });

  test('normalizes the bare-string form to the parameterized form', () => {
    const config = decodeConfig({ draftInput: DraftInputId.gallery });
    expect(config!.draftInput).toEqual({ id: DraftInputId.gallery });
  });
});

describe('StructuredChannelDescriptionPayload.decode — unregistered ids', () => {
  // The load-bearing case for the fallback contract: normalizing an unknown id
  // to chat here would make it indistinguishable from "no view declared", and
  // the render layer could never show the upgrade notice.
  test('preserves an id this build does not know', () => {
    const config = decodeConfig({
      draftInput: { id: KIT_VIEW },
      defaultPostContentRenderer: { id: KIT_VIEW },
      defaultPostCollectionRenderer: { id: KIT_VIEW },
    });

    expect(ChannelContentConfiguration.draftInput(config!).id).toEqual(
      KIT_VIEW
    );
    expect(
      ChannelContentConfiguration.defaultPostContentRenderer(config!).id
    ).toEqual(KIT_VIEW);
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(config!).id
    ).toEqual(KIT_VIEW);
  });

  test('preserves an unknown id declared in the bare-string form', () => {
    const config = decodeConfig({ draftInput: KIT_VIEW });
    expect(config!.draftInput).toEqual({ id: KIT_VIEW });
  });

  test('preserves an unknown view configuration verbatim', () => {
    const config = decodeConfig({
      draftInput: { id: KIT_VIEW, configuration: { servings: 4 } },
    });
    expect(config!.draftInput).toEqual({
      id: KIT_VIEW,
      configuration: { servings: 4 },
    });
  });

  test('keeps unknown sibling keys, so a newer config survives a round trip', () => {
    const config = decodeConfig({
      draftInput: { id: DraftInputId.chat },
      somethingFromALaterVersion: { nested: true },
    });
    expect(
      (config as unknown as Record<string, unknown>).somethingFromALaterVersion
    ).toEqual({ nested: true });
  });
});

describe('StructuredChannelDescriptionPayload.decode — malformed declarations', () => {
  test.each([
    ['a number', 42],
    ['an empty string', ''],
    ['null', null],
    ['an array', ['tlon.r0.input.chat']],
    ['an object with no id', { configuration: { a: 1 } }],
    ['an object with a non-string id', { id: 7 }],
    ['an object with an empty id', { id: '' }],
  ])('a draftInput that is %s falls back to the built-in', (_label, value) => {
    const config = decodeConfig({ draftInput: value });
    expect(ChannelContentConfiguration.draftInput(config!).id).toEqual(
      DraftInputId.chat
    );
  });

  test('a malformed configuration is dropped but the id is kept', () => {
    const config = decodeConfig({
      draftInput: { id: KIT_VIEW, configuration: 'nope' },
    });
    expect(config!.draftInput).toEqual({ id: KIT_VIEW });
  });

  test('missing fields fall back to the built-ins', () => {
    const config = decodeConfig({});
    expect(ChannelContentConfiguration.draftInput(config!).id).toEqual(
      DraftInputId.chat
    );
    expect(
      ChannelContentConfiguration.defaultPostContentRenderer(config!).id
    ).toEqual(PostContentRendererId.chat);
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(config!).id
    ).toEqual(CollectionRendererId.chat);
  });

  test.each([
    ['null', null],
    ['a string', 'garbage'],
    ['a number', 3],
    ['an array', []],
  ])(
    'a channelContentConfiguration that is %s is dropped, keeping the description',
    (_label, value) => {
      const decoded = StructuredChannelDescriptionPayload.decode(
        JSON.stringify({
          description: 'still readable',
          channelContentConfiguration: value,
        })
      );
      expect(decoded.channelContentConfiguration).toBeUndefined();
      expect(decoded.description).toEqual('still readable');
    }
  );
});

describe('StructuredChannelDescriptionPayload.decode — collection parameters', () => {
  test('defaults showAuthors and showReplies on', () => {
    const config = decodeConfig({
      defaultPostCollectionRenderer: { id: CollectionRendererId.chat },
    });
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(config!)
        .configuration
    ).toMatchObject({ showAuthors: true, showReplies: true });
  });

  test('an explicit false is not overwritten by the defaults', () => {
    const config = decodeConfig({
      defaultPostCollectionRenderer: {
        id: CollectionRendererId.chat,
        configuration: { showAuthors: false },
      },
    });
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(config!)
        .configuration
    ).toMatchObject({ showAuthors: false, showReplies: true });
  });

  test('the defaults reach a collection declared in the bare-string form', () => {
    const config = decodeConfig({
      defaultPostCollectionRenderer: CollectionRendererId.chat,
    });
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(config!)
        .configuration
    ).toMatchObject({ showAuthors: true, showReplies: true });
  });
});
