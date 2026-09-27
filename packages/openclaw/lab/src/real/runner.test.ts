import { describe, expect, it } from 'vitest';

import { ownerMessageLogEvent } from './runner.js';

// Lines as OpenClaw 2026.7.1 logs them in the sandbox.
const RECEIVED =
  '2026-09-27T01:39:28.005+00:00 [diagnostic] message received: channel=tlon chatId=tlon:~zod messageId=~ten/170.141.184.508.180.568.248.168.199.090.233.187.237 sessionId=unknown sessionKey=agent:dev:tlon:direct:~ten source=dispatchInboundMessage';
const PROCESSED =
  '2026-09-27T01:40:16.096+00:00 [diagnostic] message processed: channel=tlon chatId=tlon:~zod messageId=~ten/170.141.184.508.180.568.248.168.199.090.233.187.237 sessionId=e20a3561-5536-464e-872c-46db8ead71f6 sessionKey=agent:dev:tlon:direct:~ten outcome=completed duration=48054ms';

describe('ownerMessageLogEvent', () => {
  const id = '~ten/170.141.184.508.180.568.248.168.199.090.233.187.237';

  it('reads when OpenClaw receives and finishes an owner message', () => {
    expect(ownerMessageLogEvent(RECEIVED, '~ten')).toEqual({
      kind: 'received',
      id,
    });
    expect(ownerMessageLogEvent(PROCESSED, '~ten')).toEqual({
      kind: 'processed',
      id,
    });
  });

  it('reads the end of a plugin turn', () => {
    expect(
      ownerMessageLogEvent(
        '2026-09-27T01:40:21.188+00:00 [tlon] tlon.agent_turn.terminal',
        '~ten'
      )
    ).toEqual({ kind: 'terminal' });
  });

  it('ignores other senders and other lines', () => {
    expect(
      ownerMessageLogEvent(RECEIVED.replaceAll('~ten/', '~mug/'), '~ten')
    ).toBeUndefined();
    expect(
      ownerMessageLogEvent(
        '2026-09-27T01:39:28.040+00:00 [diagnostic] message queued: sessionId=e20a sessionKey=agent:dev:tlon:direct:~ten queueDepth=1',
        '~ten'
      )
    ).toBeUndefined();
  });
});
