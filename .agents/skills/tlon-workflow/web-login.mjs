#!/usr/bin/env node
// Signs a browser profile in to the dev ship and saves the session, so web
// validation starts in the app instead of on the ship's login page.
//
//   node .agents/skills/tlon-workflow/web-login.mjs --url http://localhost:8900
//
// Prints the path of a Playwright storageState file. Give that to a context
// (`browser.newContext({ storageState })`) and it is already signed in.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function usage(message) {
  console.error(`web-login: ${message}
usage: node .agents/skills/tlon-workflow/web-login.mjs --url <dev server> [options]
  --url <url>      the running web dev server, e.g. http://localhost:8900
  --state <path>   where to write the session (default .evidence/web-auth.json)
  --code <code>    the ship's +code (default: DEFAULT_SHIP_LOGIN_ACCESS_CODE
                   from apps/tlon-mobile/.env.local)
  --timeout <ms>   how long to wait for the ship (default 30000)`);
  process.exit(2);
}

let values;
try {
  ({ values } = parseArgs({
    options: {
      url: { type: 'string' },
      state: { type: 'string' },
      code: { type: 'string' },
      timeout: { type: 'string' },
    },
  }));
} catch (err) {
  usage(err.message.replace(/^Error: /, ''));
}

const url = (values.url ?? '').replace(/\/+$/, '');
if (!url) usage('--url is required');
const statePath = resolve(REPO, values.state ?? '.evidence/web-auth.json');
const timeout = Number(values.timeout ?? 30_000);
if (!Number.isFinite(timeout) || timeout <= 0) usage('--timeout takes milliseconds');

// dotenv semantics: an unquoted value ends at ` #`, a quoted one keeps it.
function envValue(file, key) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const line = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!line) return '';
  const raw = line[1].trim();
  const quoted = raw.match(/^(["'])(.*)\1/);
  return (quoted ? quoted[2] : raw.replace(/\s+#.*$/, '')).trim();
}

const code =
  values.code ||
  process.env.DEFAULT_SHIP_LOGIN_ACCESS_CODE ||
  envValue(join(REPO, 'apps/tlon-mobile/.env.local'), 'DEFAULT_SHIP_LOGIN_ACCESS_CODE');
if (!code) {
  usage(
    'no access code: set DEFAULT_SHIP_LOGIN_ACCESS_CODE in apps/tlon-mobile/.env.local, or pass --code'
  );
}
if (!/^[a-z]{6}(-[a-z]{6}){3}$/.test(code)) {
  usage('the access code is not a ship +code (xxxxxx-xxxxxx-xxxxxx-xxxxxx)');
}

// Playwright belongs to tlon-web, not to this skill, so resolve it from there
// rather than from this file's own directory.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(
    require.resolve('@playwright/test', { paths: [join(REPO, 'apps/tlon-web')] })
  ));
} catch {
  usage('@playwright/test is not installed; run pnpm install');
}

mkdirSync(dirname(statePath), { recursive: true });

const browser = await chromium.launch().catch((err) => {
  usage(
    `chromium will not launch (${err.message.split('\n')[0]}); run pnpm --filter tlon-web exec playwright install chromium`
  );
});
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto(`${url}/~/login`, { timeout, waitUntil: 'domcontentloaded' });
  // A ship offering eauth renders a second form with its own Continue button,
  // so both are scoped to the form that holds the code field.
  const form = page.locator('form:has([name="password"])');
  await form.locator('[name="password"]').fill(code, { timeout });
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/~/login'), { timeout }),
    form.getByRole('button').click(),
  ]);
  const cookies = await context.cookies();
  if (!cookies.some((c) => c.name.startsWith('urbauth-'))) {
    // Safari is not the only way to lose this: any origin the browser does not
    // treat as secure drops the ship's `Secure` cookie.
    throw new Error(
      `signed in but no urbauth cookie was kept, so the app will bounce back to the login page. Serve the dev server over https (SSL=true) if ${url} is not one the browser treats as secure.`
    );
  }
  await context.storageState({ path: statePath });
  console.log(statePath);
} catch (err) {
  console.error(`web-login: ${err.message.split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
