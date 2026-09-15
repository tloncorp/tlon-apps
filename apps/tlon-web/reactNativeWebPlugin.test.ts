import { describe, expect, it } from 'vitest';

import reactNativeWeb from './reactNativeWebPlugin';

type TransformResult = null | { code: string; map: unknown };

describe('reactNativeWebPlugin', () => {
  const plugin = reactNativeWeb();
  const transform = plugin.transform as unknown as (
    this: unknown,
    code: string,
    id: string
  ) => Promise<TransformResult>;

  it('returns null for non-js files so Rollup keeps their maps', async () => {
    expect(
      await transform.call(plugin, 'export const a: number = 1;', '/x/foo.ts')
    ).toBeNull();
    expect(
      await transform.call(plugin, 'export const a: number = 1;', '/x/foo.tsx')
    ).toBeNull();
  });

  it('returns null for .native.js files', async () => {
    expect(
      await transform.call(
        plugin,
        'export const a: number = 1;',
        '/x/Comp.native.js'
      )
    ).toBeNull();
  });

  it('transforms .js files and returns a source map', async () => {
    const input = 'export default () => <div/>;';
    const result = await transform.call(plugin, input, '/x/bar.js');
    expect(result).not.toBeNull();
    expect(typeof result?.code).toBe('string');
    expect(result?.code).not.toBe(input);
    expect(result?.map).toBeTruthy();
  });
});
