#!/usr/bin/env node
import { createInterface } from 'node:readline';

const sessionId = 'tlon-acp-demo';
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

lines.on('line', (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    send({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
    return;
  }

  switch (request.method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: {
            name: 'tlon-acp-demo',
            title: 'Tlon ACP Demo Agent',
            version: '0.0.1',
          },
          authMethods: [],
        },
      });
      break;
    case 'session/new':
      send({
        jsonrpc: '2.0',
        id: request.id,
        result: { sessionId },
      });
      break;
    case 'session/prompt': {
      const text =
        request.params?.prompt
          ?.filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join(' ') || '(empty prompt)';
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'tlon-acp-demo-message',
            content: {
              type: 'text',
              text: `The ACP bridge received: ${text}`,
            },
          },
        },
      });
      send({
        jsonrpc: '2.0',
        id: request.id,
        result: { stopReason: 'end_turn' },
      });
      break;
    }
    case 'session/cancel':
      break;
    default:
      if (request.id !== undefined) {
        send({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: 'Method not found' },
        });
      }
  }
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
