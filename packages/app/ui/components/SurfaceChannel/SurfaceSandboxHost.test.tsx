// @vitest-environment jsdom
import type { JsonObject, SurfaceSpec } from '@tloncorp/api';
import type { ReactNode } from 'react';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { SurfaceSandboxHost } from './SurfaceSandboxHost';
import { sandboxSessionKey } from './sandboxSession';

/**
 * Two coupled behaviours are asserted here, because they interact:
 *
 * - a spec revision is a NEW SESSION (a new element, a new document load,
 *   a new `ready`, a new `init`), not an update applied to the running
 *   one; and
 * - any load AFTER an element's initial srcdoc load means that frame
 *   navigated itself, so the host tears it down.
 *
 * The interaction is the interesting part: an intentional replacement
 * must never be readable as hostile navigation. It cannot be, because a
 * replacement is a DIFFERENT ELEMENT, and "initial load" is defined per
 * element — while hostile navigation is a second load on an element that
 * already loaded. The last test drives both halves on the same element,
 * to prove the replacement is re-armed rather than exempted.
 */

const SAME_BUNDLE_DOCUMENT =
  '<!doctype html><html><body><!-- shell + bundle --></body></html>';

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

const READY = { type: 'ready', shellVersion: 1, protocolVersion: 1 };

/** what the host handed to the writer, and at which revision it landed */
type Stamped = { actionId: string; specRevision: number };

/**
 * Mirrors SurfaceSandboxContainer: the writer closes over a spec revision
 * and stamps outgoing invokes with it, and the host is keyed on
 * (bundle, revision). `stampRevision` lets a test decouple the two so it
 * can model a writer that has already advanced while the live session has
 * not — the atomicity hazard.
 */
function Harness(props: {
  spec: SurfaceSpec;
  state: JsonObject;
  stamped: Stamped[];
  keyed?: boolean;
  stampRevision?: number;
}) {
  const stampRevision = props.stampRevision ?? props.spec.specRevision;
  return (
    <SurfaceSandboxHost
      key={props.keyed === false ? 'fixed' : sandboxSessionKey(props.spec)}
      document={SAME_BUNDLE_DOCUMENT}
      spec={props.spec}
      state={props.state}
      theme="light"
      canInvoke
      now={Date.UTC(2025, 0, 1, 0, 0, 0)}
      onInvoke={(actionId) =>
        props.stamped.push({ actionId, specRevision: stampRevision })
      }
    />
  );
}

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
});

async function render(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
}

function frame(): HTMLIFrameElement | null {
  return container.querySelector('iframe');
}

/** captures host→sandbox messages for one frame */
function watch(iframe: HTMLIFrameElement): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = [];
  vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(((
    serialized: unknown
  ) => {
    sent.push(JSON.parse(String(serialized)));
  }) as never);
  return sent;
}

/** a message that genuinely originates from that frame's window */
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

/** what a self-navigating frame produces: a load the host did not cause */
async function navigateFrame(iframe: HTMLIFrameElement) {
  await act(async () => {
    iframe.dispatchEvent(new Event('load'));
  });
}

test('the initial srcdoc load leaves the frame alive and the session usable', async () => {
  const stamped: Stamped[] = [];
  const spec = makeSpec(1);
  await render(<Harness spec={spec} state={{ n: 1 }} stamped={stamped} />);

  const iframe = frame();
  expect(iframe).not.toBeNull();

  const sent = watch(iframe!);
  await fromFrame(iframe!, READY);
  expect(sent).toEqual([
    expect.objectContaining({ type: 'init', spec, state: { n: 1 } }),
  ]);
});

test('a post-initial load tears the frame down, and the navigated frame gets no re-init', async () => {
  const stamped: Stamped[] = [];
  const spec = makeSpec(1);
  await render(<Harness spec={spec} state={{ n: 1 }} stamped={stamped} />);

  const iframe = frame()!;
  const sent = watch(iframe);
  await fromFrame(iframe, READY);
  expect(sent).toHaveLength(1);

  await navigateFrame(iframe);
  expect(frame()).toBeNull();

  // the disclosure path this closes: a navigated frame can still post
  // `ready` and still matches `event.source`, so without teardown the
  // session would answer with the full spec + state
  await fromFrame(iframe, READY);
  expect(sent).toHaveLength(1);

  await fromFrame(iframe, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 1,
  });
  expect(stamped).toEqual([]);
});

