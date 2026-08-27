import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { StructuredChannelDescriptionPayload } from '../client/channelContentConfig';
import type { Json } from '../client/surface/json';
import { validSpec } from './surfaceSchemas.test';

const SCDP = StructuredChannelDescriptionPayload;

describe('decode losslessness', () => {
  test('a payload with unrecognized fields survives decode→encode byte-equivalent', () => {
    const encoded = JSON.stringify({
      description: 'hello',
      channelContentConfiguration: {
        draftInput: 'tlon.r0.input.chat',
      },
      surfaceSpec: validSpec(),
      someFutureField: { nested: [1, 2, 3] },
      anotherUnknown: 'keep me',
    });
    expect(SCDP.encode(SCDP.decode(encoded))).toBe(encoded);
  });

  test('property: JSON-object payloads round-trip byte-equivalent', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ maxLength: 8 }),
          fc.jsonValue({ maxDepth: 3 }) as fc.Arbitrary<Json>,
          { maxKeys: 6 }
        ),
        (payload) => {
          const encoded = JSON.stringify(payload);
          expect(SCDP.encode(SCDP.decode(encoded))).toBe(encoded);
        }
      )
    );
  });

  test('decode does not inject configuration defaults', () => {
    const encoded = JSON.stringify({
      channelContentConfiguration: { draftInput: 'tlon.r0.input.gallery' },
    });
    const decoded = SCDP.decode(encoded);
    expect(decoded.channelContentConfiguration).toEqual({
      draftInput: 'tlon.r0.input.gallery',
    });
  });

  test('non-payload descriptions fall back to plain text', () => {
    expect(SCDP.decode(null)).toEqual({});
    expect(SCDP.decode(undefined)).toEqual({});
    expect(SCDP.decode('')).toEqual({});
    expect(SCDP.decode('just a description')).toEqual({
      description: 'just a description',
    });
    // valid JSON but not an object: treated as plain text, not dropped
    expect(SCDP.decode('5')).toEqual({ description: '5' });
    expect(SCDP.decode('[1,2]')).toEqual({ description: '[1,2]' });
  });
});

describe('decodeWithDefaults', () => {
  test('hydrates missing configuration fields like the legacy decode', () => {
    const encoded = JSON.stringify({
      description: 'desc',
      channelContentConfiguration: {
        draftInput: 'tlon.r0.input.gallery',
      },
    });
    const decoded = SCDP.decodeWithDefaults(encoded);
    expect(decoded.description).toBe('desc');
    // Legacy quirk preserved: a string-form collection renderer stays a
    // string (the coerced copy that receives showAuthors/showReplies is
    // discarded); only object-form renderers gain those params (below).
    expect(decoded.channelContentConfiguration).toEqual({
      draftInput: 'tlon.r0.input.gallery',
      defaultPostContentRenderer: 'tlon.r0.content.chat',
      defaultPostCollectionRenderer: 'tlon.r0.collection.chat',
    });
  });

  test('object-form collection renderers gain standard params (legacy)', () => {
    const encoded = JSON.stringify({
      channelContentConfiguration: {
        defaultPostCollectionRenderer: { id: 'tlon.r0.collection.gallery' },
      },
    });
    const decoded = SCDP.decodeWithDefaults(encoded);
    expect(decoded.channelContentConfiguration).toMatchObject({
      defaultPostCollectionRenderer: {
        id: 'tlon.r0.collection.gallery',
        configuration: { showAuthors: true, showReplies: true },
      },
    });
  });

  test('a null configuration hydrates pure defaults (legacy)', () => {
    const encoded = JSON.stringify({ channelContentConfiguration: null });
    const decoded = SCDP.decodeWithDefaults(encoded);
    expect(decoded.channelContentConfiguration).toMatchObject({
      draftInput: 'tlon.r0.input.chat',
    });
  });

  test('a non-object configuration voids the structured reading (legacy)', () => {
    const encoded = JSON.stringify({ channelContentConfiguration: 'nope' });
    expect(SCDP.decodeWithDefaults(encoded)).toEqual({
      description: encoded,
    });
  });

  test('preserves unknown keys and surfaceSpec alongside hydration', () => {
    const encoded = JSON.stringify({
      channelContentConfiguration: {},
      surfaceSpec: validSpec(),
      unknownKey: 42,
    });
    const decoded = SCDP.decodeWithDefaults(encoded);
    expect(decoded.unknownKey).toBe(42);
    expect(decoded.surfaceSpec).toEqual(validSpec());
  });
});

describe('surfaceSpec accessor', () => {
  test('returns the validated spec from a decoded payload', () => {
    const decoded = SCDP.decode(
      JSON.stringify({ description: 'x', surfaceSpec: validSpec() })
    );
    const spec = SCDP.surfaceSpec(decoded);
    expect(spec).toBeDefined();
    expect(spec?.surfaceId).toBe('srf-0001');
    expect(spec?.specRevision).toBe(3);
  });

  test('returns undefined when absent or invalid', () => {
    expect(SCDP.surfaceSpec(SCDP.decode(null))).toBeUndefined();
    expect(
      SCDP.surfaceSpec(SCDP.decode(JSON.stringify({ description: 'x' })))
    ).toBeUndefined();
    const invalid = SCDP.decode(
      JSON.stringify({ surfaceSpec: { version: 1, garbage: true } })
    );
    expect(SCDP.surfaceSpec(invalid)).toBeUndefined();
    const wrongType = SCDP.decode(JSON.stringify({ surfaceSpec: 'nope' }));
    expect(SCDP.surfaceSpec(wrongType)).toBeUndefined();
  });

  test('an invalid spec is preserved through re-encode even though unusable', () => {
    const encoded = JSON.stringify({ surfaceSpec: { version: 999 } });
    const decoded = SCDP.decode(encoded);
    expect(SCDP.surfaceSpec(decoded)).toBeUndefined();
    expect(SCDP.encode(decoded)).toBe(encoded);
  });
});
