#!/usr/bin/env node
import fs from 'node:fs/promises';

const credentialsPath =
  process.env.BUCKETS_SHIP_CREDENTIALS ??
  '/Users/williamarzt/Desktop/buckets.md';
const source = await fs.readFile(credentialsPath, 'utf8');
const shipUrl = source.match(/https?:\/\/[^\s)]+/)?.[0]?.replace(/\/$/, '');
const accessCode =
  source.match(/\b[a-z]{6}(?:-[a-z]{6}){3}\b/)?.[0] ?? undefined;

if (!shipUrl || !accessCode) {
  throw new Error('Could not parse the hosted ship URL and access code');
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

const response = await fetch(`${shipUrl}/~/scry/buckets/v1/buckets.json`, {
  headers: { Cookie: cookie },
});
if (!response.ok) {
  throw new Error(`Buckets snapshot scry failed (${response.status})`);
}

const snapshots = await response.json();
console.log(
  JSON.stringify(
    snapshots.map((snapshot) => ({
      flag: snapshot.flag,
      title: snapshot.state?.title,
      readers: snapshot.state?.readers ?? [],
      writers: snapshot.state?.writers ?? null,
      revision: snapshot.state?.revision,
      entryCount: snapshot.state?.entries?.length ?? 0,
    })),
    null,
    2
  )
);