test('a revision bump on an unchanged bundle replaces the frame and re-inits', async () => {
  const stamped: Stamped[] = [];
  const v1 = makeSpec(1);
  const v2 = makeSpec(2);

  await render(<Harness spec={v1} state={{ n: 1 }} stamped={stamped} />);
  const first = frame()!;
  const firstSent = watch(first);
  await fromFrame(first, READY);
  expect(firstSent).toEqual([
    expect.objectContaining({ type: 'init', spec: v1, state: { n: 1 } }),
  ]);

  await render(<Harness spec={v2} state={{ n: 2 }} stamped={stamped} />);
  const second = frame()!;
  expect(second).not.toBe(first);

  // a new sandbox is not initialized until IT says ready
  const secondSent = watch(second);
  expect(secondSent).toEqual([]);
  await fromFrame(second, READY);
  expect(secondSent).toEqual([
    expect.objectContaining({ type: 'init', spec: v2, state: { n: 2 } }),
  ]);

  // and it is a live session again: state flows, invokes carry the new
  // revision
  await act(async () => {
    root.render(<Harness spec={v2} state={{ n: 3 }} stamped={stamped} />);
  });
  expect(secondSent.at(-1)).toEqual({ type: 'state', state: { n: 3 } });

  await fromFrame(second, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 2,
  });
  expect(stamped).toEqual([{ actionId: 'vote', specRevision: 2 }]);

  // the replaced frame is detached from the session entirely
  await fromFrame(first, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 1,
  });
  expect(stamped).toEqual([{ actionId: 'vote', specRevision: 2 }]);
  expect(firstSent).toHaveLength(1);
});

test('an invoke stamped at the old revision is dropped by the new session', async () => {
  const stamped: Stamped[] = [];
  await render(<Harness spec={makeSpec(1)} state={{}} stamped={stamped} />);
  await render(<Harness spec={makeSpec(2)} state={{}} stamped={stamped} />);

  const second = frame()!;
  watch(second);
  await fromFrame(second, READY);
  await fromFrame(second, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 1,
  });
  expect(stamped).toEqual([]);
});

test('an invoke validated at revision N is stamped N, never N+1', async () => {
  const stamped: Stamped[] = [];
  const v1 = makeSpec(1);

  // deliberately UNKEYED, so the same host instance survives the parent
  // re-render. This is the atomicity hazard on its own: the writer prop
  // advances to the next revision during render, before the live session
  // is torn down. The session must keep the writer it was built with.
  await render(
    <Harness spec={v1} state={{}} stamped={stamped} keyed={false} />
  );
  const iframe = frame()!;
  watch(iframe);
  await fromFrame(iframe, READY);

  await render(
    <Harness
      spec={v1}
      state={{}}
      stamped={stamped}
      keyed={false}
      stampRevision={2}
    />
  );
  expect(frame()).toBe(iframe);

  await fromFrame(iframe, {
    type: 'invoke',
    actionId: 'vote',
    specRevision: 1,
  });
  expect(stamped).toEqual([{ actionId: 'vote', specRevision: 1 }]);
});

test('a revision remount is not hostile navigation, and the replacement is re-armed', async () => {
  const stamped: Stamped[] = [];
  await render(<Harness spec={makeSpec(1)} state={{}} stamped={stamped} />);
  const first = frame()!;

  await render(<Harness spec={makeSpec(2)} state={{}} stamped={stamped} />);
  const second = frame()!;
  // a different element, so its own first load is an INITIAL load and
  // cannot be mistaken for the old element navigating
  expect(second).not.toBe(first);
  expect(second.isConnected).toBe(true);

  const sent = watch(second);
  await fromFrame(second, READY);
  expect(sent).toHaveLength(1);

  // re-armed, not exempted: the replacement tears down on ITS second load
  await navigateFrame(second);
  expect(frame()).toBeNull();
});
