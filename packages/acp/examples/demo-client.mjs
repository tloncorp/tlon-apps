#!/usr/bin/env node
import { Urbit } from '@tloncorp/api';

const { URBIT_URL, URBIT_SHIP, URBIT_CODE } = process.env;
const connection = process.env.ACP_CONNECTION ?? 'demo';
const prompt =
  process.env.ACP_PROMPT ?? 'hello from the ship-native ACP client';
if (!URBIT_URL || !URBIT_SHIP || !URBIT_CODE) {
  throw new Error('URBIT_URL, URBIT_SHIP, and URBIT_CODE are required');
}

const ship = URBIT_SHIP.startsWith('~') ? URBIT_SHIP : `~${URBIT_SHIP}`;
const urbit = await Urbit.authenticate({
  ship,
  url: URBIT_URL,
  code: URBIT_CODE,
});
const pending = new Map();
let nextRequestId = Date.now();
let responseChain = Promise.resolve();

await poke({ open: { connection } });
const subscription = await urbit.subscribe({
  app: 'acp',
  path: `/v1/${connection}/client`,
  event: (update) => {
    if (!Array.isArray(update?.messages)) return;
    responseChain = responseChain.then(async () => {
      for (const message of update.messages) {
        const frame = JSON.parse(message.payload);
        console.log(JSON.stringify(frame));
        await poke({
          ack: {
            connection,
            target: 'client',
            through: message.sequence,
          },
        });
        const waiter = pending.get(frame.id);
        if (waiter) {
          pending.delete(frame.id);
          if (frame.error) {
            waiter.reject(new Error(JSON.stringify(frame.error)));
          } else {
            waiter.resolve(frame.result);
          }
        }
      }
    });
  },
  err: (error) => {
    for (const waiter of pending.values()) {
      waiter.reject(error);
    }
    pending.clear();
  },
});

try {
  await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: 'tlon-acp-demo-client', version: '0.0.1' },
  });
  const session = await request('session/new', {
    cwd: process.cwd(),
    mcpServers: [],
  });
  await request('session/prompt', {
    sessionId: session.sessionId,
    prompt: [{ type: 'text', text: prompt }],
  });
  await responseChain;
} finally {
  await urbit.unsubscribe(subscription);
  await urbit.delete();
}

async function request(method, params) {
  const id = nextRequestId++;
  const response = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 60_000);
    pending.set(id, {
      resolve(value) {
        clearTimeout(timeout);
        resolve(value);
      },
      reject(error) {
        clearTimeout(timeout);
        reject(error);
      },
    });
  });
  await send({ jsonrpc: '2.0', id, method, params });
  return await response;
}

async function send(frame) {
  await poke({
    send: {
      connection,
      target: 'agent',
      payload: JSON.stringify(frame),
    },
  });
}

async function poke(json) {
  await urbit.poke({ app: 'acp', mark: 'acp-action-1', json });
}
