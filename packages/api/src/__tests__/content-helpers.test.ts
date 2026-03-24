import { expect, test } from 'vitest';

import {
  appendChartToPostBlob,
  appendToPostBlob,
  parsePostBlob,
} from '../lib/content-helpers';

test('appendChartToPostBlob + parsePostBlob round-trips chart metadata', () => {
  const blob = appendChartToPostBlob(undefined, {
    chartType: 'bar',
    title: 'Revenue',
    series: [
      { label: 'Q1', values: [10, 20, 30], color: '#ff0000' },
      { label: 'Q2', values: [15, 25, 35] },
    ],
    xLabels: ['Jan', 'Feb', 'Mar'],
    yLabel: 'USD',
    height: 300,
  });

  expect(parsePostBlob(blob)).toEqual([
    {
      type: 'chart',
      version: 1,
      chartType: 'bar',
      title: 'Revenue',
      series: [
        { label: 'Q1', values: [10, 20, 30], color: '#ff0000' },
        { label: 'Q2', values: [15, 25, 35] },
      ],
      xLabels: ['Jan', 'Feb', 'Mar'],
      yLabel: 'USD',
      height: 300,
    },
  ]);
});

test('chart with missing optional fields round-trips correctly', () => {
  const blob = appendChartToPostBlob(undefined, {
    chartType: 'sparkline',
    series: [{ label: 'data', values: [1, 2, 3] }],
  });

  const parsed = parsePostBlob(blob);
  expect(parsed).toEqual([
    {
      type: 'chart',
      version: 1,
      chartType: 'sparkline',
      series: [{ label: 'data', values: [1, 2, 3] }],
    },
  ]);
});

test('malformed chart entry degrades to unknown', () => {
  const blob = JSON.stringify([{ type: 'chart', version: 99 }]);
  const parsed = parsePostBlob(blob);
  expect(parsed).toEqual([{ type: 'unknown' }]);
});

test('appendChartToPostBlob appends to existing blob', () => {
  let blob = appendToPostBlob(undefined, {
    type: 'file',
    version: 1,
    fileUri: 'https://example.com/file.pdf',
    size: 100,
  });

  blob = appendChartToPostBlob(blob, {
    chartType: 'line',
    series: [{ label: 'trend', values: [5, 10, 15] }],
  });

  const parsed = parsePostBlob(blob);
  expect(parsed).toHaveLength(2);
  expect(parsed[0]).toMatchObject({ type: 'file' });
  expect(parsed[1]).toMatchObject({ type: 'chart', chartType: 'line' });
});
