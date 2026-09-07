#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, 'apps/tlon-web');
const require = createRequire(resolve(web, 'package.json'));
const { request } = require('@playwright/test');
const manifest = JSON.parse(
  readFileSync(resolve(web, 'e2e/shipManifest.json'), 'utf8')
);

// Authenticate only the suite's isolated local fake ships. Their normal HTML
// login may redirect to an unavailable root app; the scroller tests explicitly
// open /apps/groups/ and require its real Home UI before any scenario runs.
for (const [identity, port] of [
  ['~zod', '35453'],
  ['~ten', '38473'],
]) {
  const ship = manifest[identity];
  const url = new URL(ship.url);
  if (
    ship.ship !== identity.slice(1) ||
    url.protocol !== 'http:' ||
    url.hostname !== 'localhost' ||
    url.port !== port ||
    ship.authFile !== `e2e/.auth/${ship.ship}.json`
  )
    throw new Error(`Refusing non-fixture authentication for ${identity}`);
  const context = await request.newContext();
  try {
    const login = await context.post(`${url.origin}/~/login`, {
      form: { password: ship.code },
      maxRedirects: 0,
      timeout: 10_000,
    });
    if (![200, 303].includes(login.status()))
      throw new Error(`${identity} login failed: ${login.status()}`);
    const healthUrl = `${url.origin}/~/scry/presence/v1/init.json`;
    const health = await context.get(healthUrl, {
      maxRedirects: 0,
      timeout: 10_000,
    });
    const body = await health.json();
    const state = await context.storageState();
    if (
      health.status() !== 200 ||
      health.url() !== healthUrl ||
      !body ||
      typeof body.init !== 'object' ||
      body.init === null ||
      Array.isArray(body.init) ||
      !state.cookies.some(
        (cookie) =>
          cookie.name === `urbauth-${identity}` &&
          cookie.domain === 'localhost' &&
          cookie.path === '/' &&
          cookie.value
      )
    )
      throw new Error(`${identity} authenticated readiness failed`);
    const path = resolve(web, ship.authFile);
    mkdirSync(dirname(path), { recursive: true });
    await context.storageState({ path });
    console.log(
      JSON.stringify({
        ship: identity,
        login: login.status(),
        authenticatedPresence: health.status(),
        authFile: ship.authFile,
      })
    );
  } finally {
    await context.dispose();
  }
}
