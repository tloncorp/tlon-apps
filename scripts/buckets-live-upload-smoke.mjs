#!/usr/bin/env node

import fs from 'node:fs/promises';

const credentialsPath =
  process.env.BUCKETS_SHIP_CREDENTIALS ?? '/Users/williamarzt/Desktop/buckets.md';
const memexBaseUrl = process.env.MEMEX_BASE_URL ?? 'https://memex.tlon.network';

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

// A valid 1x1 transparent PNG. Keeping the payload tiny makes this safe to run
// against a real hosted-user bucket while still proving byte integrity.
const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const shipName = ship.slice(1);
const filename = `${shipName}/buckets-canary-${Date.now()}.png`;
const grant = await fetch(`${memexBaseUrl}/v1/${shipName}/upload`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token,
    contentLength: bytes.length,
    contentType: 'image/png',
    fileName: filename,
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

const download = await fetch(grantBody.filePath);
if (!download.ok) {
  throw new Error(`Uploaded object was not readable (${download.status})`);
}
const downloaded = Buffer.from(await download.arrayBuffer());
if (!downloaded.equals(bytes)) {
  throw new Error('Downloaded bytes did not match the uploaded file');
}

console.log(
  JSON.stringify(
    {
      ship,
      memexGrantStatus: grant.status,
      uploadStatus: upload.status,
      downloadStatus: download.status,
      byteCount: bytes.length,
      bytesMatch: true,
      objectUrl: grantBody.filePath,
    },
    null,
    2
  )
);
