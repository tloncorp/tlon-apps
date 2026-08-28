import { render } from 'preact';
import { expect, test } from 'vitest';

import { ChartData, createChart, createPrimitiveKit } from './index';

/**
 * The Chart primitive is the only stateful thing in the kit, so its whole
 * risk is lifecycle: `render(state)` is pure and re-runs on every update,
 * and a naive implementation builds a new Chart.js instance each time.
 * These tests drive it with a stub constructor that counts what a real one
 * would have allocated.
 */

interface StubConfig {
  type: string;
  data: unknown;
  options: Record<string, unknown>;
}

function stubChart() {
  const live: StubInstance[] = [];
  const constructed: StubConfig[] = [];
  const canvases: HTMLCanvasElement[] = [];
  let updates = 0;

  class StubInstance {
    data: unknown;
    options: Record<string, unknown>;
    destroyed = false;

    constructor(
      public canvas: HTMLCanvasElement,
      config: StubConfig
    ) {
      this.data = config.data;
      this.options = config.options;
      constructed.push(config);
      canvases.push(canvas);
      live.push(this);
    }

    update() {
      updates += 1;
    }

    destroy() {
      this.destroyed = true;
      const index = live.indexOf(this);
      if (index >= 0) {
        live.splice(index, 1);
      }
    }
  }

  const Ctor = StubInstance as unknown as {
    defaults?: Record<string, unknown>;
  };
  Ctor.defaults = { color: undefined, borderColor: undefined, font: {} };

  return {
    Ctor,
    live,
    constructed,
    canvases,
    updates: () => updates,
  };
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

const DATA: ChartData = {
  labels: ['a', 'b'],
  datasets: [{ label: 'one', data: [1, 2] }],
};

test('renders an aspect box with a canvas and no pixel dimensions', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  const el = mount();
  render(<Chart type="bar" data={DATA} label="responses" />, el);

  const box = el.querySelector('.tsh-chart');
  expect(box).toBeTruthy();
  const canvas = el.querySelector('canvas')!;
  expect(canvas.parentElement).toBe(box);
  // the defect this primitive exists to remove: bundles sizing the canvas
  expect(canvas.getAttribute('width')).toBeNull();
  expect(canvas.getAttribute('height')).toBeNull();
  expect(canvas.getAttribute('aria-label')).toBe('responses');
});

test('the primitive owns sizing: options cannot opt back into a fixed canvas', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  render(
    <Chart
      type="bar"
      data={DATA}
      options={{ responsive: false, maintainAspectRatio: true, animation: {} }}
    />,
    mount()
  );

  const options = stub.constructed[0].options;
  expect(options.responsive).toBe(true);
  expect(options.maintainAspectRatio).toBe(false);
  // non-sizing options still belong to the caller
  expect(options.animation).toEqual({});
});

test('re-renders update the chart in place; the canvas node is stable', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  const el = mount();

  render(<Chart type="bar" data={DATA} />, el);
  const firstCanvas = el.querySelector('canvas');

  for (let i = 0; i < 25; i++) {
    render(
      <Chart
        type="bar"
        data={{ labels: ['a', 'b'], datasets: [{ data: [i, i + 1] }] }}
      />,
      el
    );
  }

  expect(stub.constructed).toHaveLength(1);
  expect(stub.updates()).toBe(25);
  expect(stub.live).toHaveLength(1);
  expect(el.querySelector('canvas')).toBe(firstCanvas);
  expect(el.querySelectorAll('canvas')).toHaveLength(1);
  // the instance sees the latest data, not the data it was built with
  const data = stub.live[0].data as ChartData;
  expect(data.datasets?.[0].data).toEqual([24, 25]);
});

test('unmounting destroys the instance', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  const el = mount();

  render(<Chart type="line" data={DATA} />, el);
  expect(stub.live).toHaveLength(1);

  render(<div />, el);
  expect(stub.live).toHaveLength(0);
  expect(stub.constructed).toHaveLength(1);
});

test('a chart type change rebuilds rather than leaking the old instance', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  const el = mount();

  render(<Chart type="bar" data={DATA} />, el);
  render(<Chart type="line" data={DATA} />, el);

  expect(stub.constructed.map((config) => config.type)).toEqual([
    'bar',
    'line',
  ]);
  expect(stub.live).toHaveLength(1);
});

test('datasets without colors get the token palette; explicit colors win', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  const style = document.createElement('style');
  // token VALUES here are deliberately named colors: the style checker
  // keeps hex/rgb literals out of shell source, tests included
  style.textContent =
    ':root { --color-positive-text: teal; --color-negative-text: olive; }';
  document.head.appendChild(style);

  render(
    <Chart
      type="line"
      data={{
        labels: ['a'],
        datasets: [{ label: 'auto' }, { label: 'own', borderColor: 'magenta' }],
      }}
    />,
    mount()
  );

  const data = stub.constructed[0].data as ChartData;
  expect(data.datasets?.[0].borderColor).toBe('teal');
  expect(data.datasets?.[0].backgroundColor).toBe('teal');
  expect(data.datasets?.[1].borderColor).toBe('magenta');
  expect(data.datasets?.[1].backgroundColor).toBeUndefined();
  style.remove();
});

test('named sizes map to modifier classes, never inline dimensions', () => {
  const stub = stubChart();
  const Chart = createChart(stub.Ctor);
  const el = mount();

  render(<Chart type="bar" data={DATA} size="compact" />, el);
  expect(el.querySelector('.tsh-chart--compact')).toBeTruthy();

  render(<Chart type="bar" data={DATA} size="tall" />, el);
  expect(el.querySelector('.tsh-chart--tall')).toBeTruthy();

  render(<Chart type="bar" data={DATA} size="default" />, el);
  const box = el.querySelector('.tsh-chart') as HTMLElement;
  expect(box.className).toBe('tsh-chart');
  expect(box.getAttribute('style')).toBeNull();
});

test('a chart-free shell degrades to a labeled empty state', () => {
  const kit = createPrimitiveKit(undefined);
  const el = mount();
  render(<kit.Chart type="bar" data={DATA} />, el);

  expect(el.querySelector('canvas')).toBeNull();
  expect(el.textContent).toContain('Chart.js is not available');
});
