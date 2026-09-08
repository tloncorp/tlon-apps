import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPostTargetLayoutRegistry } from './postTargetLayout';

function harness() {
  let frames: (() => void)[] = [];
  const registry = createPostTargetLayoutRegistry('chat/a', (cb) =>
    frames.push(cb)
  );
  const flush = () => {
    const batch = frames;
    frames = [];
    batch.forEach((fn) => fn());
  };
  return { registry, flush };
}
describe('actual native row decoration registry', () => {
  it('knows zero only for absent nodes and waits for all present layouts', () => {
    const { registry, flush } = harness();
    const row = registry.createLease('chat/a', 'one', {
      leading: true,
      trailing: true,
    });
    row.activate();
    row.layout('cell', 200);
    flush();
    expect(registry.get('one', 200)).toBeUndefined();
    row.layout('leading-divider', 48);
    row.layout('leading-separator', 8);
    flush();
    expect(registry.get('one', 200)).toBeUndefined();
    row.layout('trailing-separator', 8);
    flush();
    expect(registry.get('one', 200)).toEqual({
      leading: 56,
      trailing: 8,
      cellSizeDelta: 0,
    });
  });
  it('invalidates synchronously during body resize and binds the current cell size', () => {
    const { registry, flush } = harness();
    const row = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: true,
    });
    row.activate();
    row.layout('cell', 128);
    row.layout('trailing-separator', 8);
    flush();
    expect(registry.get('one', 128)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
    row.layout('cell', 368);
    expect(registry.get('one', 128)).toBeUndefined();
    flush();
    expect(registry.get('one', 128)).toBeUndefined();
    expect(registry.get('one', 368)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 0,
    });
  });
  it('publishes a changed divider only after the same layout batch completes', () => {
    const { registry, flush } = harness();
    const row = registry.createLease('chat/a', 'one', {
      leading: true,
      trailing: false,
    });
    row.activate();
    row.layout('cell', 200);
    row.layout('leading-divider', 48);
    row.layout('leading-separator', 8);
    flush();
    row.layout('leading-divider', 61.5);
    expect(registry.get('one', 200)).toBeUndefined();
    row.layout('cell', 213.5);
    flush();
    expect(registry.get('one', 213.5)).toEqual({
      leading: 69.5,
      trailing: 0,
      cellSizeDelta: 0,
    });
  });
  it('never adopts duplicate owners and old cleanup cannot delete their replacement', () => {
    const { registry, flush } = harness();
    const old = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: false,
    });
    const fresh = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: false,
    });
    old.activate();
    old.layout('cell', 120);
    flush();
    fresh.activate();
    fresh.layout('cell', 160);
    flush();
    expect(registry.get('one', 160)).toBeUndefined();
    old.deactivate();
    old.layout('cell', 999);
    old.deactivate();
    flush();
    expect(registry.get('one', 160)).toEqual({
      leading: 0,
      trailing: 0,
      cellSizeDelta: 0,
    });
  });
  it('rejects wrong scope, a late old frame and return through a new same-key owner', () => {
    const { registry, flush } = harness();
    const old = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: false,
    });
    const wrong = registry.createLease('chat/b', 'one', {
      leading: false,
      trailing: false,
    });
    old.activate();
    old.layout('cell', 120);
    old.deactivate();
    wrong.activate();
    wrong.layout('cell', 120);
    flush();
    expect(registry.get('one', 120)).toBeUndefined();
    const fresh = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: false,
    });
    fresh.activate();
    fresh.layout('cell', 120);
    flush();
    old.layout('cell', 300);
    flush();
    expect(registry.get('one', 120)).toEqual({
      leading: 0,
      trailing: 0,
      cellSizeDelta: 0,
    });
  });
  it.each([NaN, Infinity, -1])(
    'does not retain an older result after an invalid height %s',
    (height) => {
      const { registry, flush } = harness();
      const row = registry.createLease('chat/a', 'one', {
        leading: false,
        trailing: true,
      });
      row.activate();
      row.layout('cell', 128);
      row.layout('trailing-separator', 8);
      flush();
      row.layout('trailing-separator', height);
      flush();
      expect(registry.get('one', 128)).toBeUndefined();
    }
  );
  it('supports effect replay on the same host while rejecting an older queued publication', () => {
    const { registry, flush } = harness();
    const row = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: false,
    });
    row.activate();
    row.layout('cell', 120);
    row.deactivate();
    row.activate();
    flush();
    expect(registry.get('one', 120)).toEqual({
      leading: 0,
      trailing: 0,
      cellSizeDelta: 0,
    });
    row.deactivate();
    flush();
    expect(registry.get('one', 120)).toBeUndefined();
  });
});

