#!/usr/bin/env tsx

/**
 * Remove legacy %expose and %profile pages from Eyre's cache.
 *
 * This is an operator migration for hosted ships. It deliberately uses the
 * supported %dbug API instead of retaining either retired agent in the desk.
 * Run without --apply first; that prints the exact URLs that would be removed.
 *
 *   URBIT_CODE=... pnpm exec tsx scripts/clear-retired-public-pages.ts \
 *     --ship ~zod --url https://zod.example.net --apply
 */

import Urbit from '@urbit/http-api';

type CacheEntry = { url?: unknown };

const usage = `Usage: URBIT_CODE=<code> pnpm exec tsx scripts/clear-retired-public-pages.ts \\
  --ship ~ship --url https://ship.example.net [--apply]

Without --apply, inspect the matching URLs only. --apply clears them through
%dbug's clear-eyre-cache action.`;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const ship = option('--ship');
const url = option('--url')?.replace(/\/$/, '');
const apply = process.argv.includes('--apply');
const code = process.env.URBIT_CODE;

if (!ship || !url || !code || process.argv.includes('--help')) {
  console.error(usage);
  process.exit(process.argv.includes('--help') ? 0 : 1);
}

const cookie = await fetch(`${url}/~/login`, {
  method: 'POST',
  body: `password=${encodeURIComponent(code)}`,
  redirect: 'manual',
}).then((response) => {
  if (!response.ok) {
    throw new Error(`login failed (${response.status})`);
  }
  const value = response.headers.get('set-cookie')?.split(';')[0];
  if (!value) {
    throw new Error(
      'login succeeded without returning an Urbit session cookie'
    );
  }
  return value;
});

const cache = await fetch(`${url}/~debug/eyre/cache.json`, {
  headers: { Cookie: cookie },
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(`could not read Eyre cache (${response.status})`);
  }
  return (await response.json()) as CacheEntry[];
});

const retired = cache
  .map((entry) => entry.url)
  .filter((value): value is string => typeof value === 'string')
  .filter((value) => value === '/profile' || value.startsWith('/profile/'))
  .concat(
    cache
      .map((entry) => entry.url)
      .filter((value): value is string => typeof value === 'string')
      .filter((value) => value === '/expose' || value.startsWith('/expose/'))
  )
  .sort();

if (retired.length === 0) {
  console.log(`${ship}: no cached %expose or %profile pages`);
  process.exit(0);
}

console.log(
  `${ship}: ${apply ? 'clearing' : 'would clear'} ${retired.length} cached page(s)`
);
for (const page of retired) {
  console.log(`  ${page}`);
}

if (!apply) {
  process.exit(0);
}

const api = await Urbit.authenticate({ ship, url, code });
try {
  for (const page of retired) {
    await api.poke({
      app: 'dbug',
      mark: 'json',
      json: { 'clear-eyre-cache': { url: page } },
    });
  }
} finally {
  await api.delete();
}

console.log(`${ship}: cleared ${retired.length} cached page(s)`);
