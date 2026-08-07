#!/usr/bin/env node

import fs from 'node:fs/promises';

const credentialsPath =
  process.env.BUCKETS_SHIP_CREDENTIALS ?? '/Users/williamarzt/Desktop/buckets.md';
const memexBaseUrl = process.env.MEMEX_BASE_URL ?? 'https://memex.tlon.network';
const bucketName = process.env.BUCKETS_CANARY_NAME ?? 'live-canary';
const groupName = process.env.BUCKETS_CANARY_GROUP ?? 'home-group';

const source = await fs.readFile(credentialsPath, 'utf8');
const shipUrl = source.match(/https?:\/\/[^\s)]+/)?.[0]?.replace(/\/$/, '');
const ship =
  source.match(/~[a-z]+(?:-[a-z]+)+/)?.[0] ??
  (shipUrl ? `~${new URL(shipUrl).hostname.split('.')[0]}` : undefined);
const accessCode =
  source.match(/\b[a-z]{6}(?:-[a-z]{6}){3}\b/)?.[0] ?? undefined;

if (!shipUrl || !ship || !accessCode) {
  throw new Error('Could not parse ship URL, ship name, and access code');
}

const login = await fetch(`${shipUrl}/~/login`, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ password: accessCode }),
});
const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
if (!login.ok || !cookie) {
  throw new Error(`Ship login failed (${login.status})`);
}

const headers = {
  'Content-Type': 'application/json',
  Cookie: cookie,
};

async function airlockPoke(json) {
  const channelId = `${Math.floor(Date.now() / 1000)}-${crypto.randomUUID().slice(0, 8)}`;
  const channelUrl = `${shipUrl}/~/channel/${channelId}`;
  const request = {
    id: 1,
    action: 'poke',
    ship: ship.slice(1),
    app: 'buckets',
    mark: 'buckets-action-1',
    json,
  };
  const poke = await fetch(channelUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify([request]),
  });
  if (!poke.ok) {
    throw new Error(`Buckets poke HTTP request failed (${poke.status})`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const stream = await fetch(channelUrl, {
      headers: { ...headers, Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!stream.ok || !stream.body) {
      throw new Error(`Airlock response stream failed (${stream.status})`);
    }
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (line.startsWith('data:')) {
          const event = JSON.parse(line.slice(5).trim());
          if (event.response === 'poke' && event.id === 1) {
            if (event.err) {
              throw new Error(`Buckets poke failed: ${event.err}`);
            }
            return;
          }
        }
        newline = buffer.indexOf('\n');
      }
    }
    throw new Error('Airlock closed before the Buckets poke response arrived');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function snapshots() {
  const response = await fetch(
    `${shipUrl}/~/scry/buckets/v1/buckets.json`,
    { headers: { Cookie: cookie } }
  );
  if (!response.ok) {
    const body = (await response.text()).slice(0, 2_000);
    const nounResponse = await fetch(
      `${shipUrl}/~/scry/buckets/v1/buckets.noun`,
      { headers: { Cookie: cookie } }
    );
    throw new Error(
      `Buckets snapshot scry failed (${response.status}); noun=${nounResponse.status} ` +
      `${nounResponse.headers.get('content-type') ?? 'unknown'}: ${body}`
    );
  }
  return response.json();
}

const flag = { host: ship, name: bucketName };
let allSnapshots = await snapshots();
let snapshot = allSnapshots.find(
  (item) => item.flag?.host === ship && item.flag?.name === bucketName
);
if (!snapshot) {
  await airlockPoke({
    type: 'create',
    name: bucketName,
    title: 'Live Canary',
    group: { host: ship, name: groupName },
    readers: [],
  });
  allSnapshots = await snapshots();
  snapshot = allSnapshots.find(
    (item) => item.flag?.host === ship && item.flag?.name === bucketName
  );
}
if (!snapshot) {
  throw new Error('Buckets agent accepted create but returned no snapshot');
}

const genuine = await fetch(`${shipUrl}/~/scry/genuine/secret.json`, {
  headers: { Cookie: cookie },
});
if (!genuine.ok) {
  throw new Error(`Could not read the ship's Memex token (${genuine.status})`);
}
const token = await genuine.json();
if (typeof token !== 'string' || token.length === 0) {
  throw new Error('The ship returned an invalid Memex token');
}

const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const shipName = ship.slice(1);
const canaryId = Date.now();
const displayName = `buckets-live-${canaryId}.png`;
const fileKey = `${shipName}/${displayName}`;
const capability = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

await airlockPoke({
  type: 'begin-upload',
  flag,
  parentId: null,
  name: displayName,
  mime: 'image/png',
  size: bytes.length,
  checksum: null,
  capability,
});

const brokerProbe = await fetch(
  `${shipUrl}/~/scry/buckets/v1/broker/upload/${capability}/probe-reservation.json`,
  { headers: { Cookie: cookie } }
);
if (!brokerProbe.ok) {
  throw new Error(`Buckets private broker scry failed (${brokerProbe.status})`);
}
const brokerProbeBody = await brokerProbe.json();
if (brokerProbeBody?.result !== 'denied') {
  throw new Error(
    `Buckets private broker returned an unexpected pre-authorization verdict: ${JSON.stringify(brokerProbeBody)}`
  );
}

snapshot = (await snapshots()).find(
  (item) => item.flag?.host === ship && item.flag?.name === bucketName
);
const pendingEntry = snapshot?.state?.entries?.find(
  (entry) => entry.name === displayName && entry.kind === 'file'
);
const session = snapshot?.state?.sessions?.find(
  (candidate) => candidate.fileId === pendingEntry?.id
);
if (!pendingEntry || !session) {
  throw new Error('Buckets begin-upload did not produce a pending file session');
}

const grant = await fetch(`${memexBaseUrl}/v1/${shipName}/upload`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token,
    contentLength: bytes.length,
    contentType: 'image/png',
    fileName: fileKey,
  }),
});
if (!grant.ok) {
  throw new Error(`Memex upload grant failed (${grant.status})`);
}
const grantBody = await grant.json();
if (!grantBody?.url || !grantBody?.filePath) {
  throw new Error('Memex returned an invalid upload grant');
}

