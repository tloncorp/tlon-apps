import { describe, expect, test } from 'vitest';

import { StructuredChannelDescriptionPayload } from '../client/channelContentConfig';
import {
  SUPPORTED_SURFACE_SPEC_VERSION,
  readSurfaceSpec,
} from '../client/surface/schemas';
import { validSpec } from './surfaceSchemas.test';

const SCDP = StructuredChannelDescriptionPayload;

describe('readSurfaceSpec', () => {
  test('absent for null, undefined, empty, and stored null', () => {
    for (const raw of [null, undefined, '', 'null']) {
      expect(readSurfaceSpec(raw)).toEqual({ status: 'absent' });
    }
  });

  test('valid for a conforming spec, returning the validated view', () => {
    const result = readSurfaceSpec(JSON.stringify(validSpec()));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.spec.surfaceId).toBe('srf-0001');
      expect(result.spec.specRevision).toBe(3);
    }
  });

  test('invalid for garbage, wrong shapes, and schema failures', () => {
    for (const raw of [
      'not json',
      '42',
      '"a string"',
      '[1,2]',
      '{}',
      JSON.stringify({ version: 1, garbage: true }),
      JSON.stringify({ ...validSpec(), bundle: null }),
      JSON.stringify({ ...validSpec(), specRevision: -1 }),
    ]) {
      expect(readSurfaceSpec(raw)).toEqual({ status: 'invalid' });
    }
  });

  test('version-too-new wins over other validation failures', () => {
    const next = SUPPORTED_SURFACE_SPEC_VERSION + 1;
    // an otherwise-complete future spec
    expect(
      readSurfaceSpec(JSON.stringify({ ...validSpec(), version: next }))
    ).toEqual({ status: 'version-too-new', version: next });
    // a future spec whose other fields make no sense to this client
    expect(
      readSurfaceSpec(JSON.stringify({ version: 99, blob: 'from the future' }))
    ).toEqual({ status: 'version-too-new', version: 99 });
  });

  test('non-integer or non-numeric versions are invalid, not too-new', () => {
    for (const version of ['2', 1.5, null, [2], { v: 2 }]) {
      expect(
        readSurfaceSpec(JSON.stringify({ ...validSpec(), version }))
      ).toEqual({ status: 'invalid' });
    }
  });

  test('unknown keys inside the spec do not affect validity', () => {
    const raw = JSON.stringify({ ...validSpec(), futureField: { x: 1 } });
    expect(readSurfaceSpec(raw).status).toBe('valid');
  });
});

describe('rawPersistenceFields', () => {
  test('extracts the verbatim payload and the raw spec subtree', () => {
    const spec = { ...validSpec(), futureField: 'keep me' };
    const encoded = SCDP.encode({
      description: 'hello',
      surfaceSpec: spec as never,
      payloadLevelUnknown: 42,
    })!;
    const fields = SCDP.rawPersistenceFields(encoded);
    expect(fields.descriptionPayload).toBe(encoded);
    // the raw subtree round-trips with unknown keys intact
    expect(JSON.parse(fields.surfaceSpec!)).toEqual(spec);
    // and reads as valid through the read API
    expect(readSurfaceSpec(fields.surfaceSpec).status).toBe('valid');
  });

  test('no structured payload -> plain description, null fields', () => {
    expect(SCDP.rawPersistenceFields('just text')).toEqual({
      descriptionPayload: 'just text',
      surfaceSpec: null,
    });
    expect(SCDP.rawPersistenceFields(null)).toEqual({
      descriptionPayload: null,
      surfaceSpec: null,
    });
    expect(SCDP.rawPersistenceFields('')).toEqual({
      descriptionPayload: null,
      surfaceSpec: null,
    });
  });

  test('a payload without surfaceSpec stores none, even with other keys', () => {
    const encoded = SCDP.encode({
      description: 'x',
      channelContentConfiguration: undefined,
      unknownKey: true,
    })!;
    const fields = SCDP.rawPersistenceFields(encoded);
    expect(fields.descriptionPayload).toBe(encoded);
    expect(fields.surfaceSpec).toBeNull();
  });

  test('an invalid spec subtree is still persisted raw (validate at read)', () => {
    const encoded = SCDP.encode({ surfaceSpec: { version: 1 } as never })!;
    const fields = SCDP.rawPersistenceFields(encoded);
    expect(fields.surfaceSpec).toBe(JSON.stringify({ version: 1 }));
    expect(readSurfaceSpec(fields.surfaceSpec)).toEqual({ status: 'invalid' });
  });
});