// Exact installed native height normalization, independent of the landing ruler.
describe('fractional native cell compatibility', () => {
  it('matches actual installed native roundSize rather than a measurement tolerance', () => {
    const require = createRequire(resolve('package.json'));
    const source = readFileSync(
      join(
        dirname(require.resolve('@legendapp/list/react-native')),
        'react-native.js'
      ),
      'utf8'
    );
    const body = /function roundSize\(size\) \{([\s\S]*?)\n\}/.exec(
      source
    )?.[1];
    expect(body).toBeDefined();
    const nativeRound = new Function('size', body!) as (
      height: number
    ) => number;
    for (const height of [129.666992, 184.333328, 200.12499]) {
      const { registry, flush } = harness();
      const row = registry.createLease('chat/a', 'one', {
        leading: false,
        trailing: false,
      });
      row.activate();
      row.layout('cell', height);
      flush();
      const indexed = nativeRound(height);
      expect(registry.get('one', indexed)?.cellSizeDelta).toBe(
        indexed - height
      );
    }
  });
  it.each([129.666992, 184.333328, 200.12499])(
    'accepts the exact eighth-point cell for actual height %s',
    (height) => {
      const { registry, flush } = harness();
      const row = registry.createLease('chat/a', 'one', {
        leading: false,
        trailing: true,
      });
      row.activate();
      row.layout('cell', height);
      row.layout('trailing-separator', 8);
      flush();
      const indexed = Math.floor(height * 8) / 8;
      expect(registry.get('one', indexed)).toEqual({
        leading: 0,
        trailing: 8,
        cellSizeDelta: indexed - height,
      });
      expect(registry.get('one', indexed + 0.125)).toBeUndefined();
      expect(registry.get('one', indexed - 0.125)).toBeUndefined();
    }
  );
});

// Native size acceptance can retain the old indexed size instead of rounding
// the latest measurement. This is the dependency's exact policy, not a ruler.
describe('native retained measurement compatibility', () => {
  function measured(height: number) {
    const h = harness();
    const lease = h.registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: true,
    });
    lease.activate();
    lease.layout('cell', height);
    lease.layout('trailing-separator', 8);
    h.flush();
    return { ...h, lease };
  }
  it('retains the measured decoration and exact size delta when Legend suppressed its size update', () => {
    const { registry } = measured(129.333008);
    expect(registry.get('one', 129.625, 3)).toEqual({
      leading: 0,
      trailing: 8,
      cellSizeDelta: 129.625 - 129.333008,
    });
    expect(registry.get('one', 129.625)).toBeUndefined();
  });
  it('matches the actual installed native noise predicate on both sides of its boundary', () => {
    const require = createRequire(resolve('package.json'));
    const source = readFileSync(
      join(
        dirname(require.resolve('@legendapp/list/react-native')),
        'react-native.js'
      ),
      'utf8'
    );
    const epsilon = /var FLOATING_POINT_SLACK = ([^;]+);/.exec(source)?.[1];
    const limit = /var NATIVE_LAYOUT_MEASUREMENT_EPSILON = ([^;]+);/.exec(
      source
    )?.[1];
    const body = /function isWithinEpsilon\(delta\) \{([\s\S]*?)\n\}/.exec(
      source
    )?.[1];
    expect(epsilon && limit && body).toBeTruthy();
    const actualRule = new Function(
      'PixelRatio',
      'delta',
      `const FLOATING_POINT_SLACK=${epsilon}; const NATIVE_LAYOUT_MEASUREMENT_EPSILON=${limit}; ${body}`
    ) as (ratio: { get: () => number }, delta: number) => boolean;
    for (const ratio of [1, 2, 3]) {
      for (const sign of [-1, 1]) {
        for (const edge of [-0.00001, 0.00001]) {
          const cell = 129.625 + sign * (1 / ratio + 0.01 + edge);
          const { registry } = measured(cell);
          const allowed = actualRule({ get: () => ratio }, cell - 129.625);
          expect(registry.get('one', 129.625, ratio) !== undefined).toBe(
            allowed
          );
        }
      }
    }
  });
  it.each([undefined, 0, -1, NaN, Infinity])(
    'does not invent a native scale from %s',
    (ratio) => {
      const { registry } = measured(129.333008);
      expect(registry.get('one', 129.625, ratio)).toBeUndefined();
    }
  );
  it('rejects a size the native index could not retain through its eighth normalization', () => {
    const { registry } = measured(129.333008);
    expect(registry.get('one', 129.6, 3)).toBeUndefined();
  });
  it('does not reuse unpublished, invalidated, duplicate or retired host geometry through noise compatibility', () => {
    const { registry, lease, flush } = measured(129.333008);
    lease.invalidate();
    expect(registry.get('one', 129.625, 3)).toBeUndefined();
    lease.layout('cell', 129.333008);
    lease.layout('trailing-separator', 8);
    expect(registry.get('one', 129.625, 3)).toBeUndefined();
    flush();
    const duplicate = registry.createLease('chat/a', 'one', {
      leading: false,
      trailing: false,
    });
    duplicate.activate();
    expect(registry.get('one', 129.625, 3)).toBeUndefined();
    duplicate.deactivate();
    expect(registry.get('one', 129.625, 3)).toBeDefined();
    lease.deactivate();
    expect(registry.get('one', 129.625, 3)).toBeUndefined();
  });
});
