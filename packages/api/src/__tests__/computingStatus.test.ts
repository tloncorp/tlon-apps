import { describe, expect, test } from 'vitest';

import {
  COMPUTING_STATUS_PROTOCOL,
  createComputingStatus,
  formatComputingToolCallLabel,
  getComputingStatusText,
  parseComputingStatus,
  serializeComputingStatus,
} from '../client/computingStatus';

describe('computingStatus', () => {
  test('formats known and unknown tool labels', () => {
    expect(formatComputingToolCallLabel('web_fetch')).toBe('Checking the web');
    expect(formatComputingToolCallLabel('custom_tool')).toBe('Using custom tool');
    expect(formatComputingToolCallLabel()).toBe('Using a tool');
  });

  test('creates a normalized computing status payload', () => {
    expect(
      createComputingStatus({
        thinking: true,
        toolCalls: [
          { toolName: 'web_fetch' },
          { toolName: 'exec', label: 'Shelling out' },
          { toolName: 'web_fetch', label: 'ignored duplicate' },
          { toolName: '' },
        ],
      })
    ).toStrictEqual({
      protocol: COMPUTING_STATUS_PROTOCOL,
      thinking: true,
      toolCalls: [
        { toolName: 'web_fetch', label: 'Checking the web' },
        { toolName: 'exec', label: 'Shelling out' },
      ],
    });
  });

  test('serializes and parses the payload round-trip', () => {
    const blob = serializeComputingStatus({
      thinking: true,
      toolCalls: [{ toolName: 'read' }],
    });

    expect(parseComputingStatus(blob)).toStrictEqual({
      protocol: COMPUTING_STATUS_PROTOCOL,
      thinking: true,
      toolCalls: [{ toolName: 'read', label: 'Reading files' }],
    });
  });

  test('rejects malformed or unrelated blobs', () => {
    expect(parseComputingStatus(null)).toBeNull();
    expect(parseComputingStatus('not json')).toBeNull();
    expect(
      parseComputingStatus(
        JSON.stringify({
          protocol: 'something-else',
          thinking: true,
          toolCalls: [],
        })
      )
    ).toBeNull();
  });

  test('derives indicator text from the current tool state', () => {
    expect(
      getComputingStatusText(
        createComputingStatus({
          thinking: true,
          toolCalls: [],
        })
      )
    ).toBe('Thinking...');

    expect(
      getComputingStatusText(
        createComputingStatus({
          thinking: true,
          toolCalls: [{ toolName: 'web_fetch' }],
        })
      )
    ).toBe('Checking the web');

    expect(
      getComputingStatusText(
        createComputingStatus({
          thinking: true,
          toolCalls: [{ toolName: 'web_fetch' }, { toolName: 'read' }],
        })
      )
    ).toBe('Using tools...');
  });
});
