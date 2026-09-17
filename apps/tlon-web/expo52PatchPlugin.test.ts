import { describe, expect, it } from 'vitest';

import expo52PatchPlugin from './expo52PatchPlugin';

type PatchResult = null | {
  code: string;
  map: { version: number; mappings: string };
};

describe('expo52PatchPlugin', () => {
  const plugin = expo52PatchPlugin();
  const transform = plugin.transform as unknown as (
    this: unknown,
    code: string,
    id: string
  ) => PatchResult;
  const renderChunk = plugin.renderChunk as unknown as (
    this: unknown,
    code: string,
    chunk: { fileName: string }
  ) => PatchResult;

  describe('transform', () => {
    const code = "class X extends NativeModule { static name = 'ExpoImage'; }";

    it('strips static name assignments in expo modules and returns a map', () => {
      const result = transform.call(
        plugin,
        code,
        '/node_modules/expo-image/build/Foo.js'
      );
      expect(result).not.toBeNull();
      expect(result?.code).not.toContain('static name =');
      expect(result?.map.version).toBe(3);
      expect(typeof result?.map.mappings).toBe('string');
      expect(result?.map.mappings.length).toBeGreaterThan(0);
    });

    it('returns null for files outside expo packages', () => {
      expect(transform.call(plugin, code, '/src/app.ts')).toBeNull();
    });
  });

  describe('renderChunk', () => {
    const code = 'class A{static{wa(this,"ExpoImageModule")}}';

    it('patches static initializer helper calls in js chunks', () => {
      const result = renderChunk.call(plugin, code, {
        fileName: 'index-abc.js',
      });
      expect(result).not.toBeNull();
      expect(result?.code).toMatch(/static\s*\{\s*0\s*\}/);
      expect(result?.map.mappings.length).toBeGreaterThan(0);
    });

    it('returns null for non-js chunks', () => {
      expect(renderChunk.call(plugin, code, { fileName: 'x.css' })).toBeNull();
    });

    it('returns null when the pattern is absent', () => {
      expect(
        renderChunk.call(plugin, 'const a = 1;', { fileName: 'index-abc.js' })
      ).toBeNull();
    });
  });
});
