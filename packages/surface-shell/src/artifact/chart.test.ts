import { Chart, registerables } from 'chart.js';
import { expect, test } from 'vitest';

/**
 * Vendoring smoke test: Chart.js loads and registers in happy-dom, and we
 * document exactly how far rendering gets here. happy-dom has no real
 * canvas 2d context, so an actual draw is expected to be impossible in
 * this environment — the real draw check happens in the webview sessions
 * (out of scope per the session prompt). If happy-dom ever grows canvas
 * support, the assertion below starts exercising the draw path.
 */

test('chart.js loads and registers its controllers', () => {
  expect(typeof Chart).toBe('function');
  expect(registerables.length).toBeGreaterThan(0);
  Chart.register(...registerables);
  expect(Chart.registry.controllers.get('bar')).toBeTruthy();
  expect(Chart.registry.controllers.get('line')).toBeTruthy();
});

test('chart construction in happy-dom: draws, or fails cleanly without a 2d context', () => {
  Chart.register(...registerables);
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const context = canvas.getContext('2d');

  if (context === null) {
    // documented limitation: happy-dom has no canvas 2d context. Chart.js
    // degrades cleanly — it logs "can't acquire context" and constructs an
    // inert chart (ctx null) instead of throwing, so a chart-using app
    // can't crash the harness here either. Real draw verification belongs
    // to the webview sessions.
    const chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: ['a'], datasets: [{ data: [1] }] },
    });
    expect(chart.ctx).toBeNull();
    chart.destroy();
    return;
  }

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: ['a', 'b'], datasets: [{ data: [1, 2] }] },
    options: { animation: false, responsive: false },
  });
  expect(chart.data.datasets[0].data).toEqual([1, 2]);
  chart.destroy();
});
