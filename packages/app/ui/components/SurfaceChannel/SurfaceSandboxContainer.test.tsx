// @vitest-environment jsdom
import type { JsonObject, SurfaceSpec } from '@tloncorp/api';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { SurfaceSandboxContainer } from './SurfaceSandboxContainer';

/**
 * The F2 acceptance criterion end-to-end through the REAL container: an
 * admin bumps the spec revision without changing the bundle, and the
 * dashboard keeps working — a new frame, a new `init`, live state, and
 * invokes that carry the NEW revision to the writer.
 *
 * The container is the piece that owns the React key, so asserting the
 * behaviour through a stand-in would leave exactly the wiring that
 * matters untested.
 */

type InvokeArgs = { channelId: string; spec: SurfaceSpec; actionId: string };

const sendSurfaceInvoke = vi.fn((_args: InvokeArgs) => Promise.resolve());

// `vi.mock` is hoisted above the imports, so the container below picks up
// these stubs rather than the real store / theme / shell artifact
vi.mock('@tloncorp/shared', () => ({
  sendSurfaceInvoke: (args: InvokeArgs) => sendSurfaceInvoke(args),
}));
vi.mock('@tloncorp/surface-shell/artifact-strings', () => ({
  shellArtifactJs: 'void 0;',
  shellArtifactCss: '',
  shellArtifactVersion: 1,
}));
vi.mock('tamagui', () => ({ useThemeName: () => 'light' }));
vi.mock('../../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~zod',
}));
vi.mock('../../utils/channelUtils', () => ({ useCanWrite: () => true }));

function makeSpec(specRevision: number): SurfaceSpec {
  return {
    version: 1,
    surfaceId: 'srf-1',
    specRevision,
    bundle: {
      assetRef: 'https://x/b',
      sha256: 'a'.repeat(64),
      size: 64,
      shellVersion: 1,
    },
    initialState: {},
    actions: { vote: { ops: [] } },
  } as unknown as SurfaceSpec;
}

const CHANNEL = { id: 'chan-1' } as never;
const BUNDLE = 'void 0;';
const READY = { type: 'ready', shellVersion: 1, protocolVersion: 1 };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = window.document.createElement('div');
  window.document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
  sendSurfaceInvoke.mockClear();
});

async function renderSpec(spec: SurfaceSpec, state: JsonObject) {
  await act(async () => {
    root.render(
      <SurfaceSandboxContainer
        channel={CHANNEL}
        spec={spec}
        state={state}
        bundleSource={BUNDLE}
      />
    );
  });
}

function frame() {
  return container.querySelector('iframe');
}

function watch(iframe: HTMLIFrameElement): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = [];
  vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(((
    serialized: unknown
  ) => {
    sent.push(JSON.parse(String(serialized)));
  }) as never);
  return sent;
}

async function fromFrame(iframe: HTMLIFrameElement, message: unknown) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify(message),
        source: iframe.contentWindow as Window,
      })
    );
  });
}

test('a spec revision bump on an unchanged bundle keeps the dashboard live', async () => {
  const v1 = makeSpec(1);
  const v2 = makeSpec(2);

  await renderSpec(v1, { n: 1 });
  const first = frame()!;
  const firstSent = watch(first);
  await fromFrame(first, READY);
  expect(firstSent).toEqual([
    expect.objectContaining({ type: 'init', spec: v1, state: { n: 1 } }),
  ]);

  await renderSpec(v2, { n: 2 });
  const second = frame()!;
  // same bundle bytes, so the document is byte-identical: the ONLY thing
  // that reloads the frame is the remount
  expect(second).not.toBe(first);
  expect(second.getAttribute('srcdoc')).toBe(first.getAttribute('srcdoc'));

  const secondSent = watch(second);
  await fromFrame(second, READY);
  expect(secondSent).toEqual([
    expect.objectContaining({ type: 'init', spec: v2, state: { n: 2 } }),
  ]);

  // state keeps flowing to the new session (the F2 symptom was that it
  // silently stopped)
  await renderSpec(v2, { n: 3 });
  expect(secondSent.at(-1)).toEqual({ type: 'state', state: { n: 3 } });

  // and an invoke reaches the writer stamped with the NEW revision
  await fromFrame(second, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 2,
  });
  expect(sendSurfaceInvoke).toHaveBeenCalledTimes(1);
  expect(sendSurfaceInvoke).toHaveBeenCalledWith({
    channelId: 'chan-1',
    spec: v2,
    actionId: 'vote',
  });
});

test('an invoke from the replaced frame never reaches the writer', async () => {
  await renderSpec(makeSpec(1), {});
  const first = frame()!;
  watch(first);
  await fromFrame(first, READY);

  await renderSpec(makeSpec(2), {});
  expect(frame()).not.toBe(first);

  await fromFrame(first, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 1,
  });
  expect(sendSurfaceInvoke).not.toHaveBeenCalled();
});
