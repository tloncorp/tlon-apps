import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSandboxSession } from '../../../packages/app/ui/components/SurfaceChannel/sandboxSession';
import {
  SURFACE_SANDBOX_IFRAME_FLAGS,
  buildSandboxDocument,
} from '../../../packages/surface-shell/src/sandbox/document';

/**
 * THE TWO HALVES, FINALLY MEETING.
 *
 * Until this file, each half of the render path was tested against a fake of
 * the other:
 *
 *   - the React host suite (`SurfaceSandboxContainer.test.tsx`) mocks the
 *     shell artifact to `'void 0;'` and hand-dispatches the `ready`
 *     handshake, so no shell ever runs and no real message is ever parsed;
 *   - the shell suite (`sandbox.spec.ts`) drives a hand-rolled iframe that
 *     does no schema validation, no revision cross-check, no permission
 *     re-check and no action-declaration check, posting `init` with a
 *     fabricated one-action spec.
 *
 * Both passed while the composition had a live bug: a bundle throwing before
 * `surface.register` left a blank board forever, which neither half could
 * see — the host's stub shell never throws, and the shell's hand-rolled
 * harness has no host state to leave blank.
 *
 * So this runs the REAL shell artifact, in a REAL browser iframe, driven by
 * the REAL host session layer — `createSandboxSession`, with
 * `ShellToHostMessageSchema` validation and the spec-revision cross-check
 * active. The session is transport-agnostic by construction (`post` is a
 * callback, `handleInbound` takes raw data), so the only thing this file
 * supplies is the wire between node and the page.
 *
 * The halves' own tests stay. This is the composition, not a replacement.
 */

const shellRoot = join(__dirname, '..', '..', '..', 'packages/surface-shell');

function readShell() {
  try {
    return {
      js: readFileSync(join(shellRoot, 'dist/surface-shell.js'), 'utf8'),
      css: readFileSync(join(shellRoot, 'dist/surface-shell.css'), 'utf8'),
    };
  } catch {
    throw new Error(
      'shell artifact missing — run `pnpm build:surface-shell` at the repo root first'
    );
  }
}

function readPollFixture() {
  const dir = join(shellRoot, 'fixtures/poll');
  return {
    bundle: readFileSync(join(dir, 'app.js'), 'utf8'),
    spec: JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8')),
    state: JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')),
  };
}

type Composed = {
  session: ReturnType<typeof createSandboxSession>;
  invokes: string[];
  shellErrors: { phase: string; message: string }[];
  ready: () => boolean;
};

/**
 * Mounts the real shell in a real iframe and wires it to the real session.
 *
 * Frame → node: the page forwards every message from the frame to an exposed
 * binding, which hands it to `session.handleInbound` UNPARSED — so the
 * session's own schema validation is what decides whether it is acceptable,
 * exactly as in production.
 *
 * Node → frame: the session's `post` callback evaluates a `postMessage` into
 * the frame's content window.
 */
async function mountComposed(
  page: import('@playwright/test').Page,
  options: {
    bundleSource: string;
    spec: unknown;
    state: unknown;
    canInvoke?: boolean;
  }
): Promise<Composed> {
  const shell = readShell();
  const invokes: string[] = [];
  const shellErrors: { phase: string; message: string }[] = [];
  let isReady = false;

  const session = createSandboxSession({
    spec: options.spec as never,
    initialState: options.state as never,
    theme: 'light' as never,
    canInvoke: options.canInvoke ?? true,
    now: 0,
    post: (serialized) => {
      void page.evaluate((payload) => {
        document
          .querySelector('iframe')
          ?.contentWindow?.postMessage(payload, '*');
      }, serialized);
    },
    onInvoke: (actionId) => invokes.push(actionId),
    onShellError: (phase, message) => shellErrors.push({ phase, message }),
    onReady: () => {
      isReady = true;
    },
  });

  await page.exposeFunction('__fromSandbox', (raw: unknown) => {
    session.handleInbound(raw);
  });

  await page.setContent(
    '<!doctype html><html><body style="margin:0"></body></html>'
  );
  const doc = buildSandboxDocument({
    shellJs: shell.js,
    shellCss: shell.css,
    bundleSource: options.bundleSource,
  });

  await page.evaluate(
    ({ doc, flags }) => {
      const bridge = (
        window as unknown as { __fromSandbox: (raw: unknown) => void }
      ).__fromSandbox;
      window.addEventListener('message', (event) => {
        const frame = document.querySelector('iframe');
        if (frame && event.source === frame.contentWindow) {
          bridge(event.data);
        }
      });
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', flags);
      iframe.setAttribute('srcdoc', doc);
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    },
    { doc, flags: SURFACE_SANDBOX_IFRAME_FLAGS }
  );

  return { session, invokes, shellErrors, ready: () => isReady };
}

