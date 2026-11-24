#!/usr/bin/env node
// Thin Agent Client Protocol stdio adapter for the generic on-ship %acp
// transport. ACP JSON-RPC is implemented by the harness behind the selected
// connection; this process only moves durable frames between stdio and Eyre.

import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

const SHIP_URL = process.env.SHIP_URL || 'http://localhost:8081';
const SHIP_CODE = process.env.SHIP_CODE;
const ACP_CONNECTION = process.env.ACP_CONNECTION || `harness-stdio-${randomUUID()}`;
const POLL_MS = Number(process.env.ACP_POLL_MS || 100);

if (!/^[a-z0-9-]{1,128}$/.test(ACP_CONNECTION)) {
  throw new Error('ACP_CONNECTION must contain 1-128 lowercase letters, digits, or hyphens');
}
if (!SHIP_CODE) {
  throw new Error('SHIP_CODE is required');
}
if (!Number.isFinite(POLL_MS) || POLL_MS < 10) {
  throw new Error('ACP_POLL_MS must be a number of at least 10');
}

let cookie = null;
let shipName = 'zod';
const channelId = `acp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let eventId = 0;
let running = true;

async function login() {
  const res = await fetch(`${SHIP_URL}/~/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `password=${encodeURIComponent(SHIP_CODE)}`,
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);

  const setCookie = res.headers.get('set-cookie') || '';
  cookie = setCookie.split(';')[0];
  const match = cookie.match(/urbauth-~([\w-]+)/);
  if (match) shipName = match[1];
  if (!cookie) throw new Error('login: no cookie');
}

async function poke(action) {
  const body = [
    {
      id: ++eventId,
      action: 'poke',
      ship: shipName,
      app: 'acp',
      mark: 'acp-action-1',
      json: action,
    },
  ];
  const res = await fetch(`${SHIP_URL}/~/channel/${channelId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  if (res.status !== 204 && res.status !== 200) {
    const detail = await res.text().catch(() => '');
    throw new Error(`%acp poke failed: ${res.status}${detail ? ` ${detail}` : ''}`);
  }
}

async function clientQueue() {
  // Eyre supplies Gall's leading %x namespace for HTTP scries.
  const path = `v1/${ACP_CONNECTION}/client`;
  const res = await fetch(`${SHIP_URL}/~/scry/acp/${path}.json`, {
    headers: { cookie },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`%acp scry failed: ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendToAgent(payload) {
  await poke({
    send: {
      connection: ACP_CONNECTION,
      target: 'agent',
      payload,
    },
  });
}

async function acknowledgeClient(through) {
  await poke({
    ack: {
      connection: ACP_CONNECTION,
      target: 'client',
      through,
    },
  });
}

async function pumpClientQueue() {
  let through = 0;

  while (running) {
    const update = await clientQueue();
    if (update === null) {
      await poke({ open: { connection: ACP_CONNECTION } });
      through = 0;
      await sleep(POLL_MS);
      continue;
    }
    const messages = Array.isArray(update?.messages) ? update.messages : [];
    messages.sort((a, b) => Number(a.sequence) - Number(b.sequence));

    for (const message of messages) {
      const sequence = Number(message.sequence);
      if (!Number.isSafeInteger(sequence) || sequence <= through) continue;
      if (typeof message.payload !== 'string') {
        throw new Error(`%acp returned a non-string payload at sequence ${sequence}`);
      }

      // stdout is exclusively ACP NDJSON. Acknowledge only after handing the
      // complete frame to the client-side stream.
      if (!process.stdout.write(`${message.payload}\n`)) {
        await once(process.stdout, 'drain');
      }
      through = sequence;
      await acknowledgeClient(through);
    }

    await sleep(POLL_MS);
  }
}

function parseError() {
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    })}\n`,
  );
}

async function main() {
  await login();

  // Opening is idempotent when the native harness already owns the connection.
  await poke({ open: { connection: ACP_CONNECTION } });

  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let pumpError = null;
  const pump = pumpClientQueue().catch((error) => {
    pumpError = error;
    running = false;
    lines.close();
  });

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        JSON.parse(line);
      } catch {
        parseError();
        continue;
      }
      await sendToAgent(line);
    }
  } finally {
    running = false;
    await pump;
    await poke({
      close: { connection: ACP_CONNECTION, reason: 'stdio client closed' },
    }).catch(() => {});
  }
  if (pumpError) throw pumpError;
}

main().catch((error) => {
  process.stderr.write(`harness-acp fatal: ${error?.stack || error}\n`);
  process.exit(1);
});