const upload = await fetch(grantBody.url, {
  method: 'PUT',
  headers: {
    'Cache-Control': 'public, max-age=3600',
    'Content-Type': 'image/png',
  },
  body: bytes,
});
if (!upload.ok) {
  throw new Error(`Signed object upload failed (${upload.status})`);
}

await airlockPoke({
  type: 'finish-upload',
  flag,
  sessionId: session.id,
  objectUrl: grantBody.filePath,
});

snapshot = (await snapshots()).find(
  (item) => item.flag?.host === ship && item.flag?.name === bucketName
);
const completed = snapshot?.state?.entries?.find(
  (entry) => entry.id === pendingEntry.id
);
if (
  completed?.file?.status !== 'ready' ||
  completed.file.objectUrl !== grantBody.filePath
) {
  throw new Error('Gall did not finalize the uploaded object in the manifest');
}

const download = await fetch(grantBody.filePath);
const downloaded = download.ok
  ? Buffer.from(await download.arrayBuffer())
  : Buffer.alloc(0);
if (!download.ok || !downloaded.equals(bytes)) {
  throw new Error('The finalized manifest object did not download intact');
}

console.log(
  JSON.stringify(
    {
      ship,
      group: `${ship}/${groupName}`,
      bucket: `${ship}/${bucketName}`,
      gallSessionId: session.id,
      gallObjectId: pendingEntry.id,
      manifestRevision: snapshot.state.revision,
      objectUrl: grantBody.filePath,
      memexGrantStatus: grant.status,
      uploadStatus: upload.status,
      downloadStatus: download.status,
      byteCount: bytes.length,
      bytesMatch: true,
      gallStatus: completed.file.status,
      brokerProbeStatus: brokerProbe.status,
      brokerProbeResult: brokerProbeBody.result,
    },
    null,
    2
  )
);
