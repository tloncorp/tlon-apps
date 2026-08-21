import { describe, expect, it } from 'vitest';

import {
  buildTlonRequestInputEventData,
  createTlonRequestInputTool,
  readTlonRequestInputQuestion,
} from './tlon-request-input.js';

describe('Tlon requester-input tool', () => {
  it('builds one explicit waiting event without interpreting reply prose', () => {
    expect(
      buildTlonRequestInputEventData(
        { question: ' Which group name should I use? ' },
        'call-1'
      )
    ).toEqual({
      phase: 'requested',
      status: 'waiting',
      itemId: 'request-input:call-1',
      title: 'Which group name should I use?',
      source: 'tlon_request_input',
      toolCallId: 'call-1',
    });
    expect(buildTlonRequestInputEventData({ question: '   ' })).toBeNull();
    expect(readTlonRequestInputQuestion({ question: 42 })).toBeNull();
  });

  it('acknowledges the marker without performing the blocked work', async () => {
    const tool = createTlonRequestInputTool();
    const result = await tool.execute(
      'call-1',
      { question: 'Which group name should I use?' },
      undefined
    );

    expect(result.details).toEqual({ waitingForRequester: true });
    expect(result.content[0]?.text).toContain(
      'stop until the requester answers'
    );
  });
});