test('the real shell, the real host session: render, invoke, permission', async ({
  page,
}) => {
  const poll = readPollFixture();
  const composed = await mountComposed(page, {
    bundleSource: poll.bundle,
    spec: poll.spec,
    state: poll.state,
  });

  // the handshake completed through the session's schema validation, and the
  // session answered with `init` — nothing was hand-dispatched
  await expect.poll(() => composed.ready()).toBe(true);

  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.tsh-card-title')).toHaveText(
    'What should we get for lunch?'
  );
  await expect(frame.locator('.tsh-stat-value')).toHaveText('1');

  // a state push through the real session re-renders the real shell
  composed.session.updateState({
    ...poll.state,
    votes: { '~zod': 'pizza', '~ten': 'tacos', '~bus': 'pizza' },
  } as never);
  await expect(frame.locator('.tsh-stat-value')).toHaveText('3');

  // a tap produces an invoke that passed schema validation, the revision
  // cross-check, the permission check and the declared-action check
  await frame.locator('.tsh-list-row button').first().click();
  await expect.poll(() => composed.invokes).toEqual(['vote-pizza']);

  // permission off disables live, through the real session
  composed.session.updatePermission(false);
  await expect(frame.locator('.tsh-list-row button').first()).toBeDisabled();
});

test('the revision the shell echoes is the one the session initialized it with', async ({
  page,
}) => {
  const poll = readPollFixture();
  // The session SENDS its spec in `init`, so the shell stamps invokes with
  // whatever revision the host gave it — the two cannot disagree while the
  // frame is the one this session initialized. That is worth asserting
  // compositionally, because it is the premise the host's stale-revision
  // check rests on.
  const bumped = { ...poll.spec, specRevision: poll.spec.specRevision + 5 };
  const composed = await mountComposed(page, {
    bundleSource: poll.bundle,
    spec: bumped,
    state: poll.state,
  });
  await expect.poll(() => composed.ready()).toBe(true);

  const frame = page.frameLocator('iframe');
  await frame.locator('.tsh-list-row button').first().click();
  await expect.poll(() => composed.invokes).toEqual(['vote-pizza']);

  // And the check itself fires on a message that does NOT match. This half
  // is synthetic on purpose: a frame the session initialized can never
  // produce one, so the only way to reach the branch is to hand it a message
  // directly. Labeled rather than dressed up as shell behaviour.
  composed.invokes.length = 0;
  composed.session.handleInbound(
    JSON.stringify({
      type: 'invoke',
      actionId: 'vote-pizza',
      specRevision: bumped.specRevision - 1,
    })
  );
  expect(
    composed.invokes,
    'the host acted on an invoke stamped with a revision it never initialized'
  ).toEqual([]);
});

/**
 * ITEM 12's CONTROL, and the bug this composition exists to have caught: a
 * bundle whose very first line throws.
 */
test('a bundle that throws before register reports init, not blankness', async ({
  page,
}) => {
  const poll = readPollFixture();
  const composed = await mountComposed(page, {
    // a ReferenceError on line one — the model-generated-bad-line case
    bundleSource: 'thisIsNotDefined();\nsurface.register({ render() {} });',
    spec: poll.spec,
    state: poll.state,
  });

  // the shell still handshakes: its own script completed
  await expect.poll(() => composed.ready()).toBe(true);

  // ...and the failure is now REPORTED rather than silent
  await expect
    .poll(() => composed.shellErrors.map((entry) => entry.phase))
    .toContain('init');
  const reported = composed.shellErrors.find((entry) => entry.phase === 'init');
  expect(reported?.message ?? '').not.toBe('');

  // Deliberately NOT asserting the frame is visually blank: the sandbox has
  // an opaque origin, so `contentDocument` is null from here and any such
  // check would read as "blank" whether or not it was — a guard that cannot
  // fail. The report above is the observable fact, and it is the one that
  // was missing.
});
