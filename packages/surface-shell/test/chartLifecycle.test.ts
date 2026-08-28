import { Chart, registerables } from 'chart.js';
import { expect, test } from 'vitest';

import { runShellFixture } from '../src/node/index';

/**
 * The leak check, run through the REAL harness and the REAL Chart.js: a
 * bundle that charts from a pure `render(state)`, driven through many
 * state updates. Chart.js keeps every live instance in `Chart.instances`
 * and deletes the entry in `destroy()`, so that map is an honest count of
 * what the primitive has allocated.
 *
 * happy-dom has no 2D context, so nothing is drawn here (see
 * src/artifact/chart.test.ts) — the instance bookkeeping is real either
 * way, and the drawn result is verified in the simulator and the browser.
 *
 * One documented consequence of that: Chart.js degrades cleanly on
 * CONSTRUCTION without a context but `update()` throws
 * ("Cannot read properties of null (reading 'ownerDocument')"), so in this
 * environment the primitive's in-place update falls back to a rebuild. The
 * property under test is the one that survives either path — at most one
 * live instance and one canvas, no matter how many updates arrive.
 */

Chart.register(...registerables);

const BUNDLE = `
  (function () {
    const { html, primitives } = surface;
    const { Card, Chart } = primitives;
    surface.register({
      render(state) {
        if (state.hide) {
          return html\`<\${Card} title="no chart" />\`;
        }
        return html\`
          <\${Card} title="counts">
            <\${Chart}
              type="bar"
              data=\${{
                labels: state.labels,
                datasets: [{ label: 'n', data: state.values }],
              }}
            />
          <//>
        \`;
      },
    });
  })();
`;

const SPEC = {
  version: 1,
  surfaceId: 'chart-lifecycle',
  specRevision: 1,
  actions: {},
  bundle: {
    assetRef: 'local',
    sha256: 'x'.repeat(64),
    sizeBytes: BUNDLE.length,
    shellVersion: 1,
  },
} as never;

function liveCharts(): number {
  return Object.keys(Chart.instances).length;
}

function run(state: Record<string, unknown>) {
  return runShellFixture({
    window,
    bundleSource: BUNDLE,
    spec: SPEC,
    state: state as never,
    chart: Chart,
  });
}

test('repeated state updates reuse one chart instance and one canvas', () => {
  const before = liveCharts();
  const fixture = run({ labels: ['a', 'b'], values: [1, 2] });

  const canvas = fixture.root.querySelector('canvas');
  expect(canvas).toBeTruthy();
  expect(liveCharts()).toBe(before + 1);

  for (let i = 0; i < 30; i++) {
    fixture.sendState({ labels: ['a', 'b'], values: [i, i + 1] });
  }

  expect(fixture.errors()).toHaveLength(0);
  expect(liveCharts()).toBe(before + 1);
  expect(fixture.root.querySelectorAll('canvas')).toHaveLength(1);
  expect(fixture.root.querySelector('canvas')).toBe(canvas);

  // and the instance is holding the newest data, not the first render's
  const live = Object.values(Chart.instances);
  expect(live[live.length - 1].data.datasets[0].data).toEqual([29, 30]);

  // dropping the chart from the tree frees it
  fixture.sendState({ hide: true });
  expect(fixture.root.querySelector('canvas')).toBeNull();
  expect(liveCharts()).toBe(before);
});

test('the chart container carries no pixel dimensions', () => {
  const fixture = run({ labels: ['a'], values: [1] });
  const canvas = fixture.root.querySelector('canvas') as HTMLCanvasElement;

  expect(canvas.parentElement?.className).toBe('tsh-chart');
  // Chart.js owns the backing store from here; the bundle never named a size
  expect(fixture.html()).not.toContain('width="560"');
  expect(canvas.parentElement?.getAttribute('style')).toBeNull();

  fixture.sendState({ hide: true });
  expect(liveCharts()).toBe(0);
});
