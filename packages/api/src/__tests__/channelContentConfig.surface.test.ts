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

describe('surface registry ids', () => {
  test('the surface collection renderer and none input are registered', async () => {
    const { CollectionRendererId, DraftInputId } =
      await import('../client/channelContentConfig');
    expect(CollectionRendererId.surface).toBe('tlon.r0.collection.surface');
    expect(DraftInputId.none).toBe('tlon.r0.input.none');
  });
});

describe('applyMetadataEdit', () => {
  const payload = JSON.stringify({
    description: 'desc',
    channelContentConfiguration: { draftInput: 'tlon.r0.input.chat' },
    surfaceSpec: validSpec(),
    unknownKey: [1, 2],
  });

  test('no-op edits return the payload byte-identical', () => {
    const view = SCDP.decodeWithDefaults(payload);
    expect(
      SCDP.applyMetadataEdit(payload, {
        description: 'desc',
        channelContentConfiguration: view.channelContentConfiguration,
      })
    ).toBe(payload);
  });

  test('unchanged hydrated configuration is not materialized back', () => {
    // the hydrated view differs from the sparse stored config, but since it
    // is semantically the stored config, the stored bytes win
    const view = SCDP.decodeWithDefaults(payload);
    const out = SCDP.applyMetadataEdit(payload, {
      channelContentConfiguration: view.channelContentConfiguration,
    });
    expect(out).toBe(payload);
  });

  test('a changed configuration is overlaid; the rest rides through', () => {
    const view = SCDP.decodeWithDefaults(payload);
    const changed = {
      ...view.channelContentConfiguration!,
      defaultPostContentRenderer: 'tlon.r0.content.gallery',
    };
    const out = SCDP.applyMetadataEdit(payload, {
      channelContentConfiguration: changed as never,
    });
    const decoded = SCDP.decode(out);
    expect(decoded.channelContentConfiguration).toEqual(changed);
    expect(JSON.stringify(decoded.surfaceSpec)).toBe(
      JSON.stringify(validSpec())
    );
    expect(decoded.unknownKey).toEqual([1, 2]);
    expect(decoded.description).toBe('desc');
  });

  test('plain descriptions stay plain; empty stays empty', () => {
    expect(SCDP.applyMetadataEdit('hello', { description: 'goodbye' })).toBe(
      'goodbye'
    );
    expect(SCDP.applyMetadataEdit(null, { description: null })).toBe('');
    expect(SCDP.applyMetadataEdit('', {})).toBe('');
  });

  test('a description that would read as a payload gets wrapped', () => {
    const out = SCDP.applyMetadataEdit(null, {
      description: '{"sneaky": true}',
    });
    expect(out).toBe(JSON.stringify({ description: '{"sneaky": true}' }));
    expect(SCDP.decode(out)).toEqual({ description: '{"sneaky": true}' });
    // scalars and arrays decode back as plain text already, so stay bare
    expect(SCDP.applyMetadataEdit(null, { description: '5' })).toBe('5');
    expect(SCDP.applyMetadataEdit(null, { description: '[1]' })).toBe('[1]');
  });

  test('removing the configuration keeps the rest of the payload', () => {
    const out = SCDP.applyMetadataEdit(payload, {
      channelContentConfiguration: null,
    });
    const decoded = SCDP.decode(out);
    expect('channelContentConfiguration' in decoded).toBe(false);
    expect(JSON.stringify(decoded.surfaceSpec)).toBe(
      JSON.stringify(validSpec())
    );
    expect(decoded.unknownKey).toEqual([1, 2]);
  });

  test('adding a configuration to a plain channel structures the payload', () => {
    const out = SCDP.applyMetadataEdit('just text', {
      description: 'just text',
      channelContentConfiguration: {
        draftInput: 'tlon.r0.input.chat',
      } as never,
    });
    expect(SCDP.decode(out)).toEqual({
      description: 'just text',
      channelContentConfiguration: { draftInput: 'tlon.r0.input.chat' },
    });
  });
});
